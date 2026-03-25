import { NextResponse } from "next/server";
import { Resend } from "resend";

/**
 * Project inquiry: multipart form with optional PDF attachments.
 *
 * Env (required for production):
 * - RESEND_API_KEY, RESEND_FROM_EMAIL, PROJECT_INQUIRY_INBOX_EMAIL
 * - VIRUSTOTAL_API_KEY
 *
 * Limits: MAX_ATTACHMENTS / MAX_BYTES_PER_FILE / MAX_TOTAL_ATTACHMENT_BYTES below
 * are chosen to stay under typical serverless request body caps (~4.5MB on Vercel Hobby).
 */

export const maxDuration = 120;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Max PDFs per request */
const MAX_ATTACHMENTS = 5;
/** Per-file cap (bytes) */
const MAX_BYTES_PER_FILE = 1024 * 1024; // 1 MiB
/** Total attachment payload cap (bytes) — stay under common host limits */
const MAX_TOTAL_ATTACHMENT_BYTES = 3 * 1024 * 1024; // 3 MiB

const VT_FILES_URL = "https://www.virustotal.com/api/v3/files";
const VT_ANALYSIS_URL = (id: string) =>
  `https://www.virustotal.com/api/v3/analyses/${encodeURIComponent(id)}`;

const PDF_MAGIC = new TextEncoder().encode("%PDF-");

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function isPdfMagic(buf: Uint8Array): boolean {
  if (buf.length < PDF_MAGIC.length) return false;
  for (let i = 0; i < PDF_MAGIC.length; i++) {
    if (buf[i] !== PDF_MAGIC[i]) return false;
  }
  return true;
}

/** Heuristic: /Encrypt in trailer area (first 64 KiB) suggests encryption. */
function pdfAppearsEncrypted(bytes: Uint8Array): boolean {
  const encMarker = new TextEncoder().encode("/Encrypt");
  const limit = Math.min(bytes.length - encMarker.length, 64 * 1024);
  if (limit < 0) return false;
  for (let i = 0; i <= limit; i++) {
    let match = true;
    for (let j = 0; j < encMarker.length; j++) {
      if (bytes[i + j] !== encMarker[j]) {
        match = false;
        break;
      }
    }
    if (match) return true;
  }
  return false;
}

async function sleep(ms: number): Promise<void> {
  await new Promise((r) => setTimeout(r, ms));
}

type VtStats = {
  malicious?: number;
  suspicious?: number;
  harmless?: number;
  undetected?: number;
  failure?: number;
  "type-unsupported"?: number;
};

