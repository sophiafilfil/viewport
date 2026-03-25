import { NextResponse } from "next/server";
import { Resend } from "resend";

const PURPOSES = [
  "initial_consultation",
  "technical_scope",
  "site_field",
  "proposal_estimate",
  "gis_surveying",
  "structural_infrastructure",
  "other",
] as const;

type Purpose = (typeof PURPOSES)[number];

const PURPOSE_LABELS: Record<Purpose, string> = {
  initial_consultation: "Initial consultation",
  technical_scope: "Technical / scope discussion",
  site_field: "Site visit or field coordination",
  proposal_estimate: "Proposal or estimate review",
  gis_surveying: "GIS / surveying question",
  structural_infrastructure: "Structural or infrastructure question",
  other: "Other",
};

function buildTimeSlots(): string[] {
  const slots: string[] = [];
  for (let h = 9; h < 17; h++) {
    const hh = String(h).padStart(2, "0");
    slots.push(`${hh}:00`, `${hh}:30`);
  }
  slots.push("17:00");
  return slots;
}

const ALLOWED_TIME_SLOTS = new Set(buildTimeSlots());

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

function todayISO(): string {
  const t = new Date();
  return `${t.getFullYear()}-${pad2(t.getMonth() + 1)}-${pad2(t.getDate())}`;
}

function maxSelectableISO(): string {
  const t = new Date();
  t.setMonth(t.getMonth() + 3);
  return `${t.getFullYear()}-${pad2(t.getMonth() + 1)}-${pad2(t.getDate())}`;
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_CHARS_RE = /^[\d\s+().\-#*ext]+$/i;

function isValidOptionalPhone(s: string): boolean {
  if (s.length === 0) return true;
  if (s.length > 32) return false;
  if (!PHONE_CHARS_RE.test(s)) return false;
  const digits = s.replace(/\D/g, "");
  return digits.length >= 7 && digits.length <= 15;
}

function isValidPurpose(v: unknown): v is Purpose {
  return typeof v === "string" && PURPOSES.includes(v as Purpose);
}

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  if (body === null || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid payload." }, { status: 400 });
  }

  const o = body as Record<string, unknown>;

  const date = o.date;
  const timeSlot = o.timeSlot;
  const purpose = o.purpose;
  const purposeDetail =
    typeof o.purposeDetail === "string" ? o.purposeDetail.trim() : "";
  const email = typeof o.email === "string" ? o.email.trim() : "";
  const phone = typeof o.phone === "string" ? o.phone.trim() : "";
  const name = typeof o.name === "string" ? o.name.trim() : "";
  const company = typeof o.company === "string" ? o.company.trim() : "";

  if (typeof date !== "string" || !DATE_RE.test(date)) {
    return NextResponse.json({ error: "Invalid date." }, { status: 400 });
  }

  const tMin = todayISO();
  const tMax = maxSelectableISO();
  if (date < tMin || date > tMax) {
    return NextResponse.json({ error: "Date is out of range." }, { status: 400 });
  }

  const [yStr, mStr, dStr] = date.split("-");
  const y = Number(yStr);
  const m = Number(mStr);
  const d = Number(dStr);
  const localDay = new Date(y, m - 1, d);
  const dow = localDay.getDay();
  if (dow === 0 || dow === 6) {
    return NextResponse.json({ error: "Weekend dates are not available." }, { status: 400 });
  }

  if (typeof timeSlot !== "string" || !ALLOWED_TIME_SLOTS.has(timeSlot)) {
    return NextResponse.json({ error: "Invalid time slot." }, { status: 400 });
  }

  if (!isValidPurpose(purpose)) {
    return NextResponse.json({ error: "Invalid purpose." }, { status: 400 });
  }

  if (purpose === "other") {
    if (purposeDetail.length < 1 || purposeDetail.length > 200) {
      return NextResponse.json(
        { error: "Please briefly describe your topic (1–200 characters)." },
        { status: 400 }
      );
    }
  } else if (purposeDetail.length > 200) {
    return NextResponse.json({ error: "Purpose detail is too long." }, { status: 400 });
  }

  if (!email || email.length > 254 || !EMAIL_RE.test(email)) {
    return NextResponse.json({ error: "Valid work email is required." }, { status: 400 });
  }

  if (!isValidOptionalPhone(phone)) {
    return NextResponse.json(
      { error: "Invalid phone number (optional: use 7–15 digits)." },
      { status: 400 }
    );
  }

  if (name.length < 1) {
    return NextResponse.json({ error: "Name is required." }, { status: 400 });
  }
  if (name.length > 200 || company.length > 200) {
    return NextResponse.json({ error: "Name or company is too long." }, { status: 400 });
  }

  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM_EMAIL;
  const to = process.env.SCHEDULE_INBOX_EMAIL;

  if (!apiKey || !from || !to) {
    return NextResponse.json(
      { error: "Scheduling is temporarily unavailable." },
      { status: 503 }
    );
  }

  const purposeLine = PURPOSE_LABELS[purpose];
  const detailBlock =
    purpose === "other"
      ? `<p><strong>Details:</strong> ${escapeHtml(purposeDetail)}</p>`
      : "";

  const html = `
    <h1>New session request</h1>
    <p>This is a <strong>request only</strong> — not a confirmed calendar hold until your team responds.</p>
    <ul>
      <li><strong>Preferred date:</strong> ${escapeHtml(date)}</li>
      <li><strong>Preferred time:</strong> ${escapeHtml(timeSlot)} Central Time</li>
      <li><strong>Purpose:</strong> ${escapeHtml(purposeLine)}</li>
      <li><strong>Email:</strong> ${escapeHtml(email)}</li>
      ${phone ? `<li><strong>Phone:</strong> ${escapeHtml(phone)}</li>` : ""}
      <li><strong>Name:</strong> ${escapeHtml(name)}</li>
      ${company ? `<li><strong>Company:</strong> ${escapeHtml(company)}</li>` : ""}
      <li><strong>Received:</strong> ${escapeHtml(new Date().toISOString())}</li>
    </ul>
    ${detailBlock}
  `;

  const text = [
    "New session request (not confirmed until you respond)",
    `Date: ${date}`,
    `Time: ${timeSlot} Central Time`,
    `Purpose: ${purposeLine}`,
    purpose === "other" ? `Details: ${purposeDetail}` : "",
    `Email: ${email}`,
    phone ? `Phone: ${phone}` : "",
    `Name: ${name}`,
    company ? `Company: ${company}` : "",
    `Received: ${new Date().toISOString()}`,
  ]
    .filter(Boolean)
    .join("\n");

  const resend = new Resend(apiKey);

  const result = await resend.emails.send({
    from,
    to: [to],
    replyTo: email,
    subject: `Session request — ${date} ${timeSlot} CT — ${purposeLine}`,
    html,
    text,
  });

  if (result.error) {
    return NextResponse.json({ error: "Could not send request. Try again later." }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
