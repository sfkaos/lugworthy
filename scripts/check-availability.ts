// Weekly availability check: is each sold-out watch back in stock?
//   npm run check:availability                 # sold-out watches (plus all watches on Shopify/Woo, which cost one request per brand)
//   npm run check:availability -- --all        # every watch, including page-by-page sites
//   npm run check:availability -- --ids BRD-0191
// Updates availability, soldOut, availabilityCheckedAt and appends to
// availabilityHistory in data/catalog/BRD-####.json, then rewrites index.json.
import fs from "node:fs";
import path from "node:path";
import { mapShopifyProduct, mapWooProduct, shopifyCurrency, type Availability, type BrandCatalog, type Watch } from "../lib/crawl/catalog";
import { extractDetail } from "../lib/crawl/detail";
import { allowedGet } from "../lib/crawl/fetch";
import { load } from "../lib/crawl/html";
import { writeCatalogIndex } from "../lib/crawl/index-file";

const args = process.argv.slice(2);
const arg = (n: string) => { const i = args.indexOf(`--${n}`); return i >= 0 ? args[i + 1] : undefined; };
const ids = arg("ids")?.split(",").map((s) => s.trim().toUpperCase());
const all = args.includes("--all");
const concurrency = Number(arg("concurrency") ?? 8);

const outDir = process.env.CATALOG_DIR ? path.resolve(process.env.CATALOG_DIR) : path.resolve(__dirname, "../data/catalog");
const files = fs.readdirSync(outDir).filter((f) => /^BRD-\d+\.json$/.test(f)).filter((f) => !ids || ids.includes(f.replace(".json", "")));

const changes: string[] = [];
const now = new Date().toISOString();

function apply(w: Watch, availability: Availability, brand: string) {
  if (availability === "unknown") return;
  if (w.availability !== availability) {
    changes.push(`${w.id} ${brand} "${w.name}": ${w.availability} -> ${availability}`);
    w.availabilityHistory = [...(w.availabilityHistory ?? []), { at: now, availability }];
  }
  w.availability = availability;
  w.soldOut = availability === "sold_out";
  w.available = !w.soldOut;
  w.availabilityCheckedAt = now;
}

async function bulkShopify(cat: BrandCatalog): Promise<Map<string, Availability> | null> {
  const out = new Map<string, Availability>();
  for (let page = 1; page < 20; page++) {
    const r = await allowedGet(`${cat.website}/products.json?limit=250&page=${page}`, "application/json");
    if (!r?.ok) return page === 1 ? null : out;
    let products: Parameters<typeof mapShopifyProduct>[0][];
    try { products = JSON.parse(r.text).products ?? []; } catch { return page === 1 ? null : out; }
    for (const p of products) {
      const d = mapShopifyProduct(p, cat.website!, shopifyCurrency("", load("")));
      if (d) out.set(d.url, d.availability);
    }
    if (products.length < 250) break;
  }
  return out;
}

async function bulkWoo(cat: BrandCatalog): Promise<Map<string, Availability> | null> {
  const out = new Map<string, Availability>();
  for (let page = 1; page < 10; page++) {
    const r = await allowedGet(`${cat.website}/wp-json/wc/store/v1/products?per_page=100&page=${page}`, "application/json");
    if (!r?.ok) return page === 1 ? null : out;
    let list: Parameters<typeof mapWooProduct>[0][];
    try { list = JSON.parse(r.text); } catch { return page === 1 ? null : out; }
    if (!Array.isArray(list)) break;
    for (const p of list) {
      const d = mapWooProduct(p);
      if (d) out.set(d.url, d.availability);
    }
    if (list.length < 100) break;
  }
  return out;
}

async function checkBrand(file: string) {
  const p = path.join(outDir, file);
  const cat = JSON.parse(fs.readFileSync(p, "utf8")) as BrandCatalog;
  if (cat.status !== "ok" || !cat.website || !cat.watches.length) return;
  const targets = cat.watches.filter((w) => all || w.soldOut || w.availability === "unknown");
  let checked = 0;
  const bulk = cat.platform === "shopify" ? await bulkShopify(cat) : cat.platform === "woocommerce" ? await bulkWoo(cat) : null;
  if (bulk) {
    for (const w of cat.watches) {
      let a = bulk.get(w.url);
      if (!a) continue;
      // Storefront APIs can't tell pre-order from in stock; keep a pre-order the detail page reported.
      if (a === "in_stock" && w.availability === "preorder") a = "preorder";
      apply(w, a, cat.brandName);
      checked++;
    }
  } else {
    for (const w of targets) {
      const r = await allowedGet(w.url);
      if (!r?.ok || !/html/i.test(r.contentType)) continue;
      apply(w, extractDetail(load(r.text)).availability, cat.brandName);
      checked++;
    }
  }
  fs.writeFileSync(p, JSON.stringify(cat, null, 1) + "\n");
  console.log(`${cat.brandId} ${cat.brandName.padEnd(28).slice(0, 28)} checked ${checked}/${cat.watches.length}, sold out now ${cat.watches.filter((w) => w.soldOut).length}`);
}

(async () => {
  const queue = [...files];
  await Promise.all(Array.from({ length: Math.min(concurrency, queue.length) }, async () => {
    while (queue.length) await checkBrand(queue.shift()!);
  }));
  writeCatalogIndex(outDir);
  console.log(`\n${changes.length} availability changes`);
  for (const c of changes) console.log("  " + c);
})();
