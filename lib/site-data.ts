// What each page reads. Every function asks the database for only the rows and fields its page
// shows, from the read model (catalog_brands, catalog_watches; built by lib/catalog/index-build.ts).
// Nothing here loads the whole catalog.
//
// Without DATABASE_URL (local dev, preview builds, tests) the same queries run against an in-memory
// Postgres (PGlite) filled from the checked-in snapshot.

import { and, asc, desc, eq, gt, inArray, ne, sql, type SQL, type SQLWrapper } from "drizzle-orm";
import { unstable_cache } from "next/cache";
import { cache } from "react";
import * as s from "@/db/schema";
import { imagesMode, imagesVisible } from "@/lib/brands/media";
import { getDb, type Db } from "@/lib/db/client";
import { MULTI_FACETS, PAGE_SIZE, WR_STEPS, editDistanceLe1, tokenize, typoVariants, type FacetCounts, type Filters, type Range } from "@/lib/filters";
import type { Brand, Model, Variant } from "@/lib/types";

const W = s.catalogWatches;
const B = s.catalogBrands;

// ---------- Shared cache ----------
// Filtered and searched views render on request. Their results are kept in Next's data cache for
// ten minutes, shared by every server, and dropped when the sync runs (revalidateTag(BRANDS_TAG)),
// so a filter combination anyone opened recently loads without touching the database.
// Outside a Next server (tests, scripts) the queries run directly.
/** Same value as BRANDS_TAG in lib/brands/source.ts (not imported: that module bundles the sheet snapshot). */
const BRANDS_TAG = "brands";

function shared<A extends unknown[], R>(name: string, load: (...args: A) => Promise<R>): (...args: A) => Promise<R> {
  if (!process.env.NEXT_RUNTIME) return load;
  return unstable_cache(load, ["site-data", name], { revalidate: 600, tags: [BRANDS_TAG] });
}

// ---------- Connection ----------

let local: Promise<Db> | null = null;

/** The site's database: Postgres when DATABASE_URL is set, else an in-memory copy of the snapshot. */
export function siteDb(): Promise<Db> {
  const db = getDb();
  if (db) return Promise.resolve(db);
  local ??= localDb().catch((e) => {
    local = null;
    throw e;
  });
  return local;
}

async function localDb(): Promise<Db> {
  const [{ PGlite }, { drizzle }, { migrate }, { snapshotRows }, { syncBrandsFromRows }, { importCatalogDir }, { refreshBrands }] = await Promise.all([
    import("@electric-sql/pglite"),
    import("drizzle-orm/pglite"),
    import("drizzle-orm/pglite/migrator"),
    import("@/lib/brands/source"),
    import("@/lib/sync/sheet"),
    import("@/lib/sync/catalog"),
    import("@/lib/catalog/index-build"),
  ]);
  const pg = new PGlite();
  await migrate(drizzle(pg), { migrationsFolder: "db/migrations" });
  const db = drizzle(pg, { schema: s }) as unknown as Db;
  await syncBrandsFromRows(db, snapshotRows());
  await importCatalogDir(db);
  await refreshBrands(db, undefined, { ifChanged: true });
  return db;
}

async function rows<T>(q: SQL): Promise<T[]> {
  const r = (await (await siteDb()).execute(q)) as unknown as T[] | { rows: T[] };
  return Array.isArray(r) ? r : r.rows;
}

/** A text[] parameter (drizzle would otherwise spread a JS array into separate parameters). */
function textArray(values: string[]): SQL {
  const lit = `{${values.map((v) => `"${v.replace(/["\\]/g, "\\$&")}"`).join(",")}}`;
  return sql`${lit}::text[]`;
}

// ---------- Images ----------
// Same rule as imagesVisible() in lib/brands/media.ts, applied per request so IMAGES_PUBLIC on the
// site decides, not the setting wherever the read model was built.

const watchImagesShown = (license: string) => imagesVisible({ imageLicenseStatus: license as Brand["imageLicenseStatus"] }, "lugworthy", "watch");
const logoShown = (license: string) => imagesVisible({ imageLicenseStatus: license as Brand["imageLicenseStatus"] }, "lugworthy", "brand");
const photoVisibleSql = () => sql`(${W.hasImage} and (${W.imageLicense} = 'granted' or (${W.imageLicense} <> 'revoked' and ${imagesMode() === "all"})))`;
const logoVisibleSql = () => sql`(${B.logoUrl} is not null and (${B.imageLicense} = 'granted' or (${B.imageLicense} <> 'revoked' and ${imagesMode() !== "none"})))`;

