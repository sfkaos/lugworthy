// Builds the site's read model (catalog_brands, catalog_watches in db/schema.ts): one row per
// published brand and watch, with what pages list, filter and sort on. Rebuilt one brand at a time,
// so it runs inside the crawler's small Render job as well as the Vercel sync.

import { createHash } from "node:crypto";
import { and, asc, eq, inArray, isNotNull, sql } from "drizzle-orm";
import * as s from "@/db/schema";
import { Catalog } from "@/lib/data";
import type { Db } from "@/lib/db/client";
import { readBrandCatalog, rowToBrand } from "@/lib/db/read";
import { ACCESSORS, MULTI_FACETS, availability, haystack, tokenize } from "@/lib/filters";
import { isAvailable, minPriceUsd } from "@/lib/model-utils";
import type { Brand, Model } from "@/lib/types";

/** Bump when the row format changes; the build then rebuilds every brand (scripts/migrate.ts). */
export const READ_MODEL_VERSION = "2";

const CHUNK = 200;

export const letterOf = (name: string) => {
  const c = name.normalize("NFKD").replace(/[̀-ͯ]/g, "").charAt(0).toUpperCase();
  return /[A-Z]/.test(c) ? c : "#";
};

/** A model trimmed to what a card shows: one photo and its cheapest price. */
export function cardOf(m: Model): Model {
  const cheapest = m.variants.reduce((a, b) => (b.priceUsd < a.priceUsd ? b : a), m.variants[0]);
  return {
    slug: m.slug, brandSlug: m.brandSlug, brandId: m.brandId, brand: m.brand, name: m.name, reference: m.reference,
    status: m.status, limitedEdition: m.limitedEdition, styles: m.styles, sourceUrl: null, published: m.published,
    specs: m.specs, specSources: {}, variants: [{ ...cheapest, available: isAvailable(m) }], importedAt: m.importedAt,
    reviewed: m.reviewed, origin: m.origin, images: m.images?.slice(0, 1) ?? [],
  };
}

function words(fields: string[]): { w: string[]; r: string } {
  const raw = fields.join(" ").toLowerCase();
  return { w: [...new Set(tokenize(fields.join(" ")))], r: raw };
}

export function watchRow(m: Model, brand: Brand, ord: number, imageLicense: string): typeof s.catalogWatches.$inferInsert {
  const hay = haystack(m);
  const byWeight = (w: number) => words(hay.filter((h) => h.weight === w).map((h) => h.field));
  const [h5, h4, h3, h2, h1] = [5, 4, 3, 2, 1].map(byWeight);
  const sp = m.specs;
  return {
    id: `${m.brandSlug}~${m.slug}`,
    brandSlug: m.brandSlug,
    brandCode: brand.brandId!,
    slug: m.slug,
    ord,
    origin: m.origin ?? "seed",
    name: m.name,
    imageLicense,
    hasImage: !!m.images?.length,
    inStock: availability(m) !== "sold_out",
    importedAt: m.importedAt ? new Date(m.importedAt) : null,
    minPrice: minPriceUsd(m),
    dia: sp.caseDiameterMm,
    l2l: sp.lugToLugMm,
    thk: sp.thicknessMm ?? sp.thicknessInclCrystalMm,
    wr: sp.waterResistanceM,
    movement: sp.movementType,
    caliber: sp.caliber,
    styles: m.styles,
    fMov: ACCESSORS.mov(m), fStyle: ACCESSORS.style(m), fDial: ACCESSORS.dial(m), fStrap: ACCESSORS.strap(m),
    fAvail: ACCESSORS.avail(m), fCal: ACCESSORS.cal(m), fCrystal: ACCESSORS.crystal(m), fMat: ACCESSORS.mat(m),
    fLug: ACCESSORS.lug(m), fComp: ACCESSORS.comp(m), fCountry: ACCESSORS.country(m),
    tags: [...new Set(MULTI_FACETS.flatMap((k) => ACCESSORS[k](m).map((v) => `${k}:${v}`)))],
    w5: h5.w, w4: h4.w, w3: h3.w, w2: h2.w, w1: h1.w,
    r5: h5.r, r4: h4.r, r3: h3.r, r2: h2.r, r1: h1.r,
    variantIds: m.variants.map((v) => v.id),
    card: cardOf(m),
    detail: m,
  };
}

const hash = (v: unknown) => createHash("sha1").update(JSON.stringify(v)).digest("hex");

/**
 * Rebuilds one brand's rows from the brands table and its crawl. Unpublished brands lose their rows.
 * With `ifChanged`, a brand whose inputs are unchanged since its last build is left alone.
 * Returns whether anything was rewritten.
 */
