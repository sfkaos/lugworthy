// Brand and watch images collected from each brand's own website by the catalog crawler
// (scripts/crawl-*, run weekly by a GitHub Action). Files, keyed by permanent BRD ID:
//
//   data/catalog/index.json      { generatedAt, brands: [{ brandId, status, brandImageUrl, watchCount, crawledAt }] }
//   data/catalog/BRD-####.json   {
//     brandId, brandName, website, crawledAt,
//     status: "ok" | "no_website" | "robots_disallowed" | "unreachable" | "no_catalog_found",
//     platform: "shopify" | "woocommerce" | "html" | null,
//     brandImage: { url, kind: "logo" | "og_image" | "hero" | "icon", sourcePage, width, height } | null,
//     attribution: "Images © <Brand>, from <domain>", imageRights: "unknown",
//     watches: [{ id: "BRD-0001/<slug>", name, url, image, images: [{ url, width, height }],
//                 priceMinor, currency, available, specs: { caseDiameterMm, ... }, hash }]
//   }
//
// Images are hotlinked from the brand's site; only the URL and attribution are stored.
// Files are read from disk at request time (see outputFileTracingIncludes in next.config.ts),
// so a crawler commit + deploy updates the API without touching code.

import fs from "node:fs/promises";
import path from "node:path";
import type { Brand } from "@/lib/types";

export interface CatalogImage {
  url: string;
  width: number | null;
  height: number | null;
}

export interface CatalogWatch {
  id: string;
  name: string;
  url: string;
  image: CatalogImage | null;
  images: CatalogImage[];
  priceMinor: number | null;
  currency: string | null;
  available: boolean | null;
  specs: Record<string, string | number | null>;
  hash?: string;
}

export interface BrandCatalog {
  brandId: string;
  brandName: string;
  website: string | null;
  crawledAt: string;
  status: "ok" | "no_website" | "robots_disallowed" | "unreachable" | "no_catalog_found";
  platform: string | null;
  brandImage: (CatalogImage & { kind: string; sourcePage: string | null }) | null;
  attribution: string | null;
  imageRights: string;
  watches: CatalogWatch[];
}

export interface CatalogIndexRow {
  brandId: string;
  status: BrandCatalog["status"];
  brandImageUrl: string | null;
  watchCount: number;
  crawledAt: string;
}

export interface CatalogIndex {
  generatedAt: string | null;
  brands: CatalogIndexRow[];
}

const DIR = path.join(process.cwd(), "data", "catalog");
const EMPTY: CatalogIndex = { generatedAt: null, brands: [] };

async function readJson<T>(file: string): Promise<T | null> {
  try {
    return JSON.parse(await fs.readFile(file, "utf8")) as T;
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code !== "ENOENT") console.error(`[catalog] can't read ${file}:`, (e as Error).message);
    return null;
  }
}

export async function loadCatalogIndex(dir = DIR): Promise<CatalogIndex> {
  return (await readJson<CatalogIndex>(path.join(dir, "index.json"))) ?? EMPTY;
}

export async function loadBrandCatalog(brandId: string, dir = DIR): Promise<BrandCatalog | null> {
  if (!/^BRD-\d+$/.test(brandId)) return null;
  return readJson<BrandCatalog>(path.join(dir, `${brandId}.json`));
}

/**
 * Whether a brand's collected images may be shown to this audience.
 * Internal (audience=all) always sees them. Public visibility follows the image policy:
 * only brands that granted the image license, unless IMAGES_PUBLIC is "all" (every image) or
 * "logos" (brand images for everyone, watch photos only once licensed).
 */
export function imagesVisible(
  brand: Pick<Brand, "imageLicenseStatus">,
  audience: "lugworthy" | "all",
  kind: "brand" | "watch" = "watch",
  env: Record<string, string | undefined> = process.env,
): boolean {
  if (audience === "all") return true;
  if (brand.imageLicenseStatus === "revoked") return false;
  if (brand.imageLicenseStatus === "granted") return true;
  const mode = env.IMAGES_PUBLIC?.trim().toLowerCase();
  return mode === "all" || (mode === "logos" && kind === "brand");
}
