import type { MetadataRoute } from "next";
import { getCatalog } from "@/lib/data";
import { caliberSlug } from "@/lib/ingest/normalize";
import { SITE_URL } from "@/lib/site";

// One sitemap for now; split per doc 11 (brands/models/videos/articles/hubs) past 50k URLs.
// No image tags: no brand has granted an image license yet (AC-3).
export const revalidate = 600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const catalog = await getCatalog();
  const brands = catalog.publishedBrands();
  const models = catalog.publishedModels();
  const hubs = [
    ...["diver", "field", "pilot", "gmt", "chronograph", "dress", "racing", "skin_diver", "integrated_bracelet", "tool"].map((s) => `/styles/${s}`),
    ...[...new Set(brands.map((b) => b.country).filter(Boolean))].map((c) => `/countries/${c!.toLowerCase()}`),
    ...[...new Set(models.map((m) => m.specs.caliber).filter(Boolean))].map((c) => `/calibers/${caliberSlug(c!)}`),
  ];
  return [
    ...["", "/watches", "/brands", "/for-brands", "/en-punto", "/videos", "/editorial"].map((p) => ({ url: `${SITE_URL}${p}` })),
    ...brands.map((b) => ({ url: `${SITE_URL}/brands/${b.slug}`, lastModified: b.lastSyncedAt ?? undefined })),
    ...models.map((m) => ({ url: `${SITE_URL}/brands/${m.brandSlug}/${m.slug}`, lastModified: m.importedAt })),
    ...hubs.map((h) => ({ url: `${SITE_URL}${h}` })),
  ];
}
