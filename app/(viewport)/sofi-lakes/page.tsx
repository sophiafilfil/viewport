import type { Metadata } from "next";
import { StitchPageFrame } from "@/components/StitchPageFrame";

export const metadata: Metadata = {
  title: "Sofi Lakes — Texas | VIEWPORT Engineering",
  description:
    "VIEWPORT Engineering — Sofi Lakes master-planned community (Stitch, light mode)",
};

export default function SofiLakesPage() {
  return (
    <StitchPageFrame
      title="Sofi Lakes — Texas | VIEWPORT Engineering"
      src="/stitch/viewport-engineering/sofi-lakes/index.html"
    />
  );
}