async function virusTotalUploadAndPoll(
  apiKey: string,
  bytes: Uint8Array,
  filename: string
): Promise<{ ok: true } | { ok: false; message: string; status: number }> {
  const uploadBody = new FormData();
  uploadBody.append(
    "file",
    new Blob([bytes as BlobPart], { type: "application/pdf" }),
    filename
  );

  const up = await fetch(VT_FILES_URL, {
    method: "POST",
    headers: { "x-apikey": apiKey },
    body: uploadBody,
  });

  if (up.status === 429) {
    return {
      ok: false,
      message: "VirusTotal rate limit reached. Please try again in a few minutes.",
      status: 503,
    };
  }

  if (!up.ok) {
    let detail = "";
    try {
      const j = (await up.json()) as { error?: { message?: string } };
      detail = j.error?.message ?? "";
    } catch {
      /* ignore */
    }
    return {
      ok: false,
      message: detail || "VirusTotal upload failed.",
      status: up.status >= 500 ? 502 : 400,
    };
  }

  let analysisId: string;
  try {
    const j = (await up.json()) as { data?: { id?: string } };
    analysisId = j.data?.id ?? "";
  } catch {
    return { ok: false, message: "Invalid VirusTotal response.", status: 502 };
  }
  if (!analysisId) {
    return { ok: false, message: "VirusTotal did not return an analysis id.", status: 502 };
  }

  const deadline = Date.now() + 90_000;
  let waitMs = 1000;

  while (Date.now() < deadline) {
    const poll = await fetch(VT_ANALYSIS_URL(analysisId), {
      headers: { "x-apikey": apiKey },
    });

    if (poll.status === 429) {
      await sleep(5000);
      continue;
    }

    if (!poll.ok) {
      return {
        ok: false,
        message: "VirusTotal analysis request failed.",
        status: 502,
      };
    }

    const body = (await poll.json()) as {
      data?: { attributes?: { status?: string; stats?: VtStats } };
    };
    const status = body.data?.attributes?.status;
    const stats = body.data?.attributes?.stats;

    if (status === "completed") {
      const malicious = stats?.malicious ?? 0;
      const suspicious = stats?.suspicious ?? 0;
      if (malicious + suspicious > 0) {
        return {
          ok: false,
          message:
            "One or more PDFs did not pass malware screening. Remove the flagged file(s) or contact us directly.",
          status: 422,
        };
      }
      return { ok: true };
    }

    if (status === "queued" || status === "in_progress") {
      await sleep(waitMs);
      waitMs = Math.min(waitMs + 500, 5000);
      continue;
    }

    return {
      ok: false,
      message: "VirusTotal returned an unexpected analysis state.",
      status: 502,
    };
  }

  return {
    ok: false,
    message: "Security scan timed out. Please try again with smaller PDFs or fewer attachments.",
    status: 504,
  };
}

