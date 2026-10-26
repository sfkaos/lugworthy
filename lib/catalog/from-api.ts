// Builds the site's catalog from the public API (api.lugworthy.com), so lugworthy.com reads its
// brands and watches the same way any other service would. Used by getCatalog() when
// LUGWORTHY_API_URL is set; lib/data.ts falls back to the database if the API can't be reached.

import { BRANDS_TAG } from "@/lib/brands/source";
import type { ApiBrandFull, ApiWatchFull } from "@/lib/brands/api";
import type { CatalogIndex } from "@/lib/brands/media";
import type { Brand, Model } from "@/lib/types";

const PAGE = 200; // the API's max page size

export interface ApiSource {
  baseUrl: string; // e.g. https://api.lugworthy.com
  token: string;
}

export function apiSourceFromEnv(env: Record<string, string | undefined> = process.env): ApiSource | null {
  const baseUrl = env.LUGWORTHY_API_URL?.trim().replace(/\/+$/, "");
  const token = env.BRANDS_API_TOKEN?.trim();
  return baseUrl && token ? { baseUrl, token } : null;
}

type Fetch = typeof fetch;
interface Page<T> { data: T[]; meta: { pages: number; syncedAt?: string | null } }

async function getPage<T>(src: ApiSource, path: string, page: number, f: Fetch): Promise<Page<T>> {
  const url = `${src.baseUrl}${path}${path.includes("?") ? "&" : "?"}detail=full&limit=${PAGE}&page=${page}`;
  const res = await f(url, {
    headers: { authorization: `Bearer ${src.token}`, accept: "application/json" },
    // Cached for a minute and dropped by the sync job (revalidateTag), like the database read.
    next: { revalidate: 60, tags: [BRANDS_TAG] },
  } as RequestInit);
  if (!res.ok) throw new Error(`${url.replace(src.baseUrl, "")} returned ${res.status}`);
  return (await res.json()) as Page<T>;
}

async function getAll<T>(src: ApiSource, path: string, f: Fetch) {
  const first = await getPage<T>(src, path, 1, f);
  const rest = await Promise.all(Array.from({ length: first.meta.pages - 1 }, (_, i) => getPage<T>(src, path, i + 2, f)));
  return { data: [first, ...rest].flatMap((p) => p.data), syncedAt: first.meta.syncedAt ?? null };
}

export function brandFromApi(a: ApiBrandFull): Brand {
  return {
    slug: a.slug,
    brandId: a.id,
    name: a.name,
    websiteUrl: a.website,
    platform: a.platform,
    country: a.country,
    countryLabel: a.countryLabel,
    city: a.city,
    story: a.description,
    styleTags: a.styleTags,
    priceMin: a.priceMin,
    priceMax: a.priceMax,
    priceBand: a.priceBand,
    currency: a.currency,
    instagram: a.instagram,
    brandClass: a.brandClass,
    enPuntoExhibitor: false,
    status: "published", // the public audience only returns published brands
    claimStatus: a.claimStatus,
    imageLicenseStatus: a.imageLicenseStatus,
    colorPrimary: a.colorPrimary,
    colorSecondary: a.colorSecondary,
    shipsTo: a.shipsTo,
    affiliate: a.affiliate,
    lastSyncedAt: a.lastSyncedAt,
    sources: [],
    founded: a.founded,
    facts: a.facts ? { ...a.facts, typicalPriceUsd: a.facts.typicalPriceUsd == null ? null : a.facts.typicalPriceUsd * 100 } : null,
  };
}

export function modelFromApi(w: ApiWatchFull): Model {
  return {
    slug: w.slug,
    brandSlug: w.brandSlug,
    brandId: w.brandId,
    name: w.name,
    reference: w.reference,
    status: w.status,
    limitedEdition: w.limitedEdition,
    styles: w.styles,
    sourceUrl: w.sourceUrl,
    published: true,
    specs: w.specs,
    specSources: w.specSources,
    variants: w.variants,
    importedAt: w.importedAt,
    reviewed: w.reviewed,
    origin: w.origin,
    images: w.images,
    imageCredit: w.imageCredit,
    soldOut: w.soldOut,
    availabilityCheckedAt: w.availabilityCheckedAt,
    availabilityHistory: w.availabilityHistory,
    description: w.description,
    options: w.options,
    specsRaw: w.specsRaw,
  };
}

/** Logos and crawl counts, in the shape Catalog.mediaFor() reads. The API already hides images that may not be shown. */
function mediaFromApi(brands: ApiBrandFull[]): CatalogIndex {
  return {
    generatedAt: null,
    brands: brands
      .filter((b) => b.catalogCrawledAt || b.image)
      .map((b) => ({
        brandId: b.id,
        status: "ok" as const,
        brandImageUrl: b.image?.url ?? null,
        brandImageStoredUrl: b.image?.storedUrl ?? null,
        watchCount: b.watchCount,
        soldOutCount: b.soldOutCount,
        availabilityCheckedAt: b.availabilityCheckedAt,
        crawledAt: b.catalogCrawledAt ?? "",
      })),
  };
}

/** Everything the site needs: every published brand and watch. ~15 requests at 200 per page. */
export async function fetchCatalogParts(src: ApiSource, f: Fetch = fetch) {
  const [brands, watches] = await Promise.all([getAll<ApiBrandFull>(src, "/brands", f), getAll<ApiWatchFull>(src, "/watches?sort=none", f)]);
  if (!brands.data.length) throw new Error("the API returned no brands");
  return {
    brands: brands.data.map(brandFromApi),
    models: watches.data.map(modelFromApi),
    media: mediaFromApi(brands.data),
    syncedAt: brands.syncedAt,
  };
}
