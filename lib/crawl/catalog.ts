// Crawls one brand's own website for its logo and watch catalog.
// Listing: Shopify products.json, WooCommerce Store API, or product pages found
// through the sitemap / homepage. Every watch's detail page is then read for the
// full spec list, description, variants and whether it is sold out.

import { createHash } from "node:crypto";
import {
  caliberName, extractSpecsFromText, slugify, toCaseMaterial, toCrystal, toDialColor, toHours, toMinorUnits, toMovementType, toStrapType,
} from "../ingest/normalize";
import { type Availability, extractDetail, schemaAvailability } from "./detail";
import { allowedGet, getRobots, politeGet, robotsAllowsPath, type FetchResult } from "./fetch";
import { absUrl, findBrandImage, htmlText, jsonLd, ldImageUrl, ldTypes, load, type BrandImage, type ImageRef } from "./html";

export type { Availability } from "./detail";
export type CrawlStatus = "ok" | "no_website" | "robots_disallowed" | "blocked_by_site" | "unreachable" | "no_catalog_found";

export interface WatchSpecs {
  caseDiameterMm: number | null;
  lugWidthMm: number | null;
  lugToLugMm: number | null;
  thicknessMm: number | null;
  waterResistanceM: number | null;
  caliber: string | null;
  movementType: string | null;
  powerReserveH: number | null;
  caseMaterial: string | null;
  crystal: string | null;
  dialColor: string | null;
  strapType: string | null;
}

export interface WatchVariant {
  title: string;
  sku: string | null;
  priceMinor: number | null; // price × 100 in `currency`
  compareAtMinor: number | null;
  available: boolean | null;
  options: string[]; // e.g. ["38mm", "Blue", "Bracelet"]
}

export interface Watch {
  id: string; // BRD-0001/<slug>
  name: string;
  url: string;
  image: ImageRef | null;
  images: ImageRef[];
  priceMinor: number | null; // lowest variant price × 100
  currency: string | null;
  /** in_stock | sold_out | preorder | unknown, from the brand's own page. */
  availability: Availability;
  soldOut: boolean | null;
  available: boolean | null; // kept for older readers; = !soldOut
  availabilityCheckedAt: string;
  /** One entry per change in availability, oldest first. */
  availabilityHistory: { at: string; availability: Availability }[];
  description: string | null;
  productType: string | null;
  tags: string[];
  options: { name: string; values: string[] }[]; // sizes, colours, straps on offer
  variants: WatchVariant[];
  specs: WatchSpecs;
  /** Every "label: value" spec found on the detail page, as written by the brand. */
  specsRaw: Record<string, string>;
  hash: string;
}

export interface BrandCatalog {
  brandId: string;
  brandName: string;
  website: string | null;
  crawledAt: string;
  status: CrawlStatus;
  platform: "shopify" | "woocommerce" | "html" | null;
  brandImage: BrandImage | null;
  attribution: string | null;
  imageRights: "unknown";
  watches: Watch[];
  note?: string;
}

export interface BrandInput { brandId: string; name: string; website: string }

type DraftWatch = Omit<Watch, "id" | "hash" | "availabilityHistory" | "availabilityCheckedAt" | "soldOut" | "available">;

const MAX_WATCHES = Number(process.env.CRAWL_MAX_WATCHES ?? 400);
const MAX_HTML_PAGES = Number(process.env.CRAWL_MAX_PAGES ?? 60);
const MAX_DETAIL_PAGES = Number(process.env.CRAWL_MAX_DETAIL_PAGES ?? 250);

// ---------- watch vs. accessory ----------

