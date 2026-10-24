/** Wordmark with the two-lug monogram. Neutral so brand themes lead (doc 04). */
export function Logo({ className = "" }: { className?: string }) {
  return (
    <span className={`inline-flex items-center gap-2 ${className}`}>
      <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
        <path d="M7 3v5M17 3v5M7 16v5M17 16v5" />
        <circle cx="12" cy="12" r="5.5" />
      </svg>
      <span className="font-serif text-xl font-semibold tracking-tight">Lugworthy</span>
    </span>
  );
}