function hydrate(m: Model, license: string): Model {
  return watchImagesShown(license) ? m : { ...m, images: [] };
}

const cardCols = { card: W.card, imageLicense: W.imageLicense };
const toCards = (list: { card: unknown; imageLicense: string }[]) => list.map((r) => hydrate(r.card as Model, r.imageLicense));

export interface BrandSummary { brand: Brand; logo: string | null; modelCount: number }
const brandCols = { data: B.data, logoUrl: B.logoUrl, imageLicense: B.imageLicense, modelCount: B.modelCount };
const toBrand = (r: { data: unknown; logoUrl: string | null; imageLicense: string; modelCount: number }): BrandSummary => ({
  brand: r.data as Brand,
  logo: r.logoUrl && logoShown(r.imageLicense) ? r.logoUrl : null,
  modelCount: r.modelCount,
});

// Catalog order: brands A–Z, then each brand's own order. Used to break ties.
const catalogOrder = [asc(B.ord), asc(W.ord)];

// ---------- Stats ----------

export const siteStats = cache(async () => {
  const [r] = await rows<{ brands: number; countries: number; models: number }>(sql`
    select (select count(*)::int from catalog_brands) as brands,
           (select count(distinct country)::int from catalog_brands where country is not null) as countries,
           (select count(*)::int from catalog_watches) as models`);
  return { brands: Number(r.brands), countries: Number(r.countries), models: Number(r.models) };
});

// ---------- Home ----------

export async function homeData() {
  const db = await siteDb();
  const photo = photoVisibleSql();
  // The first in-stock watch of each brand, photos first; then everything else.
  const fresh = sql`(${W.inStock} and row_number() over (partition by ${W.brandSlug}, ${W.inStock} order by ${photo} desc, ${W.ord}) = 1)`;
  const ranked = db
    .select({ card: W.card, imageLicense: W.imageLicense, fresh: fresh.as("fresh"), photo: photo.as("photo"), bord: sql<number>`${B.ord}`.as("bord"), word: sql<number>`${W.ord}`.as("word") })
    .from(W)
    .innerJoin(B, eq(B.slug, W.brandSlug))
    .as("ranked");
  const [stats, newReleases, featuredRow, newBrands] = await Promise.all([
    siteStats(),
    db.select({ card: ranked.card, imageLicense: ranked.imageLicense }).from(ranked)
      .orderBy(desc(ranked.fresh), desc(ranked.photo), asc(ranked.bord), asc(ranked.word)).limit(12),
    db.select({ slug: W.brandSlug, n: sql<number>`count(*)::int` }).from(W).where(photo)
      .groupBy(W.brandSlug).orderBy(desc(sql`count(*)`), asc(W.brandSlug)).limit(1),
    db.select(brandCols).from(B).where(sql`${logoVisibleSql()} or ${B.hasStory}`)
      .orderBy(desc(logoVisibleSql()), asc(B.ord)).limit(8),
  ]);
  const featuredSlug = featuredRow[0]?.slug ?? "oak-and-oscar";
  let [featured] = await db.select(brandCols).from(B).where(eq(B.slug, featuredSlug));
  if (!featured) [featured] = await db.select(brandCols).from(B).orderBy(asc(B.ord)).limit(1);
  const featuredModels = featured
    ? toCards(await db.select(cardCols).from(W).where(eq(W.brandSlug, (featured.data as Brand).slug)).orderBy(desc(photo), asc(W.ord)).limit(3))
    : [];
  return {
    stats,
    newReleases: toCards(newReleases),
    featured: featured ? toBrand(featured) : null,
    featuredModels,
    newBrands: newBrands.map(toBrand),
  };
}

// ---------- Brands ----------

export type BrandsSearch = { letter?: string; country?: string; band?: string; tag?: string; specs?: string; page?: string };

