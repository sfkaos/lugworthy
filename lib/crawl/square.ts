// Square Online stores (also Weebly sites with a store). Their pages load products with
// JavaScript, but the store has a public JSON feed keyed by the owner's user id and site id,
// which every store page carries in its bootstrap data.
import { allowedGet } from "./fetch";
import { absUrl, htmlText, load } from "./html";

export interface SquareIds { userId: string; siteId: string; currency: string | null }

export interface SquareProduct {
  name: string;
  visibility?: string;
  absolute_site_link?: string | null;
  short_description?: string | null;
  product_type?: string | null;
  price?: { low_subunits?: number | null; high_subunits?: number | null } | null;
  images?: { data?: { absolute_url?: string | null; url?: string | null }[] } | null;
  badges?: { out_of_stock?: boolean } | null;
  inventory?: { all_variations_sold_out?: boolean } | null;
}

const API = "https://cdn5.editmysite.com/app/store/api/v28/editor/users";
const MAX_PAGES = 10;

/** True when the page was built with Square Online or Weebly. */
export function isSquareSite(html: string): boolean {
  return /editmysite\.com|\.square\.site\b/i.test(html);
}

/** The store's user id, site id and currency, from a Square Online or Weebly page. */
export function squareIds(html: string): SquareIds | null {
  const userId = html.match(/"user":\{"id":"?(\d{5,})/)?.[1] ?? html.match(/\buser_id\s*=\s*['"](\d{5,})/)?.[1];
  const siteId = html.match(/"site_id":"?(\d{6,})/)?.[1] ?? html.match(/\bsite_id\s*=\s*['"](\d{6,})/)?.[1];
  if (!userId || !siteId) return null;
  const currency = html.match(/_W\.storeCurrency\s*=\s*["']([A-Z]{3})/)?.[1] ?? html.match(/"currency":"([A-Z]{3})"/)?.[1] ?? null;
  return { userId, siteId, currency };
}

/** Pages on the brand's site that may hold the store's ids: a linked *.square.site shop, then /store/ pages. */
export function squareStorePages(html: string, base: string): string[] {
  const $ = load(html);
  const host = new URL(base).host.replace(/^www\./, "");
  const shops: string[] = [];
  const store: string[] = [];
  $("a[href]").each((_, el) => {
    const u = absUrl($(el).attr("href"), base);
    if (!u) return;
    const url = new URL(u);
    if (/\.square\.site$/i.test(url.host)) shops.push(url.origin + "/");
    else if (url.host.replace(/^www\./, "") === host && /^\/(store|shop)(\/|\.html|$)/i.test(url.pathname)) store.push(url.toString());
  });
  return [...new Set([...shops, ...store])].slice(0, 3);
}

/** Every visible product in the store, or null when the feed can't be read. */
export async function fetchSquareProducts(ids: SquareIds): Promise<SquareProduct[] | null> {
  const out: SquareProduct[] = [];
  for (let page = 1; page <= MAX_PAGES; page++) {
    const r = await allowedGet(`${API}/${ids.userId}/sites/${ids.siteId}/products?page=${page}&per_page=100&include=images`, "application/json");
    if (!r?.ok) return page === 1 ? null : out;
    let body: { data?: SquareProduct[]; meta?: { pagination?: { total_pages?: number } } };
    try { body = JSON.parse(r.text); } catch { return page === 1 ? null : out; }
    out.push(...(body.data ?? []).filter((p) => p.visibility !== "hidden"));
    if (page >= (body.meta?.pagination?.total_pages ?? 1)) break;
  }
  return out;
}

/** The fields a Square product gives directly; the caller filters accessories and adds specs. */
export function squareFields(p: SquareProduct) {
  const images = (p.images?.data ?? [])
    .map((i) => i.absolute_url || i.url || "")
    .filter((u) => /^https?:/.test(u))
    .slice(0, 12)
    .map((url) => ({ url, width: null, height: null }));
  const low = p.price?.low_subunits ?? null;
  const soldOut = p.badges?.out_of_stock ?? p.inventory?.all_variations_sold_out ?? null;
  return {
    name: htmlText(p.name),
    url: p.absolute_site_link ?? null,
    images,
    priceMinor: low && low > 0 ? low : null,
    availability: soldOut == null ? ("unknown" as const) : soldOut ? ("sold_out" as const) : ("in_stock" as const),
    descHtml: p.short_description ?? "",
  };
}
