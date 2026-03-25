import type { Metadata } from "next";
import { StitchPageFrame } from "@/components/StitchPageFrame";

export const metadata: Metadata = {
  title: "About Us | VIEWPORT Engineering",
  description: "VIEWPORT Engineering — About (Stitch, light mode)",
};

export default function AboutUsPage() {
  return (
    <StitchPageFrame
      title="About Us | VIEWPORT Engineering"
      src="/stitch/viewport-engineering/about-us/index.html"
    />
  );
}
