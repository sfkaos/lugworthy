// Crawl brand websites for their logo and watch catalog.
//   npm run crawl                       # every Independent, Lugworthy-fit brand with a website
//   npm run crawl -- --ids BRD-0001,BRD-0004
//   npm run crawl -- --limit 20 --max-age-days 7
//   npm run crawl -- --skip-since 2026-11-01   # resume: skip brands crawled since then
//   npm run crawl -- --save-each        # also save each brand to the database as soon as it is crawled
// Brands come from data/raw/master.json (snapshot of the master sheet, public columns only).
// Output: data/catalog/BRD-####.json per brand + data/catalog/index.json.
// Re-runnable: brands crawled within --max-age-days are skipped, and a failed
// fetch keeps the previous good catalog instead of wiping it.
import fs from "node:fs";
import path from "node:path";
import { crawlBrand, mergeWithPrevious, type BrandCatalog, type BrandInput } from "../lib/crawl/catalog";
import type { ImageRef } from "../lib/crawl/html";
import { imageStoreFromEnv, mirrorImage } from "../lib/crawl/store";
import { writeCatalogIndex } from "../lib/crawl/index-file";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "../db/schema";
import type { Db } from "../lib/db/client";
import { withSsl } from "../lib/db/ssl";
import { importBrandCatalogs } from "../lib/sync/catalog";

const args = process.argv.slice(2);
const arg = (name: string) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : undefined;
};
const ids = arg("ids")?.split(",").map((s) => s.trim().toUpperCase()).filter(Boolean);
const limit = Number(arg("limit") ?? Infinity);
const concurrency = Number(arg("concurrency") ?? 6);
const maxAgeDays = Number(arg("max-age-days") ?? 0);
const skipSince = arg("skip-since"); // ISO date: skip brands already crawled at or after it
const store = imageStoreFromEnv();
let storeErrors = 0;
const imagesOnly = args.includes("--images-only"); // re-mirror images from existing catalogs, no crawl
// With --save-each, a run that stops early (time limit, crash) keeps every brand it finished,
// and a rerun with --max-age-days skips them.
const saveEach = args.includes("--save-each") ? openDb() : null;

function openDb() {
  const url = process.env.DATABASE_URL?.trim() || process.env.POSTGRES_URL?.trim();
  if (!url) throw new Error("--save-each needs DATABASE_URL");
  const client = postgres(withSsl(url), { max: 1, prepare: false });
  return { client, db: drizzle(client, { schema }) as unknown as Db };
}

const root = path.resolve(__dirname, "..");
const outDir = process.env.CATALOG_DIR ? path.resolve(process.env.CATALOG_DIR) : path.join(root, "data/catalog");
fs.mkdirSync(outDir, { recursive: true });

const master = JSON.parse(fs.readFileSync(path.join(root, "data/raw/master.json"), "utf8")) as { columns: string[]; rows: string[][] };
const col = (n: string) => master.columns.indexOf(n);
const [iId, iName, iSite, iOwn, iFit] = ["Brand ID", "Brand", "Website", "Ownership", "Lugworthy fit"].map(col);

let brands: BrandInput[] = master.rows
  .filter((r) => r[iOwn] === "Independent" && r[iFit] === "Yes")
  .map((r) => ({ brandId: r[iId].toUpperCase(), name: r[iName], website: r[iSite] ?? "" }));
if (ids) brands = brands.filter((b) => ids.includes(b.brandId));

const fileFor = (id: string) => path.join(outDir, `${id}.json`);
const readPrev = (id: string): BrandCatalog | null => {
  try { return JSON.parse(fs.readFileSync(fileFor(id), "utf8")); } catch { return null; }
};

if (maxAgeDays > 0 || skipSince) {
  const cutoff = skipSince ? Date.parse(skipSince) : Date.now() - maxAgeDays * 86_400_000;
  if (Number.isNaN(cutoff)) throw new Error(`bad --skip-since ${skipSince}`);
  brands = brands.filter((b) => {
    const prev = readPrev(b.brandId);
    return !prev || Date.parse(prev.crawledAt) < cutoff;
  });
}
// A brand that was being crawled when the process crashed is noted in this file. After two
// crashes it is skipped for this run, so one bad site can't stop the whole crawl.
const inflightFile = path.join(outDir, ".inflight.log");
const crashCounts = new Map<string, number>();
try {
  for (const line of fs.readFileSync(inflightFile, "utf8").split("\n")) {
    const [kind, id] = line.split(" ");
    if (kind === "start") crashCounts.set(id, (crashCounts.get(id) ?? 0) + 1);
    if (kind === "done") crashCounts.delete(id);
  }
} catch { /* no earlier attempt */ }
if (crashCounts.size) console.error(`In progress when the last attempt stopped: ${[...crashCounts].map(([id, n]) => `${id} (x${n})`).join(", ")}`);
const poisoned = [...crashCounts].filter(([, n]) => n >= 2).map(([id]) => id);
if (poisoned.length) {
  console.error(`Skipping brands that were in progress during 2 crashes: ${poisoned.join(", ")}`);
  brands = brands.filter((b) => !poisoned.includes(b.brandId));
}
const mark = (kind: "start" | "done", id: string) => fs.appendFileSync(inflightFile, `${kind} ${id}\n`);
brands = brands.slice(0, limit);
console.log(`Crawling ${brands.length} brands, ${concurrency} at a time`);

