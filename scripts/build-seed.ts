// Builds data/seed/*.json from the two brand spreadsheets and the sample Shopify pulls.
//
// Inputs (snapshots, checked in so the build is reproducible):
//   data/raw/master.json          "Brand master list (source of truth)", Brands tab, public columns A-L only
//   data/raw/directories.json     brand-level facts from the Coroa microbrand guide and Watch Police
//   data/raw/shopify-sample.json  products.json pulls for a first set of brands, already field-extracted
//
// Brand rules live in lib/brands/build.ts and are shared with the live site, which reads the sheet
// directly (lib/brands/source.ts). This script refreshes the snapshot the site falls back to.
//
// Only the public columns (A-L) of the master list are snapshotted. The private outreach columns
// (R-AN: emails, founders, status, replies, notes) are never read into the repo or the seed.
//
// Run: npm run seed:build

import fs from "node:fs";
import path from "node:path";
import { applyDirectoryFacts, bandFor, brandsFromRows, cleanDomain } from "../lib/brands/build";
import {
  caliberName,
  inferStyles,
  isAccessory,
  slugify,
  toCaseMaterial,
  toComplications,
  toCrystal,
  toDialColor,
  toHours,
  toMetres,
  toMinorUnits,
  toMm,
  toMovementType,
  toStrapType,
  toThickness,
} from "../lib/ingest/normalize";
import type { Brand, Model, Provenance, SpecKey, Specs, Variant } from "../lib/types";

const root = path.resolve(__dirname, "..");
const master = JSON.parse(fs.readFileSync(path.join(root, "data/raw/master.json"), "utf8")) as { rows: string[][] };
const shopify = JSON.parse(fs.readFileSync(path.join(root, "data/raw/shopify-sample.json"), "utf8")) as Record<string, RawProduct[]>;
const fx = JSON.parse(fs.readFileSync(path.join(root, "data/seed/fx.json"), "utf8")) as { rates: Record<string, number> };

interface RawProduct {
  handle: string;
  title: string;
  product_type?: string;
  tags?: string[];
  variants: { title: string; sku: string | null; price: string; compare_at_price: string | null; available: boolean }[];
  specs: Record<string, unknown>;
}

const IMPORTED_AT = "2026-10-24T00:00:00Z";

// Store currency for the sampled Shopify feeds. Set from where each store prices by default;
// confirm during brand onboarding (doc 08 step 5).
const STORE_CURRENCY: Record<string, string> = {
  "farer.com": "GBP",
  "unimaticwatches.com": "EUR",
  "serica-watches.com": "EUR",
};

// ---------- Brands (master list + directory facts) ----------
// Same rules the live site uses (lib/brands/build.ts).

const brandRows = brandsFromRows(master.rows);
const factsMatched = applyDirectoryFacts(brandRows);
const brands = new Map<string, Brand>(brandRows.map((b) => [b.slug, b]));
console.log(`directory facts matched: ${factsMatched} Coroa brands`);

// ---------- Models ----------

const brandByDomain = new Map<string, Brand>();
for (const b of brands.values()) {
  const d = cleanDomain(b.websiteUrl);
  if (d) brandByDomain.set(d, b);
}

const models: Model[] = [];

/** "FALCON" -> "Falcon". Mixed-case titles are left as the brand wrote them. */
function tidyTitle(t: string): string {
  const s = t.replace(/\s+/g, " ").trim();
  return s === s.toUpperCase() && /[A-Z]{4,}/.test(s) ? s.toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase()) : s;
}

