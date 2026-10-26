// Collections (model families, series, categories) on a brand's own site.
// A watch may belong to none, one or several collections; membership is by product URL.
import { slugify } from "../ingest/normalize";
import { allowedGet } from "./fetch";
import { absUrl, htmlText, load, type ImageRef } from "./html";

export interface CollectionDraft {
  slug: string;
  name: string;
  url: string | null;
  description: string | null;
  image: ImageRef | null;
  memberUrls: Set<string>; // normalized product URLs
}

export interface Collection {
  id: string; // BRD-0001/<slug>
  name: string;
  url: string | null;
  description: string | null;
  image: ImageRef | null;
}

const MAX_COLLECTIONS = Number(process.env.CRAWL_MAX_COLLECTIONS ?? 60);

/** Marketing or catch-all groupings that aren't real collections. */
const NOT_A_COLLECTION = /^(all|all-?products|all-?watches|shop-?all|frontpage|home|homepage|featured|best-?sell(ers?|ing)|new|new-?arrivals?|new-?in|latest|sale|on-?sale|clearance|outlet|gift(s|-?cards?|-?ideas)?|accessor(y|ies)|straps?|bands?|bracelets?|merch(andise)?|apparel|spare-?parts?|services?|uncategori[sz]ed|watches|shop|products?|collections?|catalog(ue)?|search|pre-?owned|archive|in-?stock|available(-?(now|watches|products))?|current-?(watches|collection)|all-?(timepieces|models)|coming-?soon|best-?sellers?)$/i;

export const normUrl = (u: string) => {
  try {
    const x = new URL(u);
    x.hash = "";
    x.search = "";
    return `${x.host.replace(/^www\./, "")}${x.pathname.replace(/\/+$/, "")}`.toLowerCase();
  } catch {
    return u.toLowerCase();
  }
};

export function keepCollection(slug: string, name: string): boolean {
  return !!slug && !NOT_A_COLLECTION.test(slug) && !NOT_A_COLLECTION.test(slugify(name));
}

// ---------- Shopify ----------

interface ShopifyCollection { handle: string; title: string; body_html?: string | null; image?: { src: string; width?: number; height?: number } | null }

export async function shopifyCollections(origin: string): Promise<CollectionDraft[]> {
  const list: ShopifyCollection[] = [];
  for (let page = 1; page < 6; page++) {
    const r = await allowedGet(`${origin}/collections.json?limit=250&page=${page}`, "application/json");
    if (!r?.ok || !r.contentType.includes("json")) break;
    let body: { collections?: ShopifyCollection[] };
    try { body = JSON.parse(r.text); } catch { break; }
    list.push(...(body.collections ?? []));
    if ((body.collections ?? []).length < 250) break;
  }
  const out: CollectionDraft[] = [];
  for (const c of list.filter((c) => keepCollection(c.handle, c.title)).slice(0, MAX_COLLECTIONS)) {
    const members = new Set<string>();
    for (let page = 1; page < 5; page++) {
      const r = await allowedGet(`${origin}/collections/${c.handle}/products.json?limit=250&page=${page}`, "application/json");
      if (!r?.ok || !r.contentType.includes("json")) break;
      let body: { products?: { handle: string }[] };
      try { body = JSON.parse(r.text); } catch { break; }
      for (const p of body.products ?? []) members.add(normUrl(`${origin}/products/${p.handle}`));
      if ((body.products ?? []).length < 250) break;
    }
    out.push({
      slug: slugify(c.handle),
      name: c.title.trim(),
      url: `${origin}/collections/${c.handle}`,
      description: c.body_html ? htmlText(c.body_html).slice(0, 2000) || null : null,
      image: c.image?.src ? { url: absUrl(c.image.src, origin)!, width: c.image.width ?? null, height: c.image.height ?? null } : null,
      memberUrls: members,
    });
  }
  return out;
}

// ---------- WooCommerce ----------

export interface WooCategoryRef { id: number; name: string; slug: string; link?: string }

export async function wooCollections(origin: string, products: { permalink: string; categories?: WooCategoryRef[] }[]): Promise<CollectionDraft[]> {
  const bySlug = new Map<string, CollectionDraft>();
  for (const p of products) {
    for (const c of p.categories ?? []) {
      if (!keepCollection(c.slug, c.name)) continue;
      let d = bySlug.get(c.slug);
      if (!d) {
        d = { slug: slugify(c.slug), name: htmlText(c.name), url: c.link ?? null, description: null, image: null, memberUrls: new Set() };
        bySlug.set(c.slug, d);
      }
      d.memberUrls.add(normUrl(p.permalink));
    }
  }
  // Descriptions and images, when the Store API allows it.
  const r = await allowedGet(`${origin}/wp-json/wc/store/v1/products/categories?per_page=100`, "application/json");
  if (r?.ok) {
    try {
      const cats = JSON.parse(r.text) as { slug: string; description?: string; image?: { src: string } | null; permalink?: string; link?: string }[];
      for (const c of Array.isArray(cats) ? cats : []) {
        const d = bySlug.get(c.slug);
        if (!d) continue;
        d.description = c.description ? htmlText(c.description).slice(0, 2000) || null : null;
        if (c.image?.src) d.image = { url: c.image.src, width: null, height: null };
        d.url = d.url ?? c.permalink ?? c.link ?? null;
      }
    } catch { /* ignore */ }
  }
  return [...bySlug.values()].slice(0, MAX_COLLECTIONS);
}

