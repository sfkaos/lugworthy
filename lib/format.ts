// Formatting rules from doc 04: mm, m and h with a non-breaking space; USD first.

const NBSP = " ";

export function money(minor: number, currency = "USD"): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    maximumFractionDigits: minor % 100 === 0 ? 0 : 2,
  }).format(minor / 100);
}

export const mm = (v: number | null | undefined) => (v == null ? null : `${trim(v)}${NBSP}mm`);
export const metres = (v: number | null | undefined) => (v == null ? null : `${v}${NBSP}m`);
export const hours = (v: number | null | undefined) => (v == null ? null : `${v}${NBSP}h`);

function trim(v: number) {
  return Number.isInteger(v) ? String(v) : v.toFixed(1);
}

/** Rough wrist fit from lug-to-lug. Rule of thumb: ~7.4 mm of lug-to-lug per inch of
 *  wrist circumference before the lugs overhang. Shown as a helper, never a filter. */
export function wristFit(l2l: number | null): { min: string } | null {
  if (!l2l) return null;
  return { min: (Math.round((l2l / 7.4) * 4) / 4).toFixed(2).replace(/0$/, "") };
}

export function shortDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });
}