const NOT_WATCH_TYPE = /strap|band|bracelet|accessor|apparel|clothing|merch|gift|tool|book|print|poster|service|warranty|insurance|shipping|deposit|spare|part|box|case only|winder|cleaning|sticker|shirt|hoodie|hat|cap|bag|wallet|pouch|roll|buckle|cufflink|jewel|ring|necklace/i;
const NOT_WATCH_TITLE = /\b(strap|straps|band|nato|rubber strap|leather strap|bracelet only|extra link|links?|spring ?bars?|buckle|clasp|deployant|gift ?card|e-?gift|voucher|t-?shirt|tee|hoodie|sweatshirt|cap|hat|beanie|keychain|key ?ring|sticker|poster|print|book|pouch|watch roll|travel case|watch box|winder|cleaning|cloth|tool|screwdriver|service|servicing|repair|warranty|insurance|shipping|deposit|reservation fee|spare|replacement|crystal only|crown only|bezel insert|mug|socks|tote|lanyard|pin|patch|coaster|wallpaper|membership|subscription|donation|tip)\b|pens?|fountain pen|rollerball|ballpoint|錶帶|表带|錶扣|筆|回娘家|ストラップ|ベルト|バンド|armband|bracelet en cuir|correa|cinturino|pulseira/i;

export function looksLikeWatch(title: string, productType = "", tags: string[] = [], priceMinor: number | null = null): boolean {
  const t = title.toLowerCase();
  if (NOT_WATCH_TITLE.test(t) && !/\bwatch\b|chronograph|automatic|diver/i.test(t.replace(/watch (box|roll|winder|strap|band)/g, ""))) return false;
  if (productType && NOT_WATCH_TYPE.test(productType) && !/watch|timepiece|montre|uhr|reloj/i.test(productType)) return false;
  if (tags.some((g) => /^(strap|straps|accessor(y|ies)|apparel|merch|gift ?card)$/i.test(g)) && !tags.some((g) => /^watch(es)?$/i.test(g))) return false;
  // Very cheap items are almost never watches from independent brands (straps, stickers, deposits).
  if (priceMinor != null && priceMinor > 0 && priceMinor < 3000) return false;
  return true;
}

// ---------- specs ----------

const inRange = (v: number | null | undefined, lo: number, hi: number) => (v != null && v >= lo && v <= hi ? v : null);

/** Normalized specs from free text plus the brand's own label/value pairs (pairs win). */
// Spec labels in other languages, mapped to the English wording the extractor knows.
const LABEL_ALIASES: [RegExp, string][] = [
  [/lug[\s-]*to[\s-]*lug|corne\s*à\s*corne|horn[\s-]*zu[\s-]*horn|länge|de\s*asa\s*a\s*asa|lunghezza|ansa/i, "Lug to lug"],
  [/lug\s*width|entre[\s-]*cornes?|entrecorne|anstoß|anstoss|bandbreite|ancho\s*de\s*(la\s*)?(correa|asa)|larghezza\s*ansa|strap\s*width|band\s*width/i, "Lug width"],
  [/diam[eèé]t(er|re|ro)|durchmesser|gehäusegröße|case\s*size|taille\s*du\s*boîtier|tamaño|dimensione/i, "Case diameter"],
  [/thickness|[ée]paisseur|höhe|dicke|espesor|grosor|spessore|altura|height/i, "Thickness"],
  [/water|[ée]tanch[ée]it[ée]|wasserdicht|resistencia\s*al\s*agua|impermeabilit|hermeticidad/i, "Water resistance"],
  [/power\s*reserve|r[ée]serve\s*de\s*marche|gangreserve|reserva\s*de\s*marcha|riserva\s*di\s*carica/i, "Power reserve"],
];

function canonicalPairs(raw: Record<string, string>): string {
  return Object.entries(raw).map(([k, v]) => {
    const alias = LABEL_ALIASES.find(([re]) => re.test(k))?.[1];
    return `${alias ?? k}: ${v}`;
  }).join(". ");
}

