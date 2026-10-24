// Builds data/seed/*.json from the two brand spreadsheets and the sample Shopify pulls.
//
// Inputs (snapshots, checked in so the build is reproducible):
//   data/raw/sheets.json          "Brand outreach status - all brands" + "New independent watch brands (batch 2)"
//   data/raw/shopify-sample.json  products.json pulls for a first set of brands, already field-extracted
//
// Only public directory fields are copied. Contact emails, outreach status and private notes
// in the sheets are never read into the seed.
//
// Run: npm run seed:build

import fs from "node:fs";
import path from "node:path";
import { toIso2 } from "../lib/countries";
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
import type { Brand, Model, PriceBand, Provenance, SpecKey, Specs, Variant } from "../lib/types";

const root = path.resolve(__dirname, "..");
const sheets = JSON.parse(fs.readFileSync(path.join(root, "data/raw/sheets.json"), "utf8")) as Record<string, string[][]>;
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

// Big mass-market or haute-horlogerie houses that ended up in the outreach list.
// Doc 01 non-goal: "non-micro luxury brands". Kept as hidden so an editor can flip them.
const HIDDEN = new Set(
  [
    "Bulova", "Citizen", "Fossil", "Timex", "G-SHOCK", "Oris", "Frederique Constant", "Alpina",
    "Maurice Lacroix", "Festina Swiss Made", "Titan", "Accutron", "Tutima", "H. Moser & Cie.",
    "MB&F", "Laurent Ferrier", "Bremont", "Junghans", "Locman", "D1 Milano", "Shinola",
  ].map((s) => s.toLowerCase()),
);

// Older heritage names that sell like micros. Directory class "legacy_micro".
const LEGACY = new Set(
  ["Yema", "DOXA", "Squale", "Hanhart", "Laco", "Mühle-Glashütte", "MeisterSinger", "Benrus", "Hampden", "Vulcain", "Nivada Grenchen", "Marathon", "Ollech & Wajs Zurich", "Louis Erard", "Christopher Ward", "Steinhart Watches", "Pequignet", "Cimier", "Ardath", "Cadola", "Junkers", "Spinnaker", "AVI-8", "Briston", "Agelocer", "Duxot", "Swan & Edgar", "Van Speyk", "Angelier", "Normalzeit", "Horage", "Itay Noy", "Peacock", "Lucky Harvey", "CIGA Design", "Albishorn", "Mandetbrote", "Reservoir", "Azimuth", "Mezei Watch Company", "Speake-Marin", "Kudoke", "Ikepod", "Phoibos", "Crepas", "Panzera", "Kronosti", "Delhi Watch Company", "Farasute", "Naoya Hida & Co.", "Ōtsuka Lōtec", "toledano&chan", "MING", "Kompas Watches", "Grandeur", "Col&MacArthur", "Temporal Works", "Parivas", "PRIM", "Ercigoj", "ROBOT", "Donut Watch Co.", "ALANTI Watches", "M. Ryan Watch Designs"].map((s) => s.toLowerCase()),
);

// Store currency for the sampled Shopify feeds. Set from where each store prices by default;
// confirm during brand onboarding (doc 08 step 5).
const STORE_CURRENCY: Record<string, string> = {
  "farer.com": "GBP",
  "unimaticwatches.com": "EUR",
  "serica-watches.com": "EUR",
};

