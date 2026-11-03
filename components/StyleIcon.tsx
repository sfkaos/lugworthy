/** Line icons for watch styles: one dial, the detail that defines the style. Decorative. */
export function StyleIcon({ style, className = "" }: { style: string; className?: string }) {
  const common = { viewBox: "0 0 48 48", fill: "none", stroke: "currentColor", strokeWidth: 1.5, strokeLinecap: "round" as const, "aria-hidden": true, className };
  switch (style) {
    case "diver":
      return (
        <svg {...common}>
          <circle cx="24" cy="24" r="19" /><circle cx="24" cy="24" r="13" />
          <path d="M24 6.5l-2.5 3.5h5z" fill="currentColor" />
          {[30, 60, 90, 120, 150, 180, 210, 240, 270, 300, 330].map((a) => <path key={a} d="M24 6v2.5" transform={`rotate(${a} 24 24)`} />)}
          <path d="M24 24v-8M24 24l5 3" />
        </svg>
      );
    case "field":
      return (
        <svg {...common}>
          <circle cx="24" cy="24" r="16" />
          {[0, 90, 180, 270].map((a) => <path key={a} d="M24 10v4" strokeWidth="2.5" transform={`rotate(${a} 24 24)`} />)}
          {[30, 60, 120, 150, 210, 240, 300, 330].map((a) => <path key={a} d="M24 10v2" transform={`rotate(${a} 24 24)`} />)}
          <path d="M24 24V13M24 24l7 4" />
        </svg>
      );
    case "gmt":
      return (
        <svg {...common}>
          <circle cx="24" cy="24" r="19" />
          <path d="M24 8a16 16 0 0 1 0 32" strokeWidth="4.5" strokeOpacity=".35" strokeLinecap="butt" />
          <circle cx="24" cy="24" r="13" />
          <path d="M24 24v-9M24 24l6 2" /><path d="M24 24l-8 7" /><path d="M14.5 33l2.5-1.5-.5 3z" fill="currentColor" />
        </svg>
      );
    case "chronograph":
      return (
        <svg {...common}>
          <circle cx="24" cy="24" r="16" />
          <circle cx="18" cy="24" r="4" /><circle cx="30" cy="24" r="4" /><circle cx="24" cy="31" r="3.5" />
          <path d="M24 24V10" /><path d="M21 6h6M24 6v2M38 12l2-2M10 12l-2-2" />
        </svg>
      );
    case "dress":
      return (
        <svg {...common}>
          <circle cx="24" cy="24" r="15" />
          <path d="M24 24v-10M24 24l6.5 3.5" strokeWidth="1.25" />
          <path d="M24 11v1.5M24 35.5V37M11 24h1.5M35.5 24H37" />
          <path d="M39 22v4" strokeWidth="2.5" />
        </svg>
      );
    case "pilot":
      return (
        <svg {...common}>
          <circle cx="24" cy="24" r="16" />
          <path d="M24 10.5l-3 4.5h6z" fill="currentColor" />
          <path d="M10.5 24h3M34.5 24h3M24 34.5v3" strokeWidth="2.5" />
          <path d="M24 24l-6-7M24 24l9 0" />
          <path d="M40 21v6M42.5 22v4" strokeWidth="2" />
        </svg>
      );
    default:
      return (
        <svg {...common}>
          <circle cx="24" cy="24" r="16" /><path d="M24 24v-9M24 24l6 4" />
        </svg>
      );
  }
}