export async function refreshBrand(db: Db, code: string, opts: { ifChanged?: boolean } = {}): Promise<boolean> {
  const [row] = await db.select().from(s.brands).where(eq(s.brands.brandCode, code.toUpperCase()));
  if (!row?.brandCode) return false;
  const [crawl] = await db
    .select({ crawledAt: s.brandCrawls.crawledAt, importedAt: s.brandCrawls.importedAt })
    .from(s.brandCrawls)
    .where(eq(s.brandCrawls.brandId, row.id));
  const base = rowToBrand(row);
  const inputsHash = hash([READ_MODEL_VERSION, base, crawl?.importedAt?.toISOString() ?? null]);
  if (opts.ifChanged) {
    const [cur] = await db.select({ h: s.catalogBrands.inputsHash }).from(s.catalogBrands).where(eq(s.catalogBrands.brandCode, row.brandCode));
    if (cur?.h === inputsHash || (!cur && base.status !== "published")) return false;
  }

  let brand: Brand | undefined;
  let models: Model[] = [];
  let logo: string | null = null;
  if (base.status === "published") {
    const site = crawl ? await readBrandCatalog(db, row.brandCode) : null;
    // The same rules the full catalog uses (crawled watches replace sample models, live prices), for one brand.
    const catalog = new Catalog({ brands: [base], source: "database", syncedAt: null }, undefined, undefined, site ? [site] : [], { allImages: true });
    brand = catalog.brands[0];
    models = catalog.publishedModels();
    logo = site?.brandImage ? (site.brandImage.storedUrl ?? site.brandImage.url) : null;
  }

  await db.transaction(async (tx) => {
    await tx.delete(s.catalogWatches).where(eq(s.catalogWatches.brandCode, row.brandCode!));
    await tx.delete(s.catalogBrands).where(eq(s.catalogBrands.brandCode, row.brandCode!));
    if (!brand) return;
    const seen = new Set<string>();
    const rows = models
      .filter((m) => (seen.has(m.slug) ? false : (seen.add(m.slug), true)))
      .map((m, i) => watchRow(m, brand!, i, brand!.imageLicenseStatus));
    await tx.insert(s.catalogBrands).values({
      slug: brand.slug,
      brandCode: brand.brandId!,
      name: brand.name,
      ord: 0,
      letter: letterOf(brand.name),
      country: brand.country,
      city: brand.city,
      priceBand: brand.priceBand,
      styleTags: brand.styleTags,
      words: [...new Set(tokenize(`${brand.name} ${brand.city ?? ""} ${brand.styleTags.join(" ")}`))],
      imageLicense: brand.imageLicenseStatus,
      logoUrl: logo,
      hasStory: !!brand.story,
      modelCount: rows.length,
      photoCount: rows.filter((r) => r.hasImage).length,
      data: brand,
      inputsHash,
    });
    for (let i = 0; i < rows.length; i += CHUNK) await tx.insert(s.catalogWatches).values(rows.slice(i, i + CHUNK));
  });
  return true;
}

/** A–Z positions, with the same comparison the brand list used before (accents and case ignored). */
export async function reorderBrands(db: Db): Promise<void> {
  const rows = await db.select({ slug: s.catalogBrands.slug, name: s.catalogBrands.name }).from(s.catalogBrands);
  rows.sort((a, b) => a.name.localeCompare(b.name, "en", { sensitivity: "base" }) || a.slug.localeCompare(b.slug));
  for (let i = 0; i < rows.length; i += 500) {
    const part = rows.slice(i, i + 500);
    const values = sql.join(part.map((r, j) => sql`(${r.slug}, ${i + j})`), sql`, `);
    await db.execute(sql`update catalog_brands as c set ord = v.ord::int from (values ${values}) as v(slug, ord) where c.slug = v.slug`);
  }
}

/** Rebuilds the given brands (or all), then the A–Z order. */
export async function refreshBrands(db: Db, codes?: string[], opts: { ifChanged?: boolean } = {}): Promise<{ checked: number; rebuilt: number }> {
  const list = codes?.length
    ? codes.map((c) => c.toUpperCase())
    : (await db.select({ code: s.brands.brandCode }).from(s.brands).where(isNotNull(s.brands.brandCode)).orderBy(asc(s.brands.brandCode))).map((r) => r.code!);
  let rebuilt = 0;
  for (const code of list) if (await refreshBrand(db, code, opts)) rebuilt++;
  // Rows for brands that no longer exist at all.
  if (!codes?.length) {
    const known = new Set(list);
    const stale = (await db.select({ code: s.catalogBrands.brandCode }).from(s.catalogBrands)).map((r) => r.code).filter((c) => !known.has(c));
    if (stale.length) {
      await db.delete(s.catalogWatches).where(inArray(s.catalogWatches.brandCode, stale));
      await db.delete(s.catalogBrands).where(inArray(s.catalogBrands.brandCode, stale));
    }
  }
  if (rebuilt) await reorderBrands(db);
  return { checked: list.length, rebuilt };
}

/** How long a rebuild may hold the lease before another process may take over (a crashed build). */
const LEASE_MS = 30 * 60_000;

/**
 * Builds the read model when it is missing or its format changed (run at deploy, scripts/migrate.ts).
 * Only one process rebuilds at a time: the first takes a lease row in catalog_meta and the others
 * skip. Two rebuilds at once (the Vercel build and a Render job) ran the small database out of memory.
 */
export async function ensureReadModel(db: Db): Promise<{ rebuilt: boolean; brands?: number; busy?: boolean }> {
  const [v] = await db.select().from(s.catalogMeta).where(eq(s.catalogMeta.key, "version"));
  if (v?.value === READ_MODEL_VERSION) return { rebuilt: false };
  const now = Date.now();
  const token = `${now}:${Math.random().toString(36).slice(2)}`;
  // Take the lease if nobody holds it or the holder's lease expired; otherwise leave the rebuild to them.
  const taken = await db
    .insert(s.catalogMeta)
    .values({ key: "rebuild_lease", value: token })
    .onConflictDoUpdate({
      target: s.catalogMeta.key,
      set: { value: token },
      setWhere: sql`split_part(${s.catalogMeta.value}, ':', 1)::bigint < ${now - LEASE_MS}`,
    })
    .returning({ value: s.catalogMeta.value });
  if (taken[0]?.value !== token) return { rebuilt: false, busy: true };
  try {
    const r = await refreshBrands(db);
    await db.insert(s.catalogMeta).values({ key: "version", value: READ_MODEL_VERSION }).onConflictDoUpdate({ target: s.catalogMeta.key, set: { value: READ_MODEL_VERSION } });
    return { rebuilt: true, brands: r.rebuilt };
  } finally {
    await db.delete(s.catalogMeta).where(and(eq(s.catalogMeta.key, "rebuild_lease"), eq(s.catalogMeta.value, token)));
  }
}
