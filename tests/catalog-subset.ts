// Vitest global setup: the checked-in catalog (data/catalog) now holds every crawled brand
// (~36k watches), which makes the in-memory database tests take minutes. Tests run on a fixed
// slice of it instead: the brands the tests name, plus the first brands by ID until there are
// enough watches for the browse and search comparisons.
import fs from "node:fs";
import path from "node:path";

export const SUBSET_DIR = path.resolve(__dirname, "../node_modules/.cache/lugworthy-test-catalog");
const SOURCE = path.resolve(__dirname, "../data/catalog");
const NAMED = ["BRD-0001", "BRD-0002", "BRD-0191", "BRD-0348", "BRD-0423"];
const TARGET_WATCHES = 1500;

export default function setup() {
  const index = JSON.parse(fs.readFileSync(path.join(SOURCE, "index.json"), "utf8")) as { brands: { brandId: string; watchCount?: number }[] };
  const keep = new Set(NAMED);
  let watches = 0;
  for (const b of [...index.brands].sort((a, z) => a.brandId.localeCompare(z.brandId))) {
    if (keep.has(b.brandId)) watches += b.watchCount ?? 0;
  }
  for (const b of [...index.brands].sort((a, z) => a.brandId.localeCompare(z.brandId))) {
    if (watches >= TARGET_WATCHES) break;
    if (keep.has(b.brandId) || !b.watchCount) continue;
    keep.add(b.brandId);
    watches += b.watchCount;
  }
  fs.rmSync(SUBSET_DIR, { recursive: true, force: true });
  fs.mkdirSync(SUBSET_DIR, { recursive: true });
  const brands = index.brands.filter((b) => keep.has(b.brandId));
  for (const b of brands) {
    const f = path.join(SOURCE, `${b.brandId}.json`);
    if (fs.existsSync(f)) fs.copyFileSync(f, path.join(SUBSET_DIR, `${b.brandId}.json`));
  }
  fs.writeFileSync(path.join(SUBSET_DIR, "index.json"), JSON.stringify({ ...index, brands }));
}