async function loadBrandDirectory(sp: BrandsSearch, perPage: number) {
  const db = await siteDb();
  const conds: SQL[] = [];
  if (sp.letter) conds.push(eq(B.letter, sp.letter));
  if (sp.country) conds.push(eq(B.country, sp.country.toUpperCase()));
  if (sp.band) conds.push(eq(B.priceBand, sp.band));
  if (sp.tag) conds.push(sql`${sp.tag} = any(${B.styleTags})`);
  if (sp.specs) conds.push(gt(B.modelCount, 0));
  const where = conds.length ? and(...conds) : undefined;
  const [facets, [{ n: total }]] = await Promise.all([
    rows<{ kind: string; v: string; n: number }>(sql`
      select 'letter' as kind, letter as v, 0 as n from catalog_brands group by letter
      union all select 'country', country, 0 from catalog_brands where country is not null group by country
      union all select 'tag', t, count(*)::int from catalog_brands, unnest(style_tags) t group by t having count(*) >= 4`),
    db.select({ n: sql<number>`count(*)::int` }).from(B).where(where),
  ]);
  const pages = Math.max(1, Math.ceil(Number(total) / perPage));
  const page = Math.min(Math.max(Number(sp.page ?? 1) || 1, 1), pages);
  const shown = await db.select(brandCols).from(B).where(where)
    .orderBy(desc(sql`${B.modelCount} > 0`), asc(B.ord)).limit(perPage).offset((page - 1) * perPage);
  return {
    brandCount: (await siteStats()).brands,
    letters: facets.filter((f) => f.kind === "letter").map((f) => f.v).sort(),
    countries: facets.filter((f) => f.kind === "country").map((f) => f.v),
    tags: facets.filter((f) => f.kind === "tag").sort((a, b) => Number(b.n) - Number(a.n) || a.v.localeCompare(b.v)).map((f) => f.v),
    total: Number(total),
    page,
    pages,
    shown: shown.map(toBrand),
  };
}

/** One brand and its watches (cards), for the brand page. */
export const brandPage = cache(async (slug: string) => {
  const db = await siteDb();
  const [[b], models] = await Promise.all([
    db.select(brandCols).from(B).where(eq(B.slug, slug)),
    db.select(cardCols).from(W).where(eq(W.brandSlug, slug)).orderBy(asc(W.ord)),
  ]);
  return b ? { ...toBrand(b), models: toCards(models) } : null;
});

export const brandSlugs = cache(async () => (await (await siteDb()).select({ slug: B.slug }).from(B).orderBy(asc(B.ord))).map((r) => r.slug));

/** Slug and name of every brand (the claim form's list). */
export async function brandNames() {
  return (await siteDb()).select({ slug: B.slug, name: B.name }).from(B).orderBy(asc(B.ord));
}

export async function brandBySlug(slug: string): Promise<Brand | null> {
  const [r] = await (await siteDb()).select({ data: B.data }).from(B).where(eq(B.slug, slug));
  return (r?.data as Brand | undefined) ?? null;
}

// ---------- One watch ----------

export const modelPage = cache(async (brandSlug: string, slug: string) => {
  const db = await siteDb();
  const [[row], [b]] = await Promise.all([
    db.select({ detail: W.detail, imageLicense: W.imageLicense }).from(W).where(eq(W.id, `${brandSlug}~${slug}`)),
    db.select(brandCols).from(B).where(eq(B.slug, brandSlug)),
  ]);
  if (!row || !b) return null;
  const model = hydrate(row.detail as Model, row.imageLicense);
  const [more, similar] = await Promise.all([
    db.select(cardCols).from(W).where(and(eq(W.brandSlug, brandSlug), ne(W.slug, slug))).orderBy(asc(W.ord)).limit(4),
    similarModels(db, model),
  ]);
  return { model, ...toBrand(b), more: toCards(more), similar };
});

