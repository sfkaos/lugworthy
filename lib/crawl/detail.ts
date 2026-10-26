// Reads a watch's product detail page: spec tables / "Label: value" lists,
// description, availability (sold out or not) and offer variants from JSON-LD.
import type { CheerioRoot } from "./html";
import { htmlText, jsonLd, ldTypes } from "./html";

export type Availability = "in_stock" | "sold_out" | "preorder" | "unknown";

export interface PageDetail {
  specsRaw: Record<string, string>;
  description: string | null;
  availability: Availability;
  ldOffers: { name: string | null; sku: string | null; price: string | null; currency: string | null; availability: Availability }[];
}

export function schemaAvailability(v: unknown): Availability {
  const s = String(v ?? "");
  if (/OutOfStock|SoldOut|Discontinued/i.test(s)) return "sold_out";
  if (/PreOrder|PreSale|BackOrder/i.test(s)) return "preorder";
  if (/InStock|LimitedAvailability|OnlineOnly|InStoreOnly/i.test(s)) return "in_stock";
  return "unknown";
}

const LABEL = /^[\p{L}][\p{L}\p{N}\s\-\/&().'’+]{0,44}$/u;
const NOISE_LABEL = /^(https?|tel|email|phone|address|copyright|shipping|returns?|subscribe|newsletter|note|tip|faq|q|a|share|search|menu|cart|login|sku|availability|vendor|categor(y|ies)|tags?)$/i;

function addPair(out: Record<string, string>, k: string, v: string) {
  const key = k.replace(/\s+/g, " ").replace(/[:：]\s*$/, "").trim();
  const val = v.replace(/\s+/g, " ").trim();
  if (!key || !val || key.length > 45 || val.length > 300) return;
  if (!LABEL.test(key) || NOISE_LABEL.test(key)) return;
  if (Object.keys(out).length >= 80) return;
  if (!(key in out)) out[key] = val;
}

/** Spec pairs from tables, definition lists, and "Label: value" lines in the product area. */
export function extractSpecPairs($: CheerioRoot): Record<string, string> {
  const out: Record<string, string> = {};
  const scope = $("main").length ? $("main") : $("body");
  scope.find("header, footer, nav, script, style, noscript, form, [class*=cart i], [class*=newsletter i], [class*=review i]").remove();

  scope.find("tr").each((_, tr) => {
    const cells = $(tr).children("th,td");
    if (cells.length === 2) addPair(out, $(cells[0]).text(), $(cells[1]).text());
  });
  scope.find("dl").each((_, dl) => {
    $(dl).children("dt").each((__, dt) => addPair(out, $(dt).text(), $(dt).nextAll("dd").first().text()));
  });
  // <li><strong>Case</strong> 40 mm steel</li> and "Case size: 40 mm" lines.
  scope.find("li, p, div, span").each((_, el) => {
    const $el = $(el);
    if ($el.children("li,p,div,ul,ol,table").length) return;
    const html = $el.html() ?? "";
    for (const line of html.split(/<br\s*\/?>/i)) {
      const strong = line.match(/^\s*<(strong|b)[^>]*>([^<]{1,45})<\/\1>\s*[:：-]?\s*(.+)$/is);
      if (strong) { addPair(out, htmlText(strong[2]), htmlText(strong[3])); continue; }
      const text = htmlText(line);
      if (text.length > 260) continue;
      const m = text.match(/^([^:：]{2,45})[:：]\s*(.{1,250})$/);
      if (m) addPair(out, m[1], m[2]);
    }
  });
  return out;
}

export function extractDetail($: CheerioRoot): PageDetail {
  const ld = jsonLd($).find((o) => ldTypes(o).some((t) => /^(Product|ProductGroup|IndividualProduct)$/i.test(t)));
  const offersRaw = ([] as unknown[]).concat(ld?.offers ?? []).flatMap((o) => {
    const r = o as Record<string, unknown>;
    return Array.isArray(r?.offers) ? (r.offers as unknown[]) : [r];
  }) as Record<string, unknown>[];
  // ProductGroup: variants live under hasVariant[].offers.
  const variantOffers = ([] as unknown[]).concat(ld?.hasVariant ?? []).map((v) => {
    const r = v as Record<string, unknown>;
    const off = ([] as unknown[]).concat(r.offers ?? [])[0] as Record<string, unknown> | undefined;
    return { name: (r.name as string) ?? null, sku: (r.sku as string) ?? null, price: off?.price != null ? String(off.price) : null, currency: (off?.priceCurrency as string) ?? null, availability: schemaAvailability(off?.availability) };
  });
  const ldOffers = variantOffers.length ? variantOffers : offersRaw.filter(Boolean).map((o) => ({
    name: (o.name as string) ?? null,
    sku: (o.sku as string) ?? null,
    price: o.price != null ? String(o.price) : o.lowPrice != null ? String(o.lowPrice) : null,
    currency: (o.priceCurrency as string) ?? null,
    availability: schemaAvailability(o.availability),
  }));

  let availability: Availability = "unknown";
  if (ldOffers.length) {
    const av = ldOffers.map((o) => o.availability);
    availability = av.includes("in_stock") ? "in_stock" : av.includes("preorder") ? "preorder" : av.every((a) => a === "sold_out") ? "sold_out" : "unknown";
  }
  if (availability === "unknown") {
    const meta = $('meta[property="product:availability"], meta[property="og:availability"]').attr("content");
    if (meta) availability = /out|sold/i.test(meta) ? "sold_out" : /pre/i.test(meta) ? "preorder" : "in_stock";
  }
  if (availability === "unknown") {
    // Visible add-to-cart button state as a last resort.
    const btn = $('button[name="add"], button[type="submit"][class*=cart i], .single_add_to_cart_button, [class*=add-to-cart i]').first();
    const btnText = btn.text().trim();
    if (btn.length) {
      if (btn.is("[disabled]") || /sold\s*out|out of stock|unavailable|épuisé|ausverkauft|agotado/i.test(btnText)) availability = "sold_out";
      else if (/pre-?order|reserve/i.test(btnText)) availability = "preorder";
      else if (/add to (cart|bag|basket)|buy now|in den warenkorb|ajouter/i.test(btnText)) availability = "in_stock";
    }
  }

  const desc = String(ld?.description ?? $('meta[property="og:description"]').attr("content") ?? $('meta[name="description"]').attr("content") ?? "");
  return {
    specsRaw: extractSpecPairs($),
    description: desc ? htmlText(desc).slice(0, 4000) : null,
    availability,
    ldOffers,
  };
}
