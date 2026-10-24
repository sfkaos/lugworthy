// Read-side repository. Today it serves the JSON seed; the same functions can be
// backed by Postgres via db/schema.ts without touching the pages.

import brandsJson from "@/data/seed/brands.json";
import modelsJson from "@/data/seed/models.json";
import type { Brand, Model } from "./types";

const allBrands = brandsJson as unknown as Brand[];
const allModels = modelsJson as unknown as Model[];

const brandBySlug = new Map(allBrands.map((b) => [b.slug, b]));

/** Brands visible to the public (doc 08: draft and hidden stay private). */
export function publishedBrands(): Brand[] {
  return allBrands.filter((b) => b.status === "published");
}

export function getBrand(slug: string): Brand | undefined {
  const b = brandBySlug.get(slug);
  return b && b.status === "published" ? b : undefined;
}

export function publishedModels(): Model[] {
  return allModels.filter((m) => m.published && brandBySlug.get(m.brandSlug)?.status === "published");
}

export function modelsForBrand(slug: string): Model[] {
  return publishedModels().filter((m) => m.brandSlug === slug);
}

export function getModel(brandSlug: string, modelSlug: string): Model | undefined {
  return publishedModels().find((m) => m.brandSlug === brandSlug && m.slug === modelSlug);
}

export function getModelById(id: string): Model | undefined {
  const [brandSlug, modelSlug] = id.split("~");
  return getModel(brandSlug, modelSlug);
}

export const modelId = (m: Pick<Model, "brandSlug" | "slug">) => `${m.brandSlug}~${m.slug}`;

export function findVariant(variantId: string) {
  for (const m of publishedModels()) {
    const v = m.variants.find((x) => x.id === variantId);
    if (v) return { model: m, variant: v, brand: brandBySlug.get(m.brandSlug)! };
  }
  return undefined;
}

export function brandOf(m: Model): Brand {
  return brandBySlug.get(m.brandSlug)!;
}

export function minPriceUsd(m: Model): number {
  return Math.min(...m.variants.map((v) => v.priceUsd));
}

export function isAvailable(m: Model): boolean {
  return m.variants.some((v) => v.available);
}

/** Spec-similarity for "Similar models": style overlap, then size and price distance. */
export function similarModels(m: Model, limit = 4): Model[] {
  const d0 = m.specs.caseDiameterMm ?? 40;
  const p0 = minPriceUsd(m);
  return publishedModels()
    .filter((x) => x.brandSlug !== m.brandSlug)
    .map((x) => {
      const overlap = x.styles.filter((s) => m.styles.includes(s) && s !== "other").length;
      const dd = Math.abs((x.specs.caseDiameterMm ?? d0) - d0);
      const dp = Math.abs(minPriceUsd(x) - p0) / Math.max(p0, 1);
      const move = x.specs.movementType === m.specs.movementType ? 0 : 1;
      return { x, score: overlap * 3 - dd * 0.5 - dp * 2 - move };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((r) => r.x);
}

export function brandStats() {
  const brands = publishedBrands();
  return {
    brands: brands.length,
    countries: new Set(brands.map((b) => b.country).filter(Boolean)).size,
    models: publishedModels().length,
  };
}
