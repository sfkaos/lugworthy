// Shapes and queries for the /api/v1/brands endpoints.
//
// Two audiences:
//   "lugworthy" (default, public): published brands only, i.e. Independent + Lugworthy fit "Yes".
//   "all" (needs BRANDS_API_KEY): every brand in the master list, for En Punto and internal tools.
// Both return only fields built from the sheet's public columns A-L (plus directory facts).

import { timingSafeEqual } from "node:crypto";
import { countryName } from "@/lib/countries";
import { SITE_URL } from "@/lib/site";
import type { Catalog } from "@/lib/data";
import type { Brand, BrandClass, BrandFacts, PriceBand } from "@/lib/types";

export type Audience = "lugworthy" | "all";

export interface ApiBrand {
  id: string; // BRD-####, permanent
  slug: string;
  name: string;
  website: string | null;
  country: string | null; // ISO-2
  countryName: string | null;
  city: string | null;
  instagram: string | null;
  description: string | null;
  styleTags: string[];
  priceBand: PriceBand | null;
  priceMinUsd: number | null; // whole dollars
  priceMaxUsd: number | null;
  founded: number | null;
  brandClass: BrandClass;
  facts: (Omit<BrandFacts, "typicalPriceUsd"> & { typicalPriceUsd: number | null }) | null;
  modelCount: number;
  url: string | null; // Lugworthy page, when published
}

export interface ApiBrandInternal extends ApiBrand {
  ownership: string | null;
  lugworthyFit: string | null;
  siteCheck: string | null;
  lugworthyStatus: Brand["status"];
}

const dollars = (minor: number | null | undefined) => (minor == null ? null : Math.round(minor / 100));

export function toApiBrand(b: Brand, modelCount: number, audience: Audience): ApiBrand | ApiBrandInternal {
  const base: ApiBrand = {
    id: b.brandId!,
    slug: b.slug,
    name: b.name,
    website: b.websiteUrl,
    country: b.country,
    countryName: b.country ? countryName(b.country) : b.countryLabel,
    city: b.city,
    instagram: b.instagram,
    description: b.story,
    styleTags: b.styleTags,
    priceBand: b.priceBand,
    priceMinUsd: dollars(b.priceMin),
    priceMaxUsd: dollars(b.priceMax),
    founded: b.founded ?? null,
    brandClass: b.brandClass,
    facts: b.facts ? { ...b.facts, typicalPriceUsd: dollars(b.facts.typicalPriceUsd) } : null,
    modelCount,
    url: b.status === "published" ? `${SITE_URL}/brands/${b.slug}` : null,
  };
  if (audience === "lugworthy") return base;
  return { ...base, ownership: b.ownership ?? null, lugworthyFit: b.lugworthyFit ?? null, siteCheck: b.siteCheck ?? null, lugworthyStatus: b.status };
}

export interface BrandQuery {
  q?: string;
  country?: string; // ISO-2, comma-separated
  style?: string; // matches style tags, substring
  priceBand?: string; // comma-separated PriceBand values
  brandClass?: string;
  hasModels?: boolean;
  ownership?: string; // audience "all" only
  page: number;
  limit: number;
}

export const MAX_LIMIT = 200;

export function parseBrandQuery(sp: URLSearchParams): BrandQuery {
  const int = (v: string | null, d: number) => (v && /^\d+$/.test(v) ? Number(v) : d);
  const str = (k: string) => sp.get(k)?.trim() || undefined;
  return {
    q: str("q"),
    country: str("country"),
    style: str("style"),
    priceBand: str("price") ?? str("priceBand"),
    brandClass: str("class"),
    hasModels: sp.get("hasModels") === "true" ? true : undefined,
    ownership: str("ownership"),
    page: Math.max(1, int(sp.get("page"), 1)),
    limit: Math.min(MAX_LIMIT, Math.max(1, int(sp.get("limit"), 50))),
  };
}

const fold = (s: string) => s.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();

