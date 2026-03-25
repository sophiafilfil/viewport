import type { Metadata } from "next";
import { StitchPageFrame } from "@/components/StitchPageFrame";

export const metadata: Metadata = {
  title: "Our Projects | VIEWPORT Engineering",
  description: "VIEWPORT Engineering — Projects (Stitch, light mode)",
};

export default function OurProjectsPage() {
  return (
    <StitchPageFrame
      title="Our Projects | VIEWPORT Engineering"
      src="/stitch/viewport-engineering/our-projects/index.html"
    />
  );
}