for (const [domain, products] of Object.entries(shopify)) {
  const brand = brandByDomain.get(domain);
  if (!brand) {
    console.warn(`No brand for ${domain}`);
    continue;
  }
  brand.platform = "shopify";
  brand.lastSyncedAt = IMPORTED_AT;
  const currency = STORE_CURRENCY[domain] ?? "USD";
  const rate = fx.rates[currency] ?? 1;
  const seen = new Set<string>();

  for (const p of products) {
    if (isAccessory(p.title, p.product_type, p.tags)) continue;
    const s = p.specs;
    const tags = p.tags ?? [];
    const thickness = toThickness(s.thickness_mm);
    const crystal = toCrystal(s.crystal_material);
    const complications = toComplications(s.complications, p.title);
    const caliber = caliberName(s.movement_caliber);
    const strapRaw = s.strap_type ? String(s.strap_type) : null;
    const specs: Specs = {
      caseDiameterMm: toMm(s.case_diameter_mm),
      lugToLugMm: toMm(s.lug_to_lug_mm),
      thicknessMm: thickness.thickness,
      thicknessInclCrystalMm: thickness.inclCrystal,
      lugWidthMm: toMm(s.lug_width_mm),
      caseMaterial: toCaseMaterial(s.case_material),
      bezelType: s.bezel_type ? String(s.bezel_type) : null,
      crystalMaterial: crystal.material,
      crystalShape: crystal.shape,
      waterResistanceM: toMetres(s.water_resistance_m),
      movementType: toMovementType(s.movement_type, s.movement_caliber, tags),
      caliber,
      powerReserveH: toHours(s.power_reserve_h),
      complications,
      dialColor: toDialColor(s.dial_color),
      dialColorRaw: s.dial_color ? String(s.dial_color) : null,
      lumeType: s.lume_type ? String(s.lume_type) : null,
      strapType: toStrapType(strapRaw),
      strapRaw,
    };
    const specSources: Partial<Record<SpecKey, Provenance>> = {};
    for (const [k, v] of Object.entries(specs)) {
      if (v != null && !(Array.isArray(v) && v.length === 0)) specSources[k as SpecKey] = "imported";
    }

    let slug = slugify(p.title);
    while (seen.has(slug)) slug += "-2";
    seen.add(slug);

    const variants: Variant[] = p.variants.map((v, i) => {
      const price = toMinorUnits(v.price) ?? 0;
      return {
        id: `${brand.slug}--${slug}--${i}`,
        sku: v.sku,
        title: v.title === "Default Title" ? "Standard" : v.title,
        price,
        currency,
        // Converted prices are approximate: round to whole dollars.
        priceUsd: currency === "USD" ? price : Math.round((price * rate) / 100) * 100,
        compareAtPrice: toMinorUnits(v.compare_at_price),
        available: v.available,
        url: `https://${domain}/products/${p.handle}`,
      };
    });
    const anyAvailable = variants.some((v) => v.available);
    const preorder = tags.some((t) => /pre-?order/i.test(t));

    models.push({
      slug,
      brandSlug: brand.slug,
      brandId: brand.brandId,
      name: tidyTitle(p.title),
      reference: null,
      status: preorder ? "preorder" : anyAvailable ? "in_production" : "sold_out",
      limitedEdition: /limited/i.test(`${p.title} ${tags.join(" ")}`),
      styles: inferStyles({ title: p.title, tags, productType: p.product_type, bezel: specs.bezelType, wrM: specs.waterResistanceM, complications, strap: strapRaw }),
      sourceUrl: `https://${domain}/products/${p.handle}`,
      published: true,
      specs,
      specSources,
      variants,
      importedAt: IMPORTED_AT,
      reviewed: false,
    });
  }

  // Brand price range from its live variants beats the sheet estimate.
  const prices = models.filter((m) => m.brandSlug === brand.slug).flatMap((m) => m.variants.map((v) => v.priceUsd));
  if (prices.length) {
    brand.priceMin = Math.min(...prices);
    brand.priceMax = Math.max(...prices);
    brand.priceBand = bandFor(brand.priceMin);
  }
}

const brandList = [...brands.values()].sort((a, b) => a.name.localeCompare(b.name, "en", { sensitivity: "base" }));
fs.writeFileSync(path.join(root, "data/seed/brands.json"), JSON.stringify(brandList, null, 1));
fs.writeFileSync(path.join(root, "data/seed/models.json"), JSON.stringify(models, null, 1));

const counts = brandList.reduce<Record<string, number>>((acc, b) => ((acc[b.status] = (acc[b.status] ?? 0) + 1), acc), {});
console.log(`brands: ${brandList.length}`, counts, `with story: ${brandList.filter((b) => b.story).length}`);
console.log(`models: ${models.length}, variants: ${models.reduce((n, m) => n + m.variants.length, 0)}`);
