import type { Metadata } from "next";
import { StitchPageFrame } from "@/components/StitchPageFrame";

export const metadata: Metadata = {
  title: "Our Services | VIEWPORT Engineering",
  description: "VIEWPORT Engineering — Services (Stitch, light mode)",
};

export default async function OurServicesPage({
  searchParams,
}: {
  searchParams: Promise<{ schedule?: string }>;
}) {
  const { schedule } = await searchParams;
  const src =
    schedule === "1"
      ? "/stitch/viewport-engineering/our-services/index.html?schedule=1"
      : "/stitch/viewport-engineering/our-services/index.html";

  return (
    <StitchPageFrame
      title="Our Services | VIEWPORT Engineering"
      src={src}
    />
  );
}