/** Spec-similarity for "Similar models": style overlap, then size and price distance (same weights as before). */
async function similarModels(db: Db, m: Model, limit = 4): Promise<Model[]> {
  const d0 = m.specs.caseDiameterMm ?? 40;
  const p0 = Math.min(...m.variants.map((v) => v.priceUsd));
  const styles = textArray(m.styles.filter((x) => x !== "other"));
  const score = sql`(
    (select count(*) from unnest(${W.styles}) st where st = any(${styles}))::float * 3
    - abs(coalesce(${W.dia}, ${d0}) - ${d0}) * 0.5
    - abs(${W.minPrice} - ${p0})::float / ${Math.max(p0, 1)} * 2
    - (case when ${W.movement} is not distinct from ${m.specs.movementType} then 0 else 1 end))`;
  const list = await db.select(cardCols).from(W).innerJoin(B, eq(B.slug, W.brandSlug))
    .where(ne(W.brandSlug, m.brandSlug)).orderBy(desc(score), ...catalogOrder).limit(limit);
  return toCards(list);
}

/** Hand-curated watches, prerendered at build. */
export async function seedModelParams() {
  return (await siteDb()).select({ brand: W.brandSlug, model: W.slug }).from(W).where(eq(W.origin, "seed"));
}

export async function modelsByIds(ids: string[]): Promise<{ model: Model; brand: Brand }[]> {
  if (!ids.length) return [];
  const db = await siteDb();
  const list = await db.select({ id: W.id, detail: W.detail, imageLicense: W.imageLicense, brand: B.data })
    .from(W).innerJoin(B, eq(B.slug, W.brandSlug)).where(inArray(W.id, ids));
  const byId = new Map(list.map((r) => [r.id, { model: hydrate(r.detail as Model, r.imageLicense), brand: r.brand as Brand }]));
  return ids.map((id) => byId.get(id)).filter((x): x is { model: Model; brand: Brand } => !!x);
}

export async function findVariant(variantId: string): Promise<{ model: Model; variant: Variant; brand: Brand } | null> {
  const db = await siteDb();
  const [r] = await db.select({ detail: W.detail, brand: B.data }).from(W).innerJoin(B, eq(B.slug, W.brandSlug))
    .where(sql`${W.variantIds} @> ${textArray([variantId])}`).orderBy(...catalogOrder).limit(1);
  if (!r) return null;
  const model = r.detail as Model;
  const variant = model.variants.find((v) => v.id === variantId);
  return variant ? { model, variant, brand: r.brand as Brand } : null;
}

export async function sitemapEntries() {
  const db = await siteDb();
  const [brands, models] = await Promise.all([
    db.select({ slug: B.slug, at: sql<string | null>`${B.data}->>'lastSyncedAt'` }).from(B).orderBy(asc(B.ord)),
    db.select({ brand: W.brandSlug, slug: W.slug, at: W.importedAt }).from(W).orderBy(asc(W.brandSlug), asc(W.ord)),
  ]);
  return { brands, models };
}

// ---------- Hubs ----------

const HUB_LIMIT = 48;

export async function styleHub(style: string): Promise<Model[]> {
  const db = await siteDb();
  return toCards(await db.select(cardCols).from(W).innerJoin(B, eq(B.slug, W.brandSlug))
    .where(sql`${style} = any(${W.styles})`).orderBy(desc(W.inStock), ...catalogOrder).limit(HUB_LIMIT));
}

export async function caliberHub(caliber: string): Promise<Model[]> {
  const db = await siteDb();
  return toCards(await db.select(cardCols).from(W).innerJoin(B, eq(B.slug, W.brandSlug))
    .where(eq(W.caliber, caliber)).orderBy(...catalogOrder).limit(HUB_LIMIT));
}

export const calibersInUse = cache(async (): Promise<string[]> => {
  const list = await (await siteDb()).selectDistinct({ c: W.caliber }).from(W).where(sql`${W.caliber} is not null`);
  return list.map((r) => r.c!);
});

export async function countryCodes(): Promise<string[]> {
  const list = await (await siteDb()).selectDistinct({ c: B.country }).from(B).where(sql`${B.country} is not null`);
  return list.map((r) => r.c!);
}

export async function countryHub(iso: string) {
  const db = await siteDb();
  const [brands, models] = await Promise.all([
    db.select(brandCols).from(B).where(eq(B.country, iso)).orderBy(asc(B.ord)),
    db.select(cardCols).from(W).innerJoin(B, eq(B.slug, W.brandSlug)).where(eq(B.country, iso)).orderBy(...catalogOrder).limit(HUB_LIMIT),
  ]);
  return { brands: brands.map(toBrand), models: toCards(models) };
}

// ---------- Search and browse ----------