function haystack(b: Brand): string {
  return fold([b.name, b.city, b.country ? countryName(b.country) : b.countryLabel, b.story, ...b.styleTags, b.websiteUrl].filter(Boolean).join(" "));
}

export function queryBrands(catalog: Catalog, query: BrandQuery, audience: Audience) {
  const counts = new Map<string, number>();
  for (const m of catalog.publishedModels()) counts.set(m.brandSlug, (counts.get(m.brandSlug) ?? 0) + 1);

  let list = audience === "all" ? catalog.brands : catalog.publishedBrands();
  const set = (v?: string) => (v ? new Set(v.split(",").map((x) => x.trim().toLowerCase()).filter(Boolean)) : null);

  const countries = set(query.country);
  if (countries) list = list.filter((b) => b.country && countries.has(b.country.toLowerCase()));
  const bands = set(query.priceBand);
  if (bands) list = list.filter((b) => b.priceBand && bands.has(b.priceBand));
  const classes = set(query.brandClass);
  if (classes) list = list.filter((b) => classes.has(b.brandClass));
  if (query.style) {
    const s = fold(query.style);
    list = list.filter((b) => b.styleTags.some((t) => fold(t).includes(s)));
  }
  if (query.hasModels) list = list.filter((b) => (counts.get(b.slug) ?? 0) > 0);
  if (audience === "all" && query.ownership) {
    const o = fold(query.ownership);
    list = list.filter((b) => b.ownership && fold(b.ownership).includes(o));
  }
  if (query.q) {
    const terms = fold(query.q).split(/\s+/).filter(Boolean);
    const scored = list
      .map((b) => {
        const name = fold(b.name);
        const hay = haystack(b);
        if (!terms.every((t) => hay.includes(t))) return null;
        const q = terms.join(" ");
        const score = name === q ? 3 : name.startsWith(q) ? 2 : name.includes(q) ? 1 : 0;
        return { b, score };
      })
      .filter((x): x is { b: Brand; score: number } => x !== null)
      .sort((a, b) => b.score - a.score);
    list = scored.map((x) => x.b);
  }

  const total = list.length;
  const start = (query.page - 1) * query.limit;
  const data = list.slice(start, start + query.limit).map((b) => toApiBrand(b, counts.get(b.slug) ?? 0, audience));
  return { data, total, page: query.page, limit: query.limit, pages: Math.max(1, Math.ceil(total / query.limit)) };
}

/** Finds a brand by BRD ID or slug, hiding unpublished ones from the public audience. */
export function findBrand(catalog: Catalog, idOrSlug: string, audience: Audience) {
  const b = /^brd-\d+$/i.test(idOrSlug) ? catalog.brandById(idOrSlug) : catalog.brands.find((x) => x.slug === idOrSlug.toLowerCase());
  if (!b || (audience === "lugworthy" && b.status !== "published")) return null;
  return toApiBrand(b, catalog.modelsForBrand(b.slug).length, audience);
}

/** "all" is allowed only with a matching BRANDS_API_KEY (Authorization: Bearer <key> or x-api-key). */
export function audienceFor(req: Request, requested: string | null, env: Record<string, string | undefined> = process.env): Audience | "forbidden" {
  if (requested !== "all") return "lugworthy";
  const key = env.BRANDS_API_KEY;
  if (!key) return "forbidden";
  const auth = req.headers.get("authorization");
  const given = auth?.startsWith("Bearer ") ? auth.slice(7) : req.headers.get("x-api-key");
  if (!given) return "forbidden";
  const a = Buffer.from(given), b = Buffer.from(key);
  return a.length === b.length && timingSafeEqual(a, b) ? "all" : "forbidden";
}

export function apiHeaders(audience: Audience): HeadersInit {
  return audience === "lugworthy"
    ? { "cache-control": "public, s-maxage=300, stale-while-revalidate=600", "access-control-allow-origin": "*" }
    : { "cache-control": "private, no-store" };
}
