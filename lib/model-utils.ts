// Pure model helpers. Kept apart from lib/data.ts so client components (via lib/filters.ts)
// can use them without pulling the server-side catalog loader into the browser bundle.

import type { Model } from "./types";

export const modelId = (m: Pick<Model, "brandSlug" | "slug">) => `${m.brandSlug}~${m.slug}`;

export function minPriceUsd(m: Model): number {
  return Math.min(...m.variants.map((v) => v.priceUsd));
}

export function isAvailable(m: Model): boolean {
  return m.variants.some((v) => v.available);
}

/** The brand fields a model card and the filters need. Filled in when the catalog loads. */
export function brandInfo(m: Model) {
  return m.brand ?? { name: "", country: null, styleTags: [] };
}