export function specsFrom(text: string, raw: Record<string, string> = {}, tags: string[] = []): WatchSpecs {
  const pairsText = canonicalPairs(raw);
  const fromPairs = extractSpecsFromText(pairsText);
  const fromText = extractSpecsFromText(text);
  const ex = { ...fromText, ...Object.fromEntries(Object.entries(fromPairs).filter(([, v]) => v != null)) };
  const all = `${pairsText} ${htmlText(text)}`;
  const find = (re: RegExp) => Object.entries(raw).find(([k]) => re.test(k) || re.test(LABEL_ALIASES.find(([a]) => a.test(k))?.[1] ?? ""))?.[1] ?? null;
  const lugRaw = find(/lug\s*width|band\s*width|strap\s*width|horn\s*width|bandanstoss/i);
  const lug = (lugRaw ? Number(lugRaw.match(/(\d{2})/)?.[1]) : 0) || ex.lugWidthMm || Number(all.match(/(\d{2})\s*mm\s*lug(?:\s*width)?\b/i)?.[1]) || null;
  const dia = ex.caseDiameterMm ?? (Number(find(/^(case\s*)?(size|diameter|dimensions?)$|case\s*(size|diameter)/i)?.match(/(\d{2}(?:[.,]\d)?)/)?.[1]?.replace(",", ".")) || null);
  const crystal = toCrystal(find(/crystal|glass|verre|glas/i) ?? ex.crystal ?? null);
  return {
    caseDiameterMm: inRange(dia, 24, 60),
    lugWidthMm: inRange(lug, 8, 30),
    lugToLugMm: inRange(ex.lugToLugMm, 25, 70),
    thicknessMm: inRange(ex.thicknessMm, 3, 25),
    waterResistanceM: inRange(ex.waterResistanceM, 10, 12000),
    caliber: ex.caliber ? caliberName(ex.caliber) ?? ex.caliber : null,
    movementType: toMovementType(find(/movement|calib|mouvement|uhrwerk/i) ?? all, ex.caliber, tags),
    powerReserveH: inRange(ex.powerReserveH ?? toHours(find(/power\s*reserve|autonomy|réserve/i)), 10, 2000),
    caseMaterial: toCaseMaterial(find(/^case(\s*material)?$|case\s*material|material/i) ?? null),
    crystal: crystal.material,
    dialColor: toDialColor(find(/dial(\s*colou?r)?$|dial/i) ?? null),
    strapType: toStrapType(find(/strap|bracelet|band/i) ?? null),
  };
}

const hashOf = (o: unknown) => createHash("sha256").update(JSON.stringify(o)).digest("hex").slice(0, 16);

function finishWatch(brandId: string, w: DraftWatch, seen: Set<string>, checkedAt: string): Watch | null {
  let slug = slugify(new URL(w.url).pathname.split("/").filter(Boolean).pop() || w.name) || slugify(w.name);
  if (!slug) return null;
  let n = 2;
  while (seen.has(slug)) slug = `${slug}-${n++}`;
  seen.add(slug);
  const soldOut = w.availability === "sold_out" ? true : w.availability === "unknown" ? null : false;
  const body = { ...w, image: w.image ?? w.images[0] ?? null };
  return {
    id: `${brandId}/${slug}`,
    ...body,
    soldOut,
    available: soldOut == null ? null : !soldOut,
    availabilityCheckedAt: checkedAt,
    availabilityHistory: [{ at: checkedAt, availability: w.availability }],
    hash: hashOf({ ...body, images: body.images.map((i) => i.url) }),
  };
}

/** Folds variant availability into one status. */
export function rollUpAvailability(variants: { available: boolean | null }[], fallback: Availability = "unknown"): Availability {
  if (!variants.length || variants.every((v) => v.available == null)) return fallback;
  return variants.some((v) => v.available) ? "in_stock" : "sold_out";
}

/** Reads the detail page and merges its specs, description and availability into the draft. */
async function enrich(w: DraftWatch): Promise<DraftWatch> {
  const r = await allowedGet(w.url);
  if (!r?.ok || !/html/i.test(r.contentType)) return w;
  const d = extractDetail(load(r.text));
  const specsRaw = { ...w.specsRaw, ...d.specsRaw };
  // A storefront API "available" flag beats page heuristics; the page fills unknowns.
  const availability = w.availability !== "unknown" ? (w.availability === "in_stock" && d.availability === "preorder" ? "preorder" : w.availability) : d.availability;
  return {
    ...w,
    description: w.description ?? d.description,
    specsRaw,
    specs: specsFrom(`${w.description ?? ""} ${d.description ?? ""}`, specsRaw, w.tags),
    availability,
  };
}