// ---------- Any site: listing pages ----------

/** Links that look like a collection or category listing. */
export const LISTING_PATH = /\/(collections?|categor(y|ies)|product-category|categorie|kategorie|shop|boutique|tienda|negozio|store|watches|montres|uhren|orologi|relojes|horloges|kollektion(en)?|collezion[ei]|colecci(o|ó)n(es)?|series|lines?|families|range)(\/[^/?#]+){0,2}\/?$/i;

export function listingLinks($: ReturnType<typeof load>, base: string): string[] {
  const host = new URL(base).host.replace(/^www\./, "");
  const out = new Set<string>();
  $("a[href]").each((_, el) => {
    const u = absUrl($(el).attr("href"), base);
    if (!u) return;
    const url = new URL(u);
    if (url.host.replace(/^www\./, "") !== host) return;
    url.hash = "";
    url.search = "";
    if (LISTING_PATH.test(url.pathname) && !/\/(cart|account|login|blog|news|journal|policies|search)\b/i.test(url.pathname)) out.add(url.toString());
  });
  return [...out];
}

/** Same-site links wrapped around an image: on a listing page these are almost always products. */
export function imageLinks($: ReturnType<typeof load>, base: string): string[] {
  const host = new URL(base).host.replace(/^www\./, "");
  const out = new Set<string>();
  $("a[href]").each((_, el) => {
    if (!$(el).find("img, picture, [style*=background]").length) return;
    const u = absUrl($(el).attr("href"), base);
    if (!u) return;
    const url = new URL(u);
    if (url.host.replace(/^www\./, "") !== host || url.pathname.split("/").filter(Boolean).length < 1) return;
    if (/\/(cart|account|login|blog|news|journal|policies|search|pages?|about|contact|faq|tag)\b/i.test(url.pathname)) return;
    if (/\.(jpe?g|png|webp|gif|pdf)$/i.test(url.pathname)) return;
    url.hash = "";
    out.add(url.toString());
  });
  return [...out];
}

/** Reads a listing page as a collection: its name, description, image and the product links on it. */
export function parseListing(html: string, pageUrl: string, brandName: string, productPath: RegExp): { draft: CollectionDraft; links: string[] } {
  const $ = load(html);
  const rawName = htmlText($("h1").first().text() || $('meta[property="og:title"]').attr("content") || $("title").text() || "");
  const name = rawName.split(/\s+[|–—-]\s+/)[0].trim() || rawName;
  const path = new URL(pageUrl).pathname.split("/").filter(Boolean);
  const slug = slugify(path[path.length - 1] ?? name);
  const desc = $('meta[name="description"]').attr("content") ?? $('meta[property="og:description"]').attr("content") ?? "";
  const og = absUrl($('meta[property="og:image"]').attr("content"), pageUrl);
  const host = new URL(pageUrl).host.replace(/^www\./, "");
  const links = new Set<string>(imageLinks($, pageUrl));
  $("a[href]").each((_, el) => {
    const u = absUrl($(el).attr("href"), pageUrl);
    if (!u) return;
    const url = new URL(u);
    if (url.host.replace(/^www\./, "") === host && productPath.test(url.pathname)) { url.hash = ""; url.search = ""; links.add(url.toString()); }
  });
  links.delete(pageUrl);
  return {
    draft: {
      slug,
      name: name.toLowerCase() === brandName.toLowerCase() ? slug.replace(/-/g, " ") : name,
      url: pageUrl.split("#")[0],
      description: desc ? htmlText(desc).slice(0, 2000) : null,
      image: og ? { url: og, width: null, height: null } : null,
      memberUrls: new Set(),
    },
    links: [...links],
  };
}

/** Collection drafts -> final records, keeping only collections with at least one crawled watch. */
export function finishCollections(brandId: string, drafts: CollectionDraft[], watches: { id: string; url: string; collectionIds: string[] }[]): Collection[] {
  const byUrl = new Map(watches.map((w) => [normUrl(w.url), w]));
  const out: Collection[] = [];
  const used = new Set<string>();
  for (const d of drafts) {
    const members = [...d.memberUrls].map((u) => byUrl.get(u)).filter((w): w is NonNullable<typeof w> => !!w);
    if (!members.length) continue;
    let slug = d.slug || slugify(d.name);
    if (!slug) continue;
    let n = 2;
    while (used.has(slug)) slug = `${d.slug}-${n++}`;
    used.add(slug);
    const id = `${brandId}/${slug}`;
    for (const w of members) if (!w.collectionIds.includes(id)) w.collectionIds.push(id);
    out.push({ id, name: d.name, url: d.url, description: d.description, image: d.image });
  }
  return out;
}
