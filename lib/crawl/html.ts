// HTML helpers: brand logo detection, JSON-LD parsing, and URL cleanup.
import * as cheerio from "cheerio";

export type CheerioRoot = ReturnType<typeof cheerio.load>;

export interface ImageRef {
  url: string; // the brand's own URL (source of truth for attribution)
  width: number | null;
  height: number | null;
  storedUrl?: string | null; // our copy in file storage, when mirrored
}
export interface BrandImage extends ImageRef {
  kind: "logo" | "og_image" | "hero" | "icon";
  sourcePage: string;
}

export function absUrl(raw: string | undefined | null, base: string): string | null {
  if (!raw) return null;
  let s = raw.trim().replace(/&amp;/g, "&");
  if (!s || s.startsWith("data:") || s.startsWith("blob:")) return null;
  // Shopify themes use "{width}" placeholders in data-src.
  s = s.replace(/\{width\}/g, "1200").replace(/_\{size\}/g, "");
  try {
    const u = new URL(s, base);
    if (u.protocol !== "http:" && u.protocol !== "https:") return null;
    return u.toString();
  } catch {
    return null;
  }
}

/** Largest candidate from a srcset string. */
export function bestFromSrcset(srcset: string | undefined): string | null {
  if (!srcset) return null;
  let best: { url: string; w: number } | null = null;
  for (const part of srcset.split(",")) {
    const [url, size] = part.trim().split(/\s+/);
    if (!url) continue;
    const w = size ? parseFloat(size) * (size.endsWith("x") ? 1000 : 1) : 0;
    if (!best || w > best.w) best = { url, w };
  }
  return best?.url ?? null;
}

function imgSrc($: CheerioRoot, el: Parameters<CheerioRoot>[0], base: string): string | null {
  const $el = $(el as never);
  const cands = [
    $el.attr("src"), $el.attr("data-src"), $el.attr("data-original"), $el.attr("data-lazy-src"),
    bestFromSrcset($el.attr("srcset")), bestFromSrcset($el.attr("data-srcset")),
  ];
  for (const c of cands) {
    const u = absUrl(c ?? null, base);
    if (u && !/\.gif(\?|$)/i.test(u) && !/placeholder|spacer|blank\./i.test(u)) return u;
  }
  return null;
}

const num = (v: string | undefined) => (v && /^\d+$/.test(v) ? Number(v) : null);

/** Every JSON-LD object on the page, flattened through @graph and arrays. */
export function jsonLd($: CheerioRoot): Record<string, unknown>[] {
  const out: Record<string, unknown>[] = [];
  const walk = (v: unknown) => {
    if (Array.isArray(v)) v.forEach(walk);
    else if (v && typeof v === "object") {
      const o = v as Record<string, unknown>;
      out.push(o);
      if (o["@graph"]) walk(o["@graph"]);
    }
  };
  $('script[type="application/ld+json"]').each((_, el) => {
    const raw = $(el).contents().text();
    try {
      walk(JSON.parse(raw));
    } catch {
      // Some sites emit trailing commas or several objects; try a light repair.
      try { walk(JSON.parse(raw.replace(/,\s*([}\]])/g, "$1"))); } catch { /* ignore */ }
    }
  });
  return out;
}

export const ldTypes = (o: Record<string, unknown>) => ([] as unknown[]).concat(o["@type"] ?? []).map(String);

function ldImageUrl(v: unknown, base: string): string | null {
  if (!v) return null;
  if (typeof v === "string") return absUrl(v, base);
  if (Array.isArray(v)) return ldImageUrl(v[0], base);
  if (typeof v === "object") {
    const o = v as Record<string, unknown>;
    return ldImageUrl(o.url ?? o.contentUrl ?? o["@id"], base);
  }
  return null;
}
export { ldImageUrl };

/**
 * Picks the brand's own logo from its homepage. Order: JSON-LD Organization logo,
 * a logo <img> in the header, og:image (often a logo or hero), then the largest icon.
 */