function cleanDomain(raw: string | undefined | null): string | null {
  if (!raw) return null;
  const first = raw.trim().split(/\s/)[0];
  if (!first || !/\./.test(first)) return null;
  return first.replace(/^https?:\/\//, "").replace(/^www\./, "").replace(/\/.*$/, "").toLowerCase();
}

const keyName = (s: string) => slugify(s).replace(/-?(watch(es)?|watch-co|co|company|timepieces)$/g, "");

// ---------- Brands ----------

const master = sheets["Sheet1!A1:B997"].slice(1);
const checks = sheets["Sheet1!K1:L997"].slice(1);
const countries = sheets["Sheet1!S1:S997"].slice(1);
const batch2 = [...sheets["'New brands'!B1:G200"].slice(1), ...sheets["'New brands'!B201:G994"]];

interface B2 { name: string; website: string; country: string; instagram: string; description: string }
const b2ByDomain = new Map<string, B2>();
const b2ByName = new Map<string, B2>();
for (const r of batch2) {
  const row: B2 = { name: r[0], website: r[2] ?? "", country: r[3] ?? "", instagram: r[4] ?? "", description: r[5] ?? "" };
  const d = cleanDomain(row.website);
  if (d) b2ByDomain.set(d, row);
  b2ByName.set(keyName(row.name), row);
}

/** "Lume lovers, field watch microbrand from Chihuahua, Mexico; budget-friendly ($150–$400)." */
function parseDescription(desc: string) {
  const out: { tags: string[]; city: string | null; min: number | null; max: number | null; band: PriceBand | null } = {
    tags: [], city: null, min: null, max: null, band: null,
  };
  const m = desc.match(/^(.*?)\s+microbrand from\s+([^;.]+?)(?:;\s*([a-z -]+?))?(?:\s*\(\$([\d,]+)\s*[–-]\s*\$([\d,]+)\))?\.?$/i);
  if (!m) return out;
  out.tags = m[1].split(",").map((t) => t.trim().toLowerCase()).filter((t) => t && t !== "independent");
  const place = m[2].split(",").map((s) => s.trim());
  out.city = place.length > 1 ? place[0] : null;
  if (m[4] && m[5]) {
    out.min = Number(m[4].replace(/,/g, "")) * 100;
    out.max = Number(m[5].replace(/,/g, "")) * 100;
  }
  const label = (m[3] ?? "").toLowerCase();
  out.band = label.startsWith("budget") ? "budget" : label.startsWith("affordable") ? "affordable" : label.startsWith("upper") ? "upper_mid" : label.startsWith("mid") ? "mid" : null;
  return out;
}

function bandFor(minUsdMinor: number | null): PriceBand | null {
  if (minUsdMinor == null) return null;
  const d = minUsdMinor / 100;
  if (d < 300) return "budget";
  if (d < 700) return "affordable";
  if (d < 1500) return "mid";
  if (d < 3000) return "upper_mid";
  return "high";
}

function safeLabel(raw: string | null): string | null {
  if (!raw || raw.length > 30 || /\d|;|:|unknown|uncertain|possibly/i.test(raw)) return null;
  return raw.trim();
}

const brands = new Map<string, Brand>();
const usedB2 = new Set<B2>();

function addBrand(input: { name: string; domain: string | null; countryRaw: string | null; siteOk: boolean; source: string; b2?: B2 }) {
  const b2 = input.b2;
  if (b2) usedB2.add(b2);
  const slug = slugify(input.name);
  if (brands.has(slug)) {
    brands.get(slug)!.sources.push(input.source);
    return;
  }
  const parsed = b2 ? parseDescription(b2.description) : null;
  const iso = toIso2(b2?.country || input.countryRaw);
  const story = b2?.description && !parsed?.tags.length ? b2.description : b2?.description ?? null;
  const lower = input.name.toLowerCase();
  const website = b2?.website || (input.domain ? `https://${input.domain}` : null);
  brands.set(slug, {
    slug,
    name: input.name,
    websiteUrl: website,
    platform: null,
    country: iso,
    // Never copy free-text research notes into a public field.
    countryLabel: iso ? null : safeLabel(input.countryRaw || b2?.country || null),
    city: parsed?.city ?? null,
    story,
    styleTags: parsed?.tags ?? [],
    priceMin: parsed?.min ?? null,
    priceMax: parsed?.max ?? null,
    priceBand: parsed?.band ?? bandFor(parsed?.min ?? null),
    currency: "USD",
    instagram: b2?.instagram || null,
    brandClass: LEGACY.has(lower) ? "legacy_micro" : "microbrand",
    enPuntoExhibitor: false,
    status: HIDDEN.has(lower) ? "hidden" : website && input.siteOk ? "published" : "draft",
    claimStatus: "unclaimed",
    imageLicenseStatus: "none",
    colorPrimary: null,
    colorSecondary: null,
    shipsTo: [],
    affiliate: null,
    lastSyncedAt: null,
    sources: [input.source],
  });
}

master.forEach((row, i) => {
  const name = row[0]?.trim();
  if (!name) return;
  const check = checks[i]?.[0] ?? "";
  const corrected = cleanDomain(checks[i]?.[1]);
  const domain = cleanDomain(row[1]) ?? corrected;
  const siteOk = /^OK/i.test(check) || (/^Missing/i.test(check) && !!corrected && !/unconfirmed/i.test(checks[i]?.[1] ?? ""));
  const b2 = (domain && b2ByDomain.get(domain)) || b2ByName.get(keyName(name));
  addBrand({ name, domain, countryRaw: countries[i]?.[0] ?? null, siteOk: siteOk && !/wrong site|not verified/i.test(check), source: "all-brands", b2: b2 || undefined });
});

for (const r of new Set([...b2ByDomain.values(), ...b2ByName.values()])) {
  if (usedB2.has(r)) continue;
  addBrand({ name: r.name, domain: cleanDomain(r.website), countryRaw: r.country, siteOk: true, source: "new-brands-batch-2", b2: r });
}

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