// ---------- Shopify ----------

interface ShopifyProduct {
  title: string; handle: string; body_html: string | null; product_type: string; tags: string[] | string;
  options?: { name: string; values: string[] }[];
  variants: { title: string; sku: string | null; price: string; compare_at_price: string | null; available?: boolean; option1: string | null; option2: string | null; option3: string | null }[];
  images: { src: string; width?: number; height?: number }[];
}

export function mapShopifyProduct(p: ShopifyProduct, origin: string, currency: string | null): DraftWatch | null {
  const tags = Array.isArray(p.tags) ? p.tags : String(p.tags ?? "").split(",").map((t) => t.trim()).filter(Boolean);
  const variants: WatchVariant[] = p.variants.map((v) => ({
    title: v.title,
    sku: v.sku || null,
    priceMinor: toMinorUnits(v.price),
    compareAtMinor: toMinorUnits(v.compare_at_price),
    available: v.available ?? null,
    options: [v.option1, v.option2, v.option3].filter((o): o is string => !!o && o !== "Default Title"),
  }));
  const prices = variants.map((v) => v.priceMinor).filter((x): x is number => x != null && x > 0);
  const priceMinor = prices.length ? Math.min(...prices) : null;
  if (!looksLikeWatch(p.title, p.product_type, tags, priceMinor)) return null;
  const images = (p.images ?? []).slice(0, 12).map((i) => ({ url: absUrl(i.src, origin)!, width: i.width ?? null, height: i.height ?? null })).filter((i) => i.url);
  const description = p.body_html ? htmlText(p.body_html).slice(0, 4000) : null;
  const specsRaw = p.body_html ? extractDetail(load(`<main>${p.body_html}</main>`)).specsRaw : {};
  return {
    name: p.title.trim(),
    url: `${origin}/products/${p.handle}`,
    image: images[0] ?? null,
    images,
    priceMinor,
    currency,
    availability: rollUpAvailability(variants),
    description,
    productType: p.product_type || null,
    tags,
    options: (p.options ?? []).filter((o) => !(o.values.length === 1 && o.values[0] === "Default Title")).map((o) => ({ name: o.name, values: o.values })),
    variants: variants.length === 1 && !variants[0].options.length ? [] : variants,
    specs: specsFrom(p.body_html ?? "", specsRaw, tags),
    specsRaw,
  };
}

async function tryShopify(origin: string, currencyHint: string | null): Promise<DraftWatch[] | null> {
  const first = await allowedGet(`${origin}/products.json?limit=250&page=1`, "application/json");
  if (!first || !first.ok || !first.contentType.includes("json")) return null;
  let body: { products?: ShopifyProduct[] };
  try { body = JSON.parse(first.text); } catch { return null; }
  if (!Array.isArray(body.products)) return null;
  const all: ShopifyProduct[] = [...body.products];
  for (let page = 2; page < 20 && body.products?.length === 250; page++) {
    const r = await allowedGet(`${origin}/products.json?limit=250&page=${page}`, "application/json");
    if (!r?.ok) break;
    try { body = JSON.parse(r.text); } catch { break; }
    all.push(...(body.products ?? []));
  }
  return all.map((p) => mapShopifyProduct(p, origin, currencyHint)).filter((w): w is DraftWatch => !!w).slice(0, MAX_WATCHES);
}

// ---------- WooCommerce Store API ----------

