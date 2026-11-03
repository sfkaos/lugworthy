/** Wordmark with the two-lug monogram. Neutral so brand themes lead (doc 04). */
export function Logo({ className = "" }: { className?: string }) {
  return (
    <span className={`inline-flex items-center gap-2 ${className}`}>
      <svg viewBox="0 0 24 24" width="24" height="24" aria-hidden fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round">
        <path d="M7 3v5M17 3v5M7 16v5M17 16v5" />
        <circle cx="12" cy="12" r="5.5" />
        <path d="M12 9.2V12l1.8 1.2" stroke="var(--brass)" />
      </svg>
      <span className="font-serif text-2xl font-semibold leading-none tracking-tight">Lugworthy</span>
    </span>
  );
}