export async function POST(request: Request) {
  const vtKey = process.env.VIRUSTOTAL_API_KEY;
  const resendKey = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM_EMAIL;
  const to = process.env.PROJECT_INQUIRY_INBOX_EMAIL;

  if (!resendKey || !from || !to) {
    return NextResponse.json(
      { error: "Inquiry submissions are temporarily unavailable." },
      { status: 503 }
    );
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ error: "Invalid form data." }, { status: 400 });
  }

  const fullName =
    typeof formData.get("fullName") === "string"
      ? (formData.get("fullName") as string).trim()
      : "";
  const email =
    typeof formData.get("email") === "string"
      ? (formData.get("email") as string).trim()
      : "";
  const projectType =
    typeof formData.get("projectType") === "string"
      ? (formData.get("projectType") as string).trim()
      : "";
  const budget =
    typeof formData.get("budget") === "string"
      ? (formData.get("budget") as string).trim()
      : "";
  const brief =
    typeof formData.get("brief") === "string"
      ? (formData.get("brief") as string).trim()
      : "";

  if (!fullName || fullName.length > 200) {
    return NextResponse.json({ error: "Please enter your full name (max 200 characters)." }, { status: 400 });
  }
  if (!email || email.length > 254 || !EMAIL_RE.test(email)) {
    return NextResponse.json({ error: "A valid corporate email is required." }, { status: 400 });
  }
  if (!projectType || projectType.length > 200) {
    return NextResponse.json({ error: "Please select a project type." }, { status: 400 });
  }
  if (!budget || budget.length > 200) {
    return NextResponse.json({ error: "Please select an estimated budget." }, { status: 400 });
  }
  if (brief.length < 1 || brief.length > 20_000) {
    return NextResponse.json(
      { error: "Please provide a project brief (1–20,000 characters)." },
      { status: 400 }
    );
  }

  const rawFiles = formData.getAll("attachment");
  const files: File[] = [];
  for (const entry of rawFiles) {
    if (entry instanceof File && entry.size > 0) {
      files.push(entry);
    }
  }

  if (files.length > MAX_ATTACHMENTS) {
    return NextResponse.json(
      { error: `You can attach at most ${MAX_ATTACHMENTS} PDF files.` },
      { status: 400 }
    );
  }

  let totalBytes = 0;
  const prepared: { name: string; bytes: Uint8Array }[] = [];

  for (const file of files) {
    const name = file.name.replace(/[^\w.\-()+ ]/g, "_").slice(0, 200);
    if (!name.toLowerCase().endsWith(".pdf")) {
      return NextResponse.json(
        { error: "Only PDF files are allowed as attachments." },
        { status: 400 }
      );
    }
    if (file.size > MAX_BYTES_PER_FILE) {
      return NextResponse.json(
        {
          error: `Each PDF must be at most ${Math.floor(MAX_BYTES_PER_FILE / (1024 * 1024))} MB (host-safe limit).`,
        },
        { status: 400 }
      );
    }
    totalBytes += file.size;
    if (totalBytes > MAX_TOTAL_ATTACHMENT_BYTES) {
      return NextResponse.json(
        {
          error: `Total attachment size must be at most ${Math.floor(MAX_TOTAL_ATTACHMENT_BYTES / (1024 * 1024))} MB combined.`,
        },
        { status: 400 }
      );
    }

    let buf: ArrayBuffer;
    try {
      buf = await file.arrayBuffer();
    } catch {
      return NextResponse.json({ error: "Could not read an uploaded file." }, { status: 400 });
    }
    const bytes = new Uint8Array(buf);
    if (!isPdfMagic(bytes)) {
      return NextResponse.json(
        { error: `“${name}” does not appear to be a valid PDF.` },
        { status: 400 }
      );
    }

    if (pdfAppearsEncrypted(bytes)) {
      return NextResponse.json(
        { error: `Password-protected PDFs are not accepted: ${name}` },
        { status: 400 }
      );
    }

    prepared.push({ name, bytes });
  }

  if (prepared.length > 0 && !vtKey) {
    return NextResponse.json(
      { error: "PDF attachments require the malware scanner to be configured." },
      { status: 503 }
    );
  }

  for (const { name, bytes } of prepared) {
    const vt = await virusTotalUploadAndPoll(vtKey!, bytes, name);
    if (!vt.ok) {
      return NextResponse.json({ error: vt.message }, { status: vt.status });
    }
  }

  const received = new Date().toISOString();
  const html = `
    <h1>New project inquiry</h1>
    <ul>
      <li><strong>Name:</strong> ${escapeHtml(fullName)}</li>
      <li><strong>Email:</strong> ${escapeHtml(email)}</li>
      <li><strong>Project type:</strong> ${escapeHtml(projectType)}</li>
      <li><strong>Estimated budget:</strong> ${escapeHtml(budget)}</li>
      <li><strong>Received:</strong> ${escapeHtml(received)}</li>
    </ul>
    <h2>Technical brief</h2>
    <pre style="white-space:pre-wrap;font-family:system-ui,sans-serif">${escapeHtml(brief)}</pre>
    ${
      prepared.length
        ? `<p><strong>Attachments:</strong> ${escapeHtml(prepared.map((p) => p.name).join(", "))}</p>`
        : "<p><em>No PDF attachments.</em></p>"
    }
  `;

  const text = [
    "New project inquiry",
    `Name: ${fullName}`,
    `Email: ${email}`,
    `Project type: ${projectType}`,
    `Budget: ${budget}`,
    `Received: ${received}`,
    "",
    "Technical brief:",
    brief,
    prepared.length ? `\nAttachments: ${prepared.map((p) => p.name).join(", ")}` : "",
  ]
    .filter(Boolean)
    .join("\n");

  const resend = new Resend(resendKey);

  const attachments =
    prepared.length > 0
      ? prepared.map((p) => ({
          filename: p.name,
          content: Buffer.from(p.bytes),
        }))
      : undefined;

  const result = await resend.emails.send({
    from,
    to: [to],
    replyTo: email,
    subject: `Project inquiry — ${fullName} — ${projectType}`,
    html,
    text,
    attachments,
  });

  if (result.error) {
    return NextResponse.json(
      { error: "Could not send inquiry. Please try again later." },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true });
}
