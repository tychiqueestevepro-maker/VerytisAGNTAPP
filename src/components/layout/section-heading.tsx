export function SectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="mb-5 text-[11px] font-medium uppercase tracking-[0.24em] text-white/38">
      {children}
    </h2>
  );
}
