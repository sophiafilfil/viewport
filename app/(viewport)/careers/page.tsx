import type { Metadata } from "next";
import { StitchPageFrame } from "@/components/StitchPageFrame";

export const metadata: Metadata = {
  title: "Careers | VIEWPORT Engineering",
  description: "VIEWPORT Engineering — Careers (Stitch, light mode)",
};

export default function CareersPage() {
  return (
    <StitchPageFrame
      title="Careers | VIEWPORT Engineering"
      src="/stitch/viewport-engineering/careers/index.html"
    />
  );
}