async function one(b: BrandInput) {
  const t0 = Date.now();
  mark("start", b.brandId);
  let cat: BrandCatalog;
  try {
    cat = await crawlBrand(b);
  } catch (e) {
    cat = { brandId: b.brandId, brandName: b.name, website: b.website || null, crawledAt: new Date().toISOString(), status: "unreachable", platform: null, brandImage: null, attribution: null, imageRights: "unknown", collections: [], watches: [], note: String((e as Error).message).slice(0, 200) };
  }
  const prev = readPrev(b.brandId);
  // Keep the last good data when a site is temporarily down.
  if (prev && prev.status === "ok" && (cat.status === "unreachable" || cat.status === "blocked_by_site" || (cat.status === "no_catalog_found" && prev.watches.length))) {
    cat = { ...prev, note: `Last attempt ${cat.crawledAt}: ${cat.status}${cat.note ? ` (${cat.note})` : ""}; showing data from ${prev.crawledAt}` };
  }
  else cat = mergeWithPrevious(cat, prev);
  if (store) await mirrorAll(cat, prev);
  fs.writeFileSync(fileFor(b.brandId), JSON.stringify(cat, null, 1) + "\n");
  if (saveEach) {
    try { await importBrandCatalogs(saveEach.db, [cat as unknown as Parameters<typeof importBrandCatalogs>[1][number]]); }
    catch (e) { console.error(`${b.brandId} database save failed: ${String((e as Error).message).slice(0, 200)}`); }
  }
  mark("done", b.brandId);
  const withImg = cat.watches.filter((w) => w.image).length;
  console.log(`${b.brandId} ${b.name.padEnd(28).slice(0, 28)} ${cat.status.padEnd(17)} ${String(cat.platform ?? "-").padEnd(11)} logo:${cat.brandImage ? cat.brandImage.kind : "none"} watches:${cat.watches.length} (img ${withImg}, sold out ${cat.watches.filter((w) => w.soldOut).length}, specs ${cat.watches.filter((w) => Object.keys(w.specsRaw ?? {}).length).length}) ${((Date.now() - t0) / 1000).toFixed(0)}s heap ${Math.round(process.memoryUsage().heapUsed / 1e6)}MB`);
}

/** Stores the logo and each watch's main photo; reuses earlier copies when the source URL is unchanged. */
async function mirrorAll(cat: BrandCatalog, prev: BrandCatalog | null) {
  if (!store) return;
  const known = new Map<string, string>();
  const remember = (i: ImageRef | null | undefined) => { if (i?.storedUrl && i.storedUrl.startsWith("file://") === (store!.name === "local")) known.set(i.url, i.storedUrl); };
  remember(prev?.brandImage);
  prev?.watches.forEach((w) => { remember(w.image); w.images.forEach(remember); });
  const fill = async (img: ImageRef, keyBase: string) => {
    const hit = known.get(img.url);
    if (hit) { img.storedUrl = hit; return; }
    let m: Awaited<ReturnType<typeof mirrorImage>> = null;
    try {
      m = await mirrorImage(store, img.url, keyBase);
    } catch (e) {
      // Storage errors (bad key, outage) must not stop the crawl; the photo stays a link until next run.
      storeErrors++;
      if (storeErrors <= 3 || storeErrors % 500 === 0) console.error(`image store error #${storeErrors}: ${String((e as Error).message).slice(0, 200)}`);
    }
    img.storedUrl = m?.storedUrl ?? null;
    if (m?.width) { img.width = m.width; img.height = m.height; }
  };
  if (cat.brandImage) await fill(cat.brandImage, `brands/${cat.brandId}/logo`);
  for (const w of cat.watches) {
    if (!w.image) continue;
    await fill(w.image, `watches/${cat.brandId}/${w.id.split("/")[1]}`);
    if (w.images[0]?.url === w.image.url) w.images[0] = { ...w.image };
  }
}

function writeIndex() {
  const rows = writeCatalogIndex(outDir);
  const by = rows.reduce<Record<string, number>>((a, r) => ((a[r.status] = (a[r.status] ?? 0) + 1), a), {});
  console.log(`index.json: ${rows.length} brands`, by, `logos: ${rows.filter((r) => r.brandImageUrl).length}, watches: ${rows.reduce((s, r) => s + r.watchCount, 0)}, sold out: ${rows.reduce((s, r) => s + r.soldOutCount, 0)}`);
}

(async () => {
  if (imagesOnly) {
    for (const b of brands) {
      const cat = readPrev(b.brandId);
      if (!cat) continue;
      await mirrorAll(cat, cat);
      fs.writeFileSync(fileFor(b.brandId), JSON.stringify(cat, null, 1) + "\n");
      console.log(`${b.brandId} images: ${cat.watches.filter((w) => w.image?.storedUrl).length}/${cat.watches.length} stored, logo ${cat.brandImage?.storedUrl ? "stored" : "no"}`);
    }
    writeIndex();
    return;
  }
  const queue = [...brands];
  await Promise.all(Array.from({ length: Math.min(concurrency, queue.length) }, async () => {
    while (queue.length) await one(queue.shift()!);
  }));
  writeIndex();
})().finally(() => saveEach?.client.end());