interface WooProduct {
  id: number; name: string; slug: string; permalink: string; description?: string; short_description?: string; is_in_stock?: boolean; is_purchasable?: boolean;
  images?: { src: string }[];
  prices?: { price: string; regular_price?: string; sale_price?: string; currency_code: string; currency_minor_unit: number };
  categories?: { name: string }[]; tags?: { name: string }[]; type?: string; sku?: string;
  attributes?: { name: string; terms?: { name: string }[] }[];
  variations?: { id: number; attributes: { name: string; value: string }[] }[];
}

const wooMinor = (p: WooProduct["prices"], key: "price" | "regular_price" = "price") =>
  p && p[key] ? Math.round((Number(p[key]) * 100) / 10 ** (p.currency_minor_unit ?? 2)) : null;

export function mapWooProduct(p: WooProduct): DraftWatch | null {
  const cats = (p.categories ?? []).map((c) => htmlText(c.name));
  const tags = (p.tags ?? []).map((t) => htmlText(t.name));
  const minor = wooMinor(p.prices);
  const name = htmlText(p.name);
  if (!looksLikeWatch(name, cats.join(" "), [...cats, ...tags], minor)) return null;
  const images = (p.images ?? []).slice(0, 12).map((i) => ({ url: i.src, width: null, height: null })).filter((i) => /^https?:/.test(i.url));
  const descHtml = `${p.short_description ?? ""} ${p.description ?? ""}`;
  const specsRaw: Record<string, string> = { ...extractDetail(load(`<main>${descHtml}</main>`)).specsRaw };
  for (const a of p.attributes ?? []) if (a.terms?.length) specsRaw[htmlText(a.name)] ??= a.terms.map((t) => htmlText(t.name)).join(", ");
  const regular = wooMinor(p.prices, "regular_price");
  return {
    name,
    url: p.permalink,
    image: images[0] ?? null,
    images,
    priceMinor: minor,
    currency: p.prices?.currency_code ?? null,
    availability: p.is_in_stock == null ? "unknown" : p.is_in_stock ? "in_stock" : "sold_out",
    description: htmlText(descHtml).slice(0, 4000) || null,
    productType: cats[0] ?? null,
    tags,
    options: (p.attributes ?? []).filter((a) => (a.terms?.length ?? 0) > 1).map((a) => ({ name: htmlText(a.name), values: a.terms!.map((t) => htmlText(t.name)) })),
    variants: regular && minor && regular !== minor
      ? [{ title: name, sku: p.sku || null, priceMinor: minor, compareAtMinor: regular, available: p.is_in_stock ?? null, options: [] }]
      : [],
    specs: specsFrom(descHtml, specsRaw, cats),
    specsRaw,
  };
}

async function tryWoo(origin: string): Promise<DraftWatch[] | null> {
  const first = await allowedGet(`${origin}/wp-json/wc/store/v1/products?per_page=100&page=1`, "application/json");
  if (!first || !first.ok || !first.contentType.includes("json")) return null;
  let list: WooProduct[];
  try { list = JSON.parse(first.text); } catch { return null; }
  if (!Array.isArray(list)) return null;
  const all = [...list];
  for (let page = 2; page < 10 && list.length === 100; page++) {
    const r = await allowedGet(`${origin}/wp-json/wc/store/v1/products?per_page=100&page=${page}`, "application/json");
    if (!r?.ok) break;
    try { list = JSON.parse(r.text); } catch { break; }
    if (!Array.isArray(list)) break;
    all.push(...list);
  }
  return all.map(mapWooProduct).filter((w): w is DraftWatch => !!w).slice(0, MAX_WATCHES);
}

// ---------- Generic HTML (sitemap + JSON-LD) ----------

