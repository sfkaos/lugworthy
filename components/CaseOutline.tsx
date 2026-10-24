// Watch case drawn to scale from diameter, lug-to-lug and lug width (doc 04 CaseOutline).
// Also the image placeholder for brands that haven't licensed photos (doc 08).

interface Props {
  diameter: number | null;
  lugToLug: number | null;
  lugWidth: number | null;
  /** mm represented by the full viewBox height, so several outlines share a scale. */
  scaleMm?: number;
  stroke?: string;
  fill?: string;
  className?: string;
  label?: string;
  dashedWhenGuess?: boolean;
}

export function outlinePath(d: number, l2l: number, lw: number) {
  const r = d / 2;
  const halfL2l = l2l / 2;
  const lugHalf = lw / 2 + 2.2; // lug outer edge sits a little outside the strap width
  const lugInner = lw / 2;
  const yLugStart = Math.sqrt(Math.max(r * r - lugHalf * lugHalf, 0));
  // Top lugs (two horns) from case edge up to l2l.
  const lug = (sign: 1 | -1) =>
    [
      `M ${-lugHalf} ${sign * -yLugStart * 0.92}`,
      `L ${-lugHalf} ${sign * -halfL2l}`,
      `L ${-lugInner} ${sign * -halfL2l}`,
      `L ${-lugInner} ${sign * -(r - 1)}`,
      `M ${lugHalf} ${sign * -yLugStart * 0.92}`,
      `L ${lugHalf} ${sign * -halfL2l}`,
      `L ${lugInner} ${sign * -halfL2l}`,
      `L ${lugInner} ${sign * -(r - 1)}`,
    ].join(" ");
  return { r, lugs: `${lug(1)} ${lug(-1)}` };
}

export function CaseOutline({
  diameter,
  lugToLug,
  lugWidth,
  scaleMm = 60,
  stroke = "currentColor",
  fill = "none",
  className,
  label,
  dashedWhenGuess = true,
}: Props) {
  const d = diameter ?? 40;
  const l2l = lugToLug ?? Math.round(d * 1.18 * 10) / 10;
  const lw = lugWidth ?? Math.round(d / 2);
  const guess = !diameter || !lugToLug;
  const { r, lugs } = outlinePath(d, l2l, lw);
  const half = scaleMm / 2;
  const sw = scaleMm / 120;
  return (
    <svg
      viewBox={`${-half} ${-half} ${scaleMm} ${scaleMm}`}
      className={className}
      role="img"
      aria-label={label ?? `Case outline: ${d} mm diameter, ${l2l} mm lug-to-lug`}
    >
      <g fill="none" stroke={stroke} strokeWidth={sw} strokeDasharray={guess && dashedWhenGuess ? `${sw * 3} ${sw * 2}` : undefined} strokeLinejoin="round">
        <path d={lugs} />
        <circle cx={0} cy={0} r={r} fill={fill} />
        <circle cx={0} cy={0} r={r * 0.84} opacity={0.45} />
        {/* crown at 3 */}
        <rect x={r - 0.2} y={-1.8} width={2.2} height={3.6} rx={0.6} />
        {/* hands at 10:09 */}
        <line x1={0} y1={0} x2={-r * 0.45} y2={-r * 0.32} strokeWidth={sw * 1.6} strokeLinecap="round" />
        <line x1={0} y1={0} x2={r * 0.58} y2={-r * 0.48} strokeWidth={sw * 1.2} strokeLinecap="round" />
      </g>
    </svg>
  );
}
