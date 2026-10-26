// Turns watches crawled from brand websites (data/catalog files or the site_watches table) into
// the Model shape the directory pages, filters and compare view already use.

import fxJson from "@/data/seed/fx.json";
import type { BrandCatalog, CatalogWatch } from "@/lib/brands/media";
import { caliberName, inferStyles, toCaseMaterial, toCrystal, toDialColor, toHours, toMetres, toMm, toMovementType, toStrapType } from "@/lib/ingest/normalize";
import type { Brand, Model, ModelStatus, Provenance, SpecKey, Specs, Variant } from "@/lib/types";

const rates = (fxJson as { rates: Record<string, number> }).rates;

/** Approximate USD (minor units, whole dollars) for a price in another currency; null when unknown. */
export function toUsdMinor(minor: number | null, currency: string | null): number | null {
  if (minor == null) return null;
  const cur = (currency ?? "USD").toUpperCase();
  if (cur === "USD") return minor;
  const rate = rates[cur];
  return rate ? Math.round((minor * rate) / 100) * 100 : null;
}

const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : null);

function specsFor(w: CatalogWatch): Specs {
  const s = w.specs ?? {};
  const crystal = toCrystal(s.crystal);
  const caliber = s.caliber ? caliberName(s.caliber) ?? String(s.caliber) : null;
  return {
    caseDiameterMm: num(s.caseDiameterMm) ?? toMm(s.caseDiameterMm),
    lugToLugMm: num(s.lugToLugMm) ?? toMm(s.lugToLugMm),
    thicknessMm: num(s.thicknessMm) ?? toMm(s.thicknessMm),
    thicknessInclCrystalMm: null,
    lugWidthMm: num(s.lugWidthMm) ?? toMm(s.lugWidthMm),
    caseMaterial: toCaseMaterial(s.caseMaterial),
    bezelType: null,
    crystalMaterial: crystal.material,
    crystalShape: crystal.shape,
    waterResistanceM: num(s.waterResistanceM) ?? toMetres(s.waterResistanceM),
    movementType: toMovementType(s.movementType, s.caliber, w.tags ?? []),
    caliber,
    powerReserveH: num(s.powerReserveH) ?? toHours(s.powerReserveH),
    complications: [],
    dialColor: toDialColor(s.dialColor),
    dialColorRaw: s.dialColor ? String(s.dialColor) : null,
    lumeType: w.specsRaw ? Object.entries(w.specsRaw).find(([k]) => /lume/i.test(k))?.[1] ?? null : null,
    strapType: toStrapType(s.strapType),
    strapRaw: s.strapType ? String(s.strapType) : null,
  };
}

function statusFor(w: CatalogWatch): ModelStatus {
  if (w.availability === "preorder") return "preorder";
  if (w.soldOut || w.availability === "sold_out") return "sold_out";
  return "in_production";
}

const NOT_A_WATCH = /\b(straps?|pouch(es)?|wallet|t-?shirts?|tee|hoodie|cap|hat|umbrella|watch roll|roll|box|tool|buckle|keychain|key ?ring|clock|klokke|sticker|poster|gift ?card|dial set|carrying case|lenke|spring ?bars?|cleaning|winder|cufflinks?|deposit)\b/i;

/**
 * Brand shops also sell straps, pouches, clothing and clocks. Drop those: anything the accessory
 * rules match, and anything with none of the basic watch specs.
 */
export function looksLikeWatch(w: CatalogWatch, specs: Specs): boolean {
  const pt = w.productType ?? "";
  if (/\bwatch|wrist/i.test(pt) && !/strap|dial set|case/i.test(pt)) return hasCoreSpec(specs) || !NOT_A_WATCH.test(w.name);
  if (NOT_A_WATCH.test(`${w.name} ${pt}`)) return false;
  // Names that say "watch" in any common language, or give a case size, count as watches.
  return hasCoreSpec(specs) || /錶|表|watch|montre|\buhr\b|reloj|orologio|klocka|\b\d{2}(\.\d)?\s?mm\b/i.test(w.name);
}

function hasCoreSpec(s: Specs): boolean {
  return [s.caseDiameterMm, s.movementType, s.waterResistanceM, s.caliber, s.lugWidthMm, s.thicknessMm].some((v) => v != null);
}

export function siteWatchToModel(w: CatalogWatch, brand: Brand, crawledAt: string, showImages: boolean, credit: string | null): Model | null {
  const slug = w.id.split("/").slice(1).join("/") || w.id;
  const specs = specsFor(w);
  if (!looksLikeWatch(w, specs)) return null;
  const specSources: Partial<Record<SpecKey, Provenance>> = {};
  for (const [k, v] of Object.entries(specs)) if (v != null && !(Array.isArray(v) && !v.length)) specSources[k as SpecKey] = "imported";

  const currency = (w.currency ?? "USD").toUpperCase();
  const rawVariants = w.variants?.length
    ? w.variants
    : [{ title: "Standard", sku: null, priceMinor: w.priceMinor, compareAtMinor: null, available: w.available ?? !w.soldOut, options: [] as string[] }];
  const variants: Variant[] = rawVariants.map((v, i) => {
    const price = v.priceMinor ?? w.priceMinor ?? 0;
    return {
      id: `${brand.slug}--${slug}--${i}`,
      sku: v.sku,
      title: v.title === "Default Title" ? "Standard" : v.title,
      price,
      currency,
      priceUsd: toUsdMinor(price, currency) ?? 0,
      compareAtPrice: v.compareAtMinor,
      available: v.available ?? !w.soldOut,
      url: w.url,
    };
  });
  // Price-less listings (contact for price) can't be filtered or sorted by price; skip them.
  if (variants.every((v) => !v.priceUsd)) return null;

  const tags = w.tags ?? [];
  const images = showImages ? (w.images.length ? w.images : w.image ? [w.image] : []) : [];
  return {
    slug,
    brandSlug: brand.slug,
    brandId: brand.brandId,
    name: w.name,
    reference: null,
    status: statusFor(w),
    limitedEdition: /limited/i.test(`${w.name} ${tags.join(" ")}`),
    styles: inferStyles({ title: w.name, tags, productType: w.productType ?? undefined, bezel: null, wrM: specs.waterResistanceM, complications: [], strap: specs.strapRaw }),
    sourceUrl: w.url,
    published: true,
    specs,
    specSources,
    variants: variants.filter((v) => v.priceUsd > 0),
    importedAt: w.availabilityCheckedAt ?? crawledAt,
    reviewed: false,
    origin: "site",
    images: images.map((im) => ({ url: im.storedUrl ?? im.url, width: im.width, height: im.height })),
    imageCredit: images.length ? credit : null,
    soldOut: w.soldOut ?? null,
    availabilityCheckedAt: w.availabilityCheckedAt ?? null,
    availabilityHistory: w.availabilityHistory ?? [],
    description: w.description ?? null,
    options: w.options ?? [],
    specsRaw: w.specsRaw ?? {},
  };
}

export function siteModelsFor(c: BrandCatalog, brand: Brand, showImages: boolean): Model[] {
  if (c.status !== "ok") return [];
  const seen = new Set<string>();
  const out: Model[] = [];
  for (const w of c.watches) {
    const m = siteWatchToModel(w, brand, c.crawledAt, showImages, c.attribution);
    if (!m || seen.has(m.slug)) continue;
    seen.add(m.slug);
    out.push(m);
  }
  return out;
}
