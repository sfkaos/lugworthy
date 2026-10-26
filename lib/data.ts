// Read-side repository. Brands come live from the master sheet (lib/brands/source.ts) and models
// from the imported catalog (data/seed/models.json). Pages and the /api/v1 routes both read
// through getCatalog(), so the site and the API always agree.

import { cache } from "react";
import modelsJson from "@/data/seed/models.json";
import { bandFor, buildBrands } from "./brands/build";
import { loadCatalogIndex, type CatalogIndex, type CatalogIndexRow } from "./brands/media";
import type { MasterRows } from "./brands/source";
import { loadMasterRows } from "./brands/source";
import { minPriceUsd } from "./model-utils";
import type { Brand, Model } from "./types";

const seedModels = modelsJson as unknown as Model[];

export { isAvailable, minPriceUsd, modelId } from "./model-utils";

export class Catalog {
  readonly brands: Brand[];
  readonly models: Model[];
  readonly source: MasterRows["source"];
  readonly syncedAt: string;
  private readonly bySlug: Map<string, Brand>;
  private readonly byId: Map<string, Brand>;
  private readonly media: Map<string, CatalogIndexRow>;

  constructor(rows: MasterRows, models: Model[] = seedModels, media?: CatalogIndex) {
    this.media = new Map((media?.brands ?? []).map((r) => [r.brandId, r]));
    this.source = rows.source;
    this.syncedAt = rows.syncedAt;
    this.brands = buildBrands(rows.rows);
    this.byId = new Map(this.brands.map((b) => [b.brandId!, b]));
    // Models are tied to the brand's permanent ID, so a renamed brand keeps its models.
    this.models = [];
    for (const m of models) {
      const b = (m.brandId && this.byId.get(m.brandId)) || this.brands.find((x) => x.slug === m.brandSlug);
      if (!b) continue;
      this.models.push({ ...m, brandSlug: b.slug, brandId: b.brandId, brand: { name: b.name, country: b.country, styleTags: b.styleTags } });
    }
    // Brands with imported models: live variant prices beat the sheet estimate.
    for (const b of this.brands) {
      const prices = this.models.filter((m) => m.brandId === b.brandId).flatMap((m) => m.variants.map((v) => v.priceUsd));
      if (!prices.length) continue;
      b.platform = "shopify";
      b.lastSyncedAt = this.models.find((m) => m.brandId === b.brandId)!.importedAt;
      b.priceMin = Math.min(...prices);
      b.priceMax = Math.max(...prices);
      b.priceBand = bandFor(b.priceMin);
    }
    this.bySlug = new Map(this.brands.map((b) => [b.slug, b]));
  }

  /** Crawl summary for the brand's own site (brand image, watch count), if crawled. Callers check imagesVisible(). */
  mediaFor(brandId: string | undefined): CatalogIndexRow | null {
    return (brandId && this.media.get(brandId)) || null;
  }

  /** Brands visible to the public (doc 08: draft and hidden stay private). */
  publishedBrands(): Brand[] {
    return this.brands.filter((b) => b.status === "published");
  }

  getBrand(slug: string): Brand | undefined {
    const b = this.bySlug.get(slug);
    return b && b.status === "published" ? b : undefined;
  }

  /** Any brand by BRD ID, regardless of status. Callers decide what's visible. */
  brandById(id: string): Brand | undefined {
    return this.byId.get(id.toUpperCase());
  }

  publishedModels(): Model[] {
    return this.models.filter((m) => m.published && this.bySlug.get(m.brandSlug)?.status === "published");
  }

  modelsForBrand(slug: string): Model[] {
    return this.publishedModels().filter((m) => m.brandSlug === slug);
  }

  getModel(brandSlug: string, modelSlug: string): Model | undefined {
    return this.publishedModels().find((m) => m.brandSlug === brandSlug && m.slug === modelSlug);
  }

  getModelById(id: string): Model | undefined {
    const [brandSlug, modelSlug] = id.split("~");
    return this.getModel(brandSlug, modelSlug);
  }

  findVariant(variantId: string) {
    for (const m of this.publishedModels()) {
      const v = m.variants.find((x) => x.id === variantId);
      if (v) return { model: m, variant: v, brand: this.bySlug.get(m.brandSlug)! };
    }
    return undefined;
  }

  brandOf(m: Model): Brand {
    return this.bySlug.get(m.brandSlug)!;
  }

  /** Spec-similarity for "Similar models": style overlap, then size and price distance. */
  similarModels(m: Model, limit = 4): Model[] {
    const d0 = m.specs.caseDiameterMm ?? 40;
    const p0 = minPriceUsd(m);
    return this.publishedModels()
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

  brandStats() {
    const brands = this.publishedBrands();
    return {
      brands: brands.length,
      countries: new Set(brands.map((b) => b.country).filter(Boolean)).size,
      models: this.publishedModels().length,
    };
  }
}

// Building the catalog is cheap (about 1,400 rows) but done once per request at most.
let memo: { key: string; catalog: Catalog } | null = null;

/** The current catalog. Rows are cached by lib/brands/source.ts; this just avoids rebuilding per call. */
export const getCatalog = cache(async (): Promise<Catalog> => {
  const [rows, media] = await Promise.all([loadMasterRows(), loadCatalogIndex()]);
  const key = `${rows.source}:${rows.syncedAt}:${rows.rows.length}:${media.generatedAt}`;
  if (memo?.key !== key) memo = { key, catalog: new Catalog(rows, undefined, media) };
  return memo.catalog;
});