const FIELDS = [
  { w: W.w5, r: W.r5, weight: 5 },
  { w: W.w4, r: W.r4, weight: 4 },
  { w: W.w3, r: W.r3, weight: 3 },
  { w: W.w2, r: W.r2, weight: 2 },
  { w: W.w1, r: W.r1, weight: 1 },
];

/**
 * Words in the catalog within one typo of each query token (tokens of 5+ letters), looked up once
 * so the per-row check is a small array overlap.
 */
async function typoWords(tokens: string[], vocabulary: SQL): Promise<Map<string, string[]>> {
  const long = tokens.filter((t) => t.length >= 5);
  const out = new Map<string, string[]>();
  if (!long.length) return out;
  const found = await rows<{ x: string }>(sql`select distinct x from ${vocabulary} where x = any(${textArray(long.flatMap(typoVariants))})`);
  for (const t of long) out.set(t, found.map((r) => r.x).filter((x) => editDistanceLe1(x, t)));
  return out;
}

/** Per query token, the best field match (exact word, prefix or substring, one typo), as textScore() scores it. */
async function tokenScores(q: string): Promise<SQL[]> {
  const tokens = tokenize(q);
  const typos = await typoWords(tokens, sql`catalog_watches, unnest(w5 || w4 || w3 || w2 || w1) x`);
  return tokens.map((t) => {
    const near = typos.get(t)?.length ? textArray(typos.get(t)!) : null;
    const parts = FIELDS.map(({ w, r, weight }) => sql`case
      when ${t} = any(${w}) then ${weight * 2}::float
      when position(${t} in ${r}) > 0 or position(${" " + t} in ' ' || array_to_string(${w}, ' ')) > 0 then ${weight * 1.5}::float
      ${near ? sql`when ${w} && ${near} then ${weight}::float` : sql``}
      else 0::float end`);
    return sql`greatest(${sql.join(parts, sql`, `)})`;
  });
}

/** Keeps a value for ten minutes per server (the pages' cache time), so repeat requests skip the query. */
function memo<T>(load: () => Promise<T>, ttlMs = 600_000): () => Promise<T> {
  let hit: { at: number; v: Promise<T> } | null = null;
  return () => {
    if (!hit || Date.now() - hit.at > ttlMs) {
      const v = load();
      hit = { at: Date.now(), v };
      v.catch(() => (hit = null));
    }
    return hit.v;
  };
}

/** Every facet value in the catalog, as "facet:value" tags. */
const facetUniverse = memo(async () => (await rows<{ t: string }>(sql`select distinct unnest(tags) as t from catalog_watches`)).map((r) => r.t));

const RANGE_COLS = { price: sql`(${W.minPrice}::float / 100)`, dia: sql`${W.dia}`, l2l: sql`${W.l2l}`, thk: sql`${W.thk}` };
const FACET_COLS: Record<string, SQLWrapper> = {
  mov: W.fMov, style: W.fStyle, dial: W.fDial, strap: W.fStrap, avail: W.fAvail, cal: W.fCal,
  crystal: W.fCrystal, mat: W.fMat, lug: W.fLug, comp: W.fComp, country: W.fCountry,
};

function rangeSql(col: SQL, r: Range): SQL {
  const parts = [sql`${col} is not null`];
  if (r.min != null) parts.push(sql`${col} >= ${r.min}`);
  if (r.max != null) parts.push(sql`${col} <= ${r.max}`);
  return and(...parts)!;
}

/** Each active filter as SQL, keyed by facet, so facet counts can leave their own facet out. */
function filterConds(f: Filters): { key: string; cond: SQL }[] {
  const out: { key: string; cond: SQL }[] = [];
  for (const k of ["price", "dia", "l2l", "thk"] as const) if (f[k]) out.push({ key: k, cond: rangeSql(RANGE_COLS[k], f[k]!) });
  if (f.wr) out.push({ key: "wr", cond: sql`coalesce(${W.wr}, 0) >= ${f.wr}` });
  for (const k of MULTI_FACETS) {
    const want = f[k as keyof Filters] as string[] | undefined;
    if (want?.length) out.push({ key: k, cond: sql`${FACET_COLS[k]} && ${textArray(want)}` });
  }
  return out;
}

