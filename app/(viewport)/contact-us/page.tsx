import type { Metadata } from "next";
import { StitchPageFrame } from "@/components/StitchPageFrame";

export const metadata: Metadata = {
  title: "Contact Us | VIEWPORT Engineering",
  description: "VIEWPORT Engineering — Contact (Stitch, light mode)",
};

export default function ContactUsPage() {
  return (
    <StitchPageFrame
      title="Contact Us | VIEWPORT Engineering"
      src="/stitch/viewport-engineering/contact-us/index.html"
    />
  );
}
