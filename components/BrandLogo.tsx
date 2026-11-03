/** Brand logo from the brand's own site, or the brand's initial in a tile when there's none. */
export function BrandLogo({ name, url, size = "md" }: { name: string; url: string | null; size?: "md" | "lg" }) {
  const box = size === "lg" ? "h-16 w-16 text-3xl" : "h-11 w-11 text-lg";
  if (!url) {
    return (
      <span aria-hidden className={`flex ${box} shrink-0 items-center justify-center rounded-[var(--radius-md)] border border-line bg-surface-2 font-serif text-[1.3em] text-ink`}>
        {name.replace(/^the\s+/i, "").charAt(0).toUpperCase()}
      </span>
    );
  }
  return (
    <span className={`flex ${box} shrink-0 items-center justify-center overflow-hidden rounded-[var(--radius-md)] border border-line bg-photo p-1`}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={url} alt={`${name} logo`} loading="lazy" referrerPolicy="no-referrer" className="max-h-full max-w-full object-contain" />
    </span>
  );
}
