// Crawl brand websites for their logo and watch catalog.
//   npm run crawl                       # every Independent, Lugworthy-fit brand with a website
//   npm run crawl -- --ids BRD-0001,BRD-0004
//   npm run crawl -- --limit 20 --max-age-days 7
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

const args = process.argv.slice(2);
const arg = (name: string) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : undefined;
};
const ids = arg("ids")?.split(",").map((s) => s.trim().toUpperCase()).filter(Boolean);
const limit = Number(arg("limit") ?? Infinity);
const concurrency = Number(arg("concurrency") ?? 6);
const maxAgeDays = Number(arg("max-age-days") ?? 0);
const store = imageStoreFromEnv();
const imagesOnly = args.includes("--images-only"); // re-mirror images from existing catalogs, no crawl

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

if (maxAgeDays > 0) {
  const cutoff = Date.now() - maxAgeDays * 86_400_000;
  brands = brands.filter((b) => {
    const prev = readPrev(b.brandId);
    return !prev || Date.parse(prev.crawledAt) < cutoff;
  });
}
brands = brands.slice(0, limit);
console.log(`Crawling ${brands.length} brands, ${concurrency} at a time`);

async function one(b: BrandInput) {
  const t0 = Date.now();
  let cat: BrandCatalog;
  try {
    cat = await crawlBrand(b);
  } catch (e) {
    cat = { brandId: b.brandId, brandName: b.name, website: b.website || null, crawledAt: new Date().toISOString(), status: "unreachable", platform: null, brandImage: null, attribution: null, imageRights: "unknown", watches: [], note: String((e as Error).message).slice(0, 200) };
  }
  const prev = readPrev(b.brandId);
  // Keep the last good data when a site is temporarily down.
  if (prev && prev.status === "ok" && (cat.status === "unreachable" || cat.status === "blocked_by_site" || (cat.status === "no_catalog_found" && prev.watches.length))) {
    cat = { ...prev, note: `Last attempt ${cat.crawledAt}: ${cat.status}${cat.note ? ` (${cat.note})` : ""}; showing data from ${prev.crawledAt}` };
  }
  else cat = mergeWithPrevious(cat, prev);
  if (store) await mirrorAll(cat, prev);
  fs.writeFileSync(fileFor(b.brandId), JSON.stringify(cat, null, 1) + "\n");
  const withImg = cat.watches.filter((w) => w.image).length;
  console.log(`${b.brandId} ${b.name.padEnd(28).slice(0, 28)} ${cat.status.padEnd(17)} ${String(cat.platform ?? "-").padEnd(11)} logo:${cat.brandImage ? cat.brandImage.kind : "none"} watches:${cat.watches.length} (img ${withImg}, sold out ${cat.watches.filter((w) => w.soldOut).length}, specs ${cat.watches.filter((w) => Object.keys(w.specsRaw ?? {}).length).length}) ${((Date.now() - t0) / 1000).toFixed(0)}s`);
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
    const m = await mirrorImage(store, img.url, keyBase);
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
})();