const all = (conds: SQL[]) => (conds.length ? and(...conds)! : sql`true`);

export interface BrowsePage {
  total: number;
  items: Model[];
  page: number;
  pages: number;
  counts: FacetCounts;
  wrCounts: Record<number, number>;
}

/**
 * The Watches page in one database round trip: one page of results, facet counts and
 * water-resistance counts. A text query is scored once per watch, then everything else reads
 * those matches.
 */
async function loadBrowseWatches(f: Filters): Promise<BrowsePage> {
  const scores = f.q ? await tokenScores(f.q) : [];
  const conds = filterConds(f);
  const page = f.page ?? 1;

  const sort = f.sort ?? (f.q ? "relevance" : "newest");
  const order = {
    relevance: sql`score desc`,
    price_asc: sql`${W.minPrice} asc`,
    price_desc: sql`${W.minPrice} desc`,
    diameter_asc: sql`${W.dia} asc nulls last`,
    diameter_desc: sql`${W.dia} desc nulls last`,
    thinnest: sql`${W.thk} asc nulls last`,
    newest: sql`${W.inStock} desc`,
  }[sort];

  // One pass over the table. Each watch gets the number of active filters it fails and, when it
  // fails exactly one, which. A facet's counts leave that facet's own filter out, so a watch counts
  // toward facet k when it fails nothing, or fails only k. Watches failing two or more are dropped
  // before anything is unnested, and a text query is scored once per watch.
  const keyed = conds.map((c) => ({ key: c.key, fail: sql`not coalesce(${c.cond}, false)` }));
  const misses = keyed.length ? sql.join(keyed.map((c) => sql`(case when ${c.fail} then 1 else 0 end)`), sql` + `) : sql`0`;
  const missKey = keyed.length ? sql`(case ${sql.join(keyed.map((c) => sql`when ${c.fail} then ${c.key}`), sql` `)} end)` : sql`null::text`;
  const textHit = scores.length ? all(scores.map((sc) => sql`${sc} > 0`)) : sql`true`;
  const score = scores.length ? sql`(${sql.join(scores, sql` + `)})` : sql`0`;
  const counts = (key: string) => sql`(misses = 0 or miss_key = ${key})`;
  const wrCols = WR_STEPS.map((st) => sql`'${sql.raw(String(st))}', (count(*) filter (where ${counts("wr")} and coalesce(wr, 0) >= ${st}))::int`);

  const [r] = await rows<{ total: number; facets: { t: string; n: number }[] | null; wr: Record<string, number>; items: { card: Model; license: string }[] | null }>(sql`
    with m as materialized (
      select * from (
        select catalog_watches.id, catalog_watches.ord, in_stock, min_price, dia, thk, wr, tags,
          catalog_brands.ord as brand_ord,
          ${misses} as misses, ${missKey} as miss_key, ${score} as score
        from catalog_watches join catalog_brands on catalog_brands.slug = catalog_watches.brand_slug
        where ${textHit}
      ) x where misses <= 1
    ),
    total as (select count(*)::int as n from m where misses = 0)
    select
      (select n from total) as total,
      (select json_agg(x) from (
        select t, count(*)::int as n from (
          select t, split_part(t, ':', 1) as facet, misses, miss_key from m, unnest(m.tags) t
        ) u where misses = 0 or miss_key = facet
        group by t
      ) x) as facets,
      (select json_build_object(${sql.join(wrCols, sql`, `)}) from m) as wr,
      (select json_agg(json_build_object('card', cw.card, 'license', cw.image_license) order by p.rn)
        from (
          select id, row_number() over (order by ${order}, brand_ord asc, catalog_watches.ord asc) as rn
          from m as catalog_watches where misses = 0
        ) p
        join catalog_watches as cw on cw.id = p.id
        where p.rn > (select (least(${page}, greatest(1, ceil(n / ${PAGE_SIZE}::float)::int)) - 1) * ${PAGE_SIZE} from total)
          and p.rn <= (select least(${page}, greatest(1, ceil(n / ${PAGE_SIZE}::float)::int)) * ${PAGE_SIZE} from total)
      ) as items`);

  const total = Number(r.total);
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  // Every value a facet has anywhere in the catalog is listed (count 0 = shown disabled).
  const facetCounts: FacetCounts = Object.fromEntries(MULTI_FACETS.map((k) => [k, {} as Record<string, number>]));
  const put = (tag: string, n: number) => {
    const i = tag.indexOf(":");
    facetCounts[tag.slice(0, i)][tag.slice(i + 1)] = n;
  };
  for (const t of await facetUniverse()) put(t, 0);
  for (const x of r.facets ?? []) put(x.t, Number(x.n));
  const wrCounts = Object.fromEntries(WR_STEPS.map((st) => [st, Number(r.wr?.[String(st)] ?? 0)]));
  const items = (r.items ?? []).map((x) => hydrate(x.card, x.license));
  return { total, items, page: Math.min(page, pages), pages, counts: facetCounts, wrCounts };
}

