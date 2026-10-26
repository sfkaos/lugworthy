import type { MetadataRoute } from "next";
import { calibersInUse, countryCodes, sitemapEntries } from "@/lib/site-data";
import { caliberSlug } from "@/lib/ingest/normalize";
import { SITE_URL } from "@/lib/site";

// One sitemap for now; split per doc 11 (brands/models/videos/articles/hubs) past 50k URLs.
// No image tags: no brand has granted an image license yet (AC-3).
export const revalidate = 600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [{ brands, models }, countries, calibers] = await Promise.all([sitemapEntries(), countryCodes(), calibersInUse()]);
  const hubs = [
    ...["diver", "field", "pilot", "gmt", "chronograph", "dress", "racing", "skin_diver", "integrated_bracelet", "tool"].map((s) => `/styles/${s}`),
    ...countries.map((c) => `/countries/${c.toLowerCase()}`),
    ...[...new Set(calibers.map(caliberSlug))].map((c) => `/calibers/${c}`),
  ];
  return [
    ...["", "/watches", "/brands", "/for-brands", "/en-punto", "/videos", "/editorial"].map((p) => ({ url: `${SITE_URL}${p}` })),
    ...brands.map((b) => ({ url: `${SITE_URL}/brands/${b.slug}`, lastModified: b.at ?? undefined })),
    ...models.map((m) => ({ url: `${SITE_URL}/brands/${m.brand}/${m.slug}`, lastModified: m.at ?? undefined })),
    ...hubs.map((h) => ({ url: `${SITE_URL}${h}` })),
  ];
}
