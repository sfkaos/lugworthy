// Shopify products.json puller (doc 07). Polite by default: 1 request / 2 s per domain,
// identifying User-Agent, robots.txt respected, exponential back-off on 429.

import { createHash } from "node:crypto";
import {
  caliberName, extractSpecsFromText, inferStyles, isAccessory, slugify, toComplications, toDialColor,
  toMinorUnits, toMovementType, toStrapType,
} from "./normalize";

export interface ShopifyVariant {
  id: number; title: string; sku: string | null; price: string; compare_at_price: string | null; available: boolean;
  option1: string | null; option2: string | null; option3: string | null;
}
export interface ShopifyProduct {
  id: number; title: string; handle: string; body_html: string; product_type: string; tags: string[] | string;
  variants: ShopifyVariant[]; images: { src: string; width: number; height: number }[];
}

const UA = `LugworthyBot/0.1 (+https://lugworthy.com/for-brands; ${process.env.INGEST_CONTACT_EMAIL ?? "hello@lugworthy.com"})`;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function politeFetch(url: string, attempt = 0): Promise<Response> {
  const res = await fetch(url, { headers: { "user-agent": UA, accept: "application/json" }, signal: AbortSignal.timeout(20_000) });
  if (res.status === 429 && attempt < 4) {
    const retry = Number(res.headers.get("retry-after")) || 2 ** (attempt + 2);
    await sleep(retry * 1000);
    return politeFetch(url, attempt + 1);
  }
  return res;
}

export async function robotsAllows(domain: string, path = "/products.json"): Promise<boolean> {
  try {
    const res = await politeFetch(`https://${domain}/robots.txt`);
    if (!res.ok) return true;
    const txt = await res.text();
    let applies = false;
    for (const raw of txt.split("\n")) {
      const line = raw.split("#")[0].trim();
      const [k, ...rest] = line.split(":");
      const v = rest.join(":").trim();
      if (/^user-agent$/i.test(k)) applies = v === "*" || /lugworthy/i.test(v);
      else if (applies && /^disallow$/i.test(k) && v && path.startsWith(v)) return false;
    }
    return true;
  } catch {
    return true;
  }
}

export async function isShopify(domain: string): Promise<boolean> {
  try {
    const res = await politeFetch(`https://${domain}/products.json?limit=1`);
    if (res.ok && (res.headers.get("content-type") ?? "").includes("json")) return true;
    const html = await (await politeFetch(`https://${domain}/`)).text();
    return /Shopify\.shop/.test(html);
  } catch {
    return false;
  }
}

/** All products, paging until empty; falls back to /collections/all. */
export async function pullProducts(domain: string, delayMs = 2000): Promise<ShopifyProduct[]> {
  if (!(await robotsAllows(domain))) throw new Error(`robots.txt disallows /products.json on ${domain}`);
  const out: ShopifyProduct[] = [];
  for (const base of [`https://${domain}/products.json`, `https://${domain}/collections/all/products.json`]) {
    for (let page = 1; page < 100; page++) {
      const res = await politeFetch(`${base}?limit=250&page=${page}`);
      if (!res.ok) break;
      const body = (await res.json()) as { products?: ShopifyProduct[] };
      if (!body.products?.length) break;
      out.push(...body.products);
      await sleep(delayMs);
    }
    if (out.length) break;
  }
  return out;
}

export const payloadHash = (p: ShopifyProduct) =>
  createHash("sha256").update(JSON.stringify({ t: p.title, b: p.body_html, v: p.variants.map((v) => [v.id, v.price, v.available, v.sku]) })).digest("hex");

/** Maps one product to a draft model. Low-confidence extractions go to the change queue. */
export function mapProduct(p: ShopifyProduct, domain: string, currency = "USD") {
  const tags = Array.isArray(p.tags) ? p.tags : String(p.tags ?? "").split(",").map((t) => t.trim()).filter(Boolean);
  if (isAccessory(p.title, p.product_type, tags)) return null;
  const ex = extractSpecsFromText(p.body_html ?? "");
  const options = p.variants.flatMap((v) => [v.option1, v.option2, v.option3]).filter(Boolean).join(" ");
  const complications = toComplications([], `${p.title} ${p.body_html}`);
  return {
    slug: slugify(p.handle || p.title),
    name: p.title,
    sourceUrl: `https://${domain}/products/${p.handle}`,
    styles: inferStyles({ title: p.title, tags, productType: p.product_type, wrM: ex.waterResistanceM ?? null, complications }),
    specs: {
      caseDiameterMm: ex.caseDiameterMm ?? null,
      lugToLugMm: ex.lugToLugMm ?? null,
      thicknessMm: ex.thicknessMm ?? null,
      lugWidthMm: ex.lugWidthMm ?? null,
      waterResistanceM: ex.waterResistanceM ?? null,
      caliber: ex.caliber ? caliberName(ex.caliber) : null,
      movementType: toMovementType(p.body_html, ex.caliber, tags),
      powerReserveH: ex.powerReserveH ?? null,
      complications,
      dialColor: toDialColor(options),
      strapType: toStrapType(options),
    },
    confidence: ex.confidence,
    needsReview: ex.confidence < 0.6,
    variants: p.variants.map((v, i) => ({
      shopifyVariantId: String(v.id), sku: v.sku, title: v.title, price: toMinorUnits(v.price) ?? 0, currency,
      compareAtPrice: toMinorUnits(v.compare_at_price), available: v.available, url: `https://${domain}/products/${p.handle}?variant=${v.id}`, sort: i,
    })),
    // Images are stored with rights=unknown and never shown until the brand licenses them.
    images: p.images.map((img, i) => ({ sourceUrl: img.src, width: img.width, height: img.height, rights: "unknown" as const, sort: i })),
    hash: payloadHash(p),
  };
}