/** Lowest and highest values for the Watches page's range sliders, and the watch count. */
export const browseBounds = cache(async () => loadBounds());
const loadBounds = shared("browseBounds", async () => {
  const [r] = await rows<Record<string, number | null>>(sql`
    select min(min_price) as p0, max(min_price) as p1, min(dia) as d0, max(dia) as d1, min(l2l) as l0, max(l2l) as l1,
           min(thk) as t0, max(thk) as t1, count(*)::int as n
    from catalog_watches`);
  const num = (v: number | null | undefined) => (v == null ? null : Number(v));
  return {
    price: [num(r.p0), num(r.p1)].map((v) => (v == null ? null : v / 100)) as [number | null, number | null],
    dia: [num(r.d0), num(r.d1)] as [number | null, number | null],
    l2l: [num(r.l0), num(r.l1)] as [number | null, number | null],
    thk: [num(r.t0), num(r.t1)] as [number | null, number | null],
    models: Number(r.n),
  };
});

/** The search page: up to 12 brands and 60 watches. */
async function loadSearch(q: string): Promise<{ brands: BrandSummary[]; models: Model[] }> {
  const db = await siteDb();
  const tokens = tokenize(q);
  const lower = q.toLowerCase();
  const [scores, typos] = await Promise.all([tokenScores(q), typoWords(tokens, sql`catalog_brands, unnest(words) x`)]);
  const prefix = (t: string) => sql`position(${" " + t} in ' ' || array_to_string(${B.words}, ' ')) > 0`;
  const brandMatch = tokens.map((t) => {
    const near = (typos.get(t) ?? []).filter((x) => x.length >= 4);
    return near.length ? sql`(${prefix(t)} or ${B.words} && ${textArray(near)})` : prefix(t);
  });
  const prefixHits = tokens.map((t) => sql`(case when ${prefix(t)} then 2 else 0 end)`);
  const brandScore = sql`(case when lower(${B.name}) = ${lower} then 10 else 0 end + case when position(${lower} in lower(${B.name})) > 0 then 5 else 0 end${prefixHits.length ? sql` + ${sql.join(prefixHits, sql` + `)}` : sql``})`;
  const [brands, models] = await Promise.all([
    tokens.length
      ? db.select(brandCols).from(B).where(and(...brandMatch, sql`${brandScore} > 0`)).orderBy(desc(brandScore), asc(B.ord)).limit(12)
      : Promise.resolve([]),
    scores.length
      ? rows<{ card: Model; license: string }>(sql`
          select cw.card, cw.image_license as license
          from (select id, brand_slug, ord, (${sql.join(scores, sql` + `)}) as score, ${all(scores.map((sc) => sql`${sc} > 0`))} as hit
                from catalog_watches) s
          join catalog_watches as cw on cw.id = s.id
          join catalog_brands on catalog_brands.slug = s.brand_slug
          where s.hit order by s.score desc, catalog_brands.ord, s.ord limit 60`)
      : Promise.resolve([]),
  ]);
  return { brands: brands.map(toBrand), models: models.map((m) => hydrate(m.card, m.license)) };
}

/** One page of the brand directory, plus the filter options. */
export const brandDirectory = shared("brandDirectory", loadBrandDirectory);
/** The Watches page: one page of results, facet counts and water-resistance counts. */
export const browseWatches = shared("browseWatches", loadBrowseWatches);
/** The search page: up to 12 brands and 60 watches. */
export const searchSite = shared("searchSite", loadSearch);
