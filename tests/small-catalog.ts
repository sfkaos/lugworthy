// A smaller copy of data/catalog for tests that load the crawl into an in-memory database.
// The full crawl (tens of thousands of watches) takes minutes to import into PGlite, and it grows
// every month. These tests compare two ways of reading the same data, so a fixed-size slice
// checks the same things in seconds.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import type { CatalogIndex } from "@/lib/brands/media";

// Brands the tests look up by name: Lorier, Oak & Oscar, Dryden, 22 Design Studio, 11i11 saat.
const NAMED = ["BRD-0348", "BRD-0423", "BRD-0191", "BRD-0002", "BRD-0001"];
const MAX_WATCHES = 2500;

/** Writes the slice to a temp folder and points CATALOG_DIR at it. Returns the folder. */
export function useSmallCatalog(): string {
  const src = path.join(process.cwd(), "data", "catalog");
  const index = JSON.parse(fs.readFileSync(path.join(src, "index.json"), "utf8")) as CatalogIndex;
  const named = new Set(NAMED);
  let watches = index.brands.filter((r) => named.has(r.brandId)).reduce((n, r) => n + (r.watchCount ?? 0), 0);
  const keep = new Set(named);
  for (const r of index.brands) {
    if (keep.has(r.brandId)) continue;
    if (watches + (r.watchCount ?? 0) > MAX_WATCHES) continue;
    keep.add(r.brandId);
    watches += r.watchCount ?? 0;
  }
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "lugworthy-catalog-"));
  const rows = index.brands.filter((r) => keep.has(r.brandId));
  fs.writeFileSync(path.join(dir, "index.json"), JSON.stringify({ ...index, brands: rows }));
  for (const r of rows) {
    const f = path.join(src, `${r.brandId}.json`);
    if (fs.existsSync(f)) fs.copyFileSync(f, path.join(dir, `${r.brandId}.json`));
  }
  process.env.CATALOG_DIR = dir;
  return dir;
}
