import type { Metadata } from "next";
import { StitchPageFrame } from "@/components/StitchPageFrame";

export const metadata: Metadata = {
  title: "Vertex Tower North | VIEWPORT Engineering",
  description:
    "VIEWPORT Engineering — Vertex Tower North (Stitch, light mode)",
};

export default function VertexTowerNorthPage() {
  return (
    <StitchPageFrame
      title="Vertex Tower North | VIEWPORT Engineering"
      src="/stitch/viewport-engineering/vertex-tower-north/index.html"
    />
  );
}
