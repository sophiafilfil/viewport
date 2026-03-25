export default function ViewportStitchLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <div
      className="min-h-[100dvh] bg-[#fcfcfc] text-neutral-900"
      style={{ colorScheme: "light" }}
    >
      {children}
    </div>
  );
}
