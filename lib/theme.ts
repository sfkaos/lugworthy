// Brand theming rules (doc 04): only claimed brands get colors; on-color text is picked
// automatically; a color failing WCAG AA against the page is demoted to an accent border.
import type { Brand } from "./types";

function luminance(hex: string): number {
  const h = hex.replace("#", "");
  const full = h.length === 3 ? h.split("").map((c) => c + c).join("") : h;
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(full.slice(i, i + 2), 16) / 255).map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function contrast(a: string, b: string): number {
  const [l1, l2] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (l1 + 0.05) / (l2 + 0.05);
}

export function brandThemeStyle(brand: Brand): React.CSSProperties | undefined {
  if (brand.claimStatus !== "claimed" || !brand.colorPrimary || !/^#[0-9a-f]{3,6}$/i.test(brand.colorPrimary)) return undefined;
  const primary = brand.colorPrimary;
  const onPrimary = contrast(primary, "#ffffff") >= contrast(primary, "#111111") ? "#ffffff" : "#111111";
  const usableAsFill = contrast(primary, onPrimary) >= 4.5;
  return {
    ["--brand-primary" as string]: usableAsFill ? primary : "var(--surface-2)",
    ["--brand-on-primary" as string]: usableAsFill ? onPrimary : "var(--text)",
    ["--brand-secondary" as string]: brand.colorSecondary ?? primary,
  };
}
