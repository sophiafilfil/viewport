type StitchPageFrameProps = {
  src: string;
  title: string;
};

export function StitchPageFrame({ src, title }: StitchPageFrameProps) {
  return (
    <iframe
      title={title}
      src={src}
      className="h-[100dvh] w-full border-0 bg-[#fcfcfc]"
      loading="eager"
      allow="autoplay; fullscreen"
    />
  );
}