const PRODUCT_PATH = /\/(products?|shop|store|watch(es)?|timepieces?|collections\/[^/]+\/products|montres?|uhren|relojes|orologi|item|p)\/[^/?#]+\/?$/i;
// Brands without a shop often have one page per model: /watches/the-carter, /collections/architect.
const MODEL_PATH = /\/(watches|watch|collections?|models?|timepieces?|montres?|uhren|relojes|orologi|series)\/[^/?#]+\/?$/i;
const SKIP_PATH = /\/(cart|account|login|blog|news|journal|pages?|policies|search|tag|category|categories|collections?\/?$)/i;

async function sitemapUrls(origin: string, extra: string[]): Promise<string[]> {
  const queue = [...new Set([...extra, `${origin}/sitemap.xml`, `${origin}/sitemap_index.xml`])];
  const seenMaps = new Set<string>();
  const urls: string[] = [];
  while (queue.length && seenMaps.size < 8) {
    const sm = queue.shift()!;
    if (seenMaps.has(sm)) continue;
    seenMaps.add(sm);
    let r: FetchResult | null;
    try { r = await allowedGet(sm, "application/xml,text/xml"); } catch { continue; }
    if (!r?.ok || !/<(urlset|sitemapindex)/i.test(r.text)) continue;
    const locs = [...r.text.matchAll(/<loc>\s*(?:<!\[CDATA\[)?([^<\]]+)/gi)].map((m) => m[1].trim());
    if (/<sitemapindex/i.test(r.text)) {
      // Product sitemaps first, then anything that isn't obviously posts/images.
      const sorted = locs.filter((l) => !/post|blog|image|video|author|tag|category/i.test(l)).sort((a, b) => Number(/product/i.test(b)) - Number(/product/i.test(a)));
      queue.unshift(...sorted.slice(0, 5));
    } else {
      urls.push(...locs);
    }
  }
  return urls;
}

function productUrlsFromHome($: ReturnType<typeof load>, base: string, re = PRODUCT_PATH): string[] {
  const host = new URL(base).host;
  const out = new Set<string>();
  $("a[href]").each((_, el) => {
    const u = absUrl($(el).attr("href"), base);
    if (!u) return;
    const url = new URL(u);
    if (url.host !== host) return;
    url.hash = "";
    url.search = "";
    if (re.test(url.pathname) && !SKIP_PATH.test(url.pathname) && !/\/(all|accessories|straps|gift)/i.test(url.pathname)) out.add(url.toString());
  });
  return [...out];
}

/** "Mark III GMT — Höglund & Sons" -> "Mark III GMT" */
export function stripSiteSuffix(name: string, siteName?: string): string {
  let n = name.replace(/\s+/g, " ").trim();
  const parts = n.split(/\s+[|–—-]\s+/);
  if (parts.length > 1) {
    const last = parts[parts.length - 1].toLowerCase();
    if ((siteName && last.includes(siteName.toLowerCase().slice(0, 6))) || last.split(" ").length <= 4) n = parts.slice(0, -1).join(" - ");
  }
  return n;
}

export function parseProductPage(html: string, pageUrl: string, brandName: string, allowModelPage = false): DraftWatch | null {
  const $ = load(html);
  const ld = jsonLd($).find((o) => ldTypes(o).some((t) => /^(Product|ProductGroup|IndividualProduct)$/i.test(t)));
  const ogType = $('meta[property="og:type"]').attr("content") ?? "";
  if (!ld && !/product/i.test(ogType) && !allowModelPage) return null;
  const rawName = htmlText(String(ld?.name ?? (allowModelPage ? $("h1").first().text() || $('meta[property="og:title"]').attr("content") : $('meta[property="og:title"]').attr("content") ?? $("h1").first().text()) ?? "")).trim();
  let name = stripSiteSuffix(rawName, $('meta[property="og:site_name"]').attr("content") ?? brandName);
  if (name.toLowerCase() === brandName.toLowerCase()) name = "";
  if (!name || name.length > 140) return null;
  const imgs: ImageRef[] = [];
  const ldImgs = ld?.image ? ([] as unknown[]).concat(ld.image) : [];
  for (const i of ldImgs.slice(0, 12)) {
    const u = ldImageUrl(i, pageUrl);
    if (u && !imgs.some((x) => x.url === u)) imgs.push({ url: u, width: null, height: null });
  }
  if (!imgs.length) {
    const og = absUrl($('meta[property="og:image:secure_url"]').attr("content") ?? $('meta[property="og:image"]').attr("content"), pageUrl);
    if (og) imgs.push({ url: og, width: null, height: null });
  }
  if (!imgs.length) return null;
  const metaPrice = $('meta[property="product:price:amount"]').attr("content") ?? $('meta[property="og:price:amount"]').attr("content");
  const metaCurrency = $('meta[property="product:price:currency"]').attr("content") ?? $('meta[property="og:price:currency"]').attr("content");
  const bodyText = ($("main").text() || $("body").text()).slice(0, 40_000);
  const d = extractDetail($); // last: it trims page chrome from $
  const variants: WatchVariant[] = d.ldOffers.length > 1
    ? d.ldOffers.map((o) => ({ title: o.name ?? name, sku: o.sku, priceMinor: toMinorUnits(o.price), compareAtMinor: null, available: o.availability === "unknown" ? null : o.availability !== "sold_out", options: [] }))
    : [];
  const prices = d.ldOffers.map((o) => toMinorUnits(o.price)).filter((x): x is number => x != null && x > 0);
  const tags: string[] = [];
  return {
    name,
    url: pageUrl.split("#")[0],
    image: imgs[0] ?? null,
    images: imgs,
    priceMinor: prices.length ? Math.min(...prices) : toMinorUnits(metaPrice),
    currency: d.ldOffers.find((o) => o.currency)?.currency ?? metaCurrency ?? null,
    availability: d.availability,
    description: d.description,
    productType: null,
    tags,
    options: [],
    variants,
    specs: specsFrom(`${d.description ?? ""} ${bodyText}`, d.specsRaw),
    specsRaw: d.specsRaw,
  };
}

async function tryHtml(origin: string, homeHtml: string, homeUrl: string, brand: BrandInput): Promise<DraftWatch[]> {
  const robots = await getRobots(origin);
  const host = new URL(origin).host.replace(/^www\./, "");
  const mapUrls = await sitemapUrls(origin, robots.sitemaps);
  const sameHost = (u: string) => { try { return new URL(u).host.replace(/^www\./, "") === host; } catch { return false; } };
  const pick = (re: RegExp) => (u: string) => { try { const p = new URL(u).pathname; return re.test(p) && !SKIP_PATH.test(p); } catch { return false; } };
  // Prefer English pages when a site lists every locale.
  const foreign = (u: string) => Number(/\/(fr|de|es|it|ja|zh|nl|pt|ko)(-[a-z]{2})?\//i.test(u));
  const homeDom = load(homeHtml);
  const seenNames = new Set<string>();
  const out: DraftWatch[] = [];
  const run = async (urls: string[], allowModel: boolean) => {
    for (const u of [...new Set(urls)].sort((a, b) => foreign(a) - foreign(b)).slice(0, MAX_HTML_PAGES)) {
      const r = await allowedGet(u);
      if (!r?.ok || !/html/i.test(r.contentType)) continue;
      const p = parseProductPage(r.text, r.url, brand.name, allowModel);
      if (!p || !looksLikeWatch(p.name, "", [], p.priceMinor)) continue;
      const key = p.name.toLowerCase();
      if (seenNames.has(key)) continue;
      seenNames.add(key);
      out.push(p);
    }
  };
  await run([...mapUrls.filter(sameHost).filter(pick(PRODUCT_PATH)), ...productUrlsFromHome(homeDom, homeUrl)], false);
  if (!out.length) {
    // No shop pages: fall back to one page per model.
    await run([...productUrlsFromHome(homeDom, homeUrl, MODEL_PATH), ...mapUrls.filter(sameHost).filter(pick(MODEL_PATH))], true);
  }
  return out;
}

// ---------- entry point ----------

export function normalizeSite(website: string): string | null {
  const s = website.trim().split(/[\s,;]+/)[0];
  if (!s) return null;
  try {
    const u = new URL(/^https?:\/\//i.test(s) ? s : `https://${s}`);
    return u.origin;
  } catch {
    return null;
  }
}

export function shopifyCurrency(html: string, $: ReturnType<typeof load>): string | null {
  return html.match(/Shopify\.currency\s*=\s*\{[^}]*"active"\s*:\s*"([A-Z]{3})"/)?.[1]
    ?? html.match(/"currencyCode"\s*:\s*"([A-Z]{3})"/)?.[1]
    ?? $('meta[property="og:price:currency"]').attr("content") ?? null;
}

export async function crawlBrand(brand: BrandInput): Promise<BrandCatalog> {
  const checkedAt = new Date().toISOString();
  const base: BrandCatalog = {
    brandId: brand.brandId,
    brandName: brand.name,
    website: brand.website || null,
    crawledAt: checkedAt,
    status: "no_website",
    platform: null,
    brandImage: null,
    attribution: null,
    imageRights: "unknown",
    watches: [],
  };
  let origin = brand.website ? normalizeSite(brand.website) : null;
  if (!origin) return base;

  // Homepage (follows redirects to the canonical host, e.g. www.).
  const robots = await getRobots(origin);
  if (!robotsAllowsPath(robots, "/")) return { ...base, status: "robots_disallowed", note: "robots.txt disallows the homepage" };
  let home = await politeGet(origin + "/");
  if (!home.ok && !home.challenged && origin.startsWith("https://")) home = await politeGet(origin.replace("https://", "http://") + "/");
  if (home.challenged) return { ...base, status: "blocked_by_site", note: "site answered with a bot check (captcha); not bypassed" };
  if (!home.ok) return { ...base, status: "unreachable", note: `homepage returned ${home.status || home.text.slice(0, 80)}` };
  origin = new URL(home.url).origin;
  const domain = new URL(origin).host.replace(/^www\./, "");

  const $ = load(home.text);
  const brandImage = findBrandImage($, home.url, brand.name);

  let platform: BrandCatalog["platform"] = null;
  let drafts: DraftWatch[] | null = null;
  const isShopify = /cdn\.shopify\.com|Shopify\.shop|shopify-section/i.test(home.text);
  const isWoo = /woocommerce|wp-content\/plugins\/woocommerce/i.test(home.text);

  if (isShopify || !isWoo) {
    drafts = await tryShopify(origin, shopifyCurrency(home.text, $));
    if (drafts) platform = "shopify";
  }
  if (!drafts && isWoo) {
    drafts = await tryWoo(origin);
    if (drafts) platform = "woocommerce";
  }
  if (drafts?.length) {
    // Storefront APIs give the list; the detail pages add the full spec sheet.
    const enriched: DraftWatch[] = [];
    for (const [i, d] of drafts.entries()) enriched.push(i < MAX_DETAIL_PAGES ? await enrich(d) : d);
    drafts = enriched;
  } else {
    const html = await tryHtml(origin, home.text, home.url, brand);
    if (html.length || !drafts) { drafts = html; platform = platform ?? "html"; }
  }

  const seen = new Set<string>();
  const watches = drafts.map((d) => finishWatch(brand.brandId, d, seen, checkedAt)).filter((w): w is Watch => !!w);
  return {
    ...base,
    website: origin,
    status: watches.length ? "ok" : "no_catalog_found",
    platform,
    brandImage,
    attribution: `Images © ${brand.name}, from ${domain}`,
    watches,
  };
}

/** Carries availability history and stored image copies over from the previous crawl. */
export function mergeWithPrevious(cat: BrandCatalog, prev: BrandCatalog | null): BrandCatalog {
  if (!prev) return cat;
  const before = new Map(prev.watches.map((w) => [w.id, w]));
  for (const w of cat.watches) {
    const p = before.get(w.id);
    if (!p) continue;
    const hist = [...(p.availabilityHistory ?? [])];
    const last = hist[hist.length - 1];
    if (!last || last.availability !== w.availability) hist.push({ at: w.availabilityCheckedAt, availability: w.availability });
    w.availabilityHistory = hist;
  }
  return cat;
}

export { schemaAvailability };
