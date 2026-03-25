import type { Metadata } from "next";
import { StitchPageFrame } from "@/components/StitchPageFrame";

export const metadata: Metadata = {
  title: "VIEWPORT Engineering",
  description:
    "VIEWPORT Engineering — Home (Stitch, light mode). Precision structural solutions for Texas.",
};

export default function HomePage() {
  return (
    <StitchPageFrame
      title="VIEWPORT Engineering | Home"
      src="/stitch/viewport-engineering/home/index.html"
    />
  );
}
