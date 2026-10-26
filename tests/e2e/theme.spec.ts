import { expect, test, type Page } from "@playwright/test";
import { firstWatchHref } from "./helpers";

// The site follows the system light/dark setting. Text must stay readable (WCAG AA) in both.
const lum = (rgb: number[]) => {
  const [r, g, b] = rgb.map((c) => c / 255).map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const contrast = (a: number[], b: number[]) => {
  const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};
const colors = (page: Page) =>
  page.evaluate(() => {
    const rgb = (s: string) => (s.match(/[\d.]+/g) ?? []).slice(0, 3).map(Number);
    const body = getComputedStyle(document.body);
    const h1 = getComputedStyle(document.querySelector("main h1")!);
    return { bg: rgb(body.backgroundColor), text: rgb(body.color), h1: rgb(h1.color), scheme: getComputedStyle(document.documentElement).colorScheme };
  });

for (const scheme of ["light", "dark"] as const) {
  test.describe(`${scheme} mode`, () => {
    test.use({ colorScheme: scheme });
    for (const path of ["/", "/watches", "/brands", "WATCH"]) {
      test(`${path === "WATCH" ? "watch page" : path} is readable`, async ({ page }) => {
        await page.goto(path === "WATCH" ? await firstWatchHref(page) : path);
        const c = await colors(page);
        expect(c.scheme).toContain(scheme);
        const bgLum = lum(c.bg);
        if (scheme === "dark") expect(bgLum, `background ${c.bg} is not dark`).toBeLessThan(0.05);
        else expect(bgLum, `background ${c.bg} is not light`).toBeGreaterThan(0.8);
        expect(contrast(c.text, c.bg)).toBeGreaterThanOrEqual(4.5);
        expect(contrast(c.h1, c.bg)).toBeGreaterThanOrEqual(4.5);
      });
    }
  });
}

test.describe("dark mode muted text", () => {
  test.use({ colorScheme: "dark" });
  test("muted text on cards keeps AA contrast", async ({ page }) => {
    await page.goto("/watches");
    const pairs = await page.evaluate(() => {
      const rgb = (s: string) => (s.match(/[\d.]+/g) ?? []).slice(0, 3).map(Number);
      const bgOf = (el: Element | null): number[] => {
        while (el) {
          const c = getComputedStyle(el).backgroundColor;
          if (c && !/rgba\(.*,\s*0\)|transparent/.test(c)) return rgb(c);
          el = el.parentElement;
        }
        return [255, 255, 255];
      };
      return [...document.querySelectorAll("main .text-muted")].slice(0, 30).map((el) => ({ fg: rgb(getComputedStyle(el).color), bg: bgOf(el) }));
    });
    expect(pairs.length).toBeGreaterThan(0);
    for (const p of pairs) expect(contrast(p.fg, p.bg), JSON.stringify(p)).toBeGreaterThanOrEqual(4.5);
  });
});