/** Shopify / Squarespace CDN URLs carry a size; ask for the full-size original instead. */
export function fullSizeImage(url: string): string {
  return url
    .replace(/_(\d+x\d*|\d*x\d+|pico|icon|thumb|small|compact|medium|large|grande)(@\dx)?(\.(?:png|jpe?g|webp|gif|svg))/i, "$3")
    .replace(/([?&])(width|w)=\d+&?/i, "$1")
    .replace(/[?&]$/, "");
}

export function findBrandImage($: CheerioRoot, pageUrl: string, brandName: string): BrandImage | null {
  const mk = (url: string | null, kind: BrandImage["kind"], w: number | null = null, h: number | null = null): BrandImage | null =>
    url ? { url: kind === "logo" ? fullSizeImage(url) : url, width: kind === "logo" ? null : w, height: kind === "logo" ? null : h, kind, sourcePage: pageUrl } : null;

  // 1. Header/nav logo image. Done before JSON-LD because themes often put a tiny
  //    or stale default in the Organization schema.
  const nameRe = new RegExp(brandName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/\s+/g, "\\s*"), "i");
  const selectors = [
    "header img[class*=logo i]", "header [class*=logo i] img", "header a[href='/'] img", "header a[href='./'] img",
    "img[class*=logo i]", "[class*=logo i] img", "[id*=logo i] img", "img[id*=logo i]",
    "nav img[alt]", "header img",
  ];
  for (const sel of selectors) {
    let found: BrandImage | null = null;
    $(sel).each((_, el) => {
      if (found) return;
      const src = imgSrc($, el, pageUrl);
      if (!src) return;
      const alt = $(el).attr("alt") ?? "";
      const looksLogo = /logo/i.test(src + " " + alt + " " + ($(el).attr("class") ?? "")) || nameRe.test(alt) || sel.startsWith("header a");
      if (sel === "header img" || sel === "nav img[alt]") { if (!looksLogo) return; }
      if (/payment|visa|mastercard|paypal|klarna|flag|icon-|trustpilot|badge/i.test(src + alt)) return;
      found = mk(src, "logo", num($(el).attr("width")), num($(el).attr("height")));
    });
    if (found) return found;
  }

  // 2. JSON-LD Organization / Brand logo.
  for (const o of jsonLd($)) {
    if (ldTypes(o).some((t) => /Organization|Brand|Store|LocalBusiness|Corporation/i.test(t)) && o.logo) {
      const u = ldImageUrl(o.logo, pageUrl);
      if (u) return mk(u, "logo");
    }
  }

  // 3. Open Graph image: usually a logo card or a hero shot.
  const og = absUrl($('meta[property="og:image:secure_url"]').attr("content") ?? $('meta[property="og:image"]').attr("content") ?? $('meta[name="twitter:image"]').attr("content"), pageUrl);
  if (og) {
    const w = num($('meta[property="og:image:width"]').attr("content"));
    const h = num($('meta[property="og:image:height"]').attr("content"));
    return mk(og, /logo/i.test(og) ? "logo" : "og_image", w, h);
  }

  // 4. Largest touch icon / favicon.
  let icon: { url: string; size: number } | null = null;
  $('link[rel~="apple-touch-icon"], link[rel~="icon"], link[rel="shortcut icon"]').each((_, el) => {
    const u = absUrl($(el).attr("href"), pageUrl);
    if (!u) return;
    const size = parseInt(($(el).attr("sizes") ?? "0").split("x")[0], 10) || (/apple-touch/.test($(el).attr("rel") ?? "") ? 180 : 16);
    if (!icon || size > icon.size) icon = { url: u, size };
  });
  if (icon) return mk((icon as { url: string }).url, "icon", (icon as { size: number }).size, (icon as { size: number }).size);
  return null;
}

/** Plain text of an HTML fragment, for spec extraction. */
export const htmlText = (html: string) => html.replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/\s+/g, " ").trim();

export function load(html: string): CheerioRoot {
  return cheerio.load(html);
}
