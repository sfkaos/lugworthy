// Writes data/catalog/index.json: one summary row per brand catalog.
import fs from "node:fs";
import path from "node:path";
import type { BrandCatalog } from "./catalog";

export function writeCatalogIndex(outDir: string) {
  const files = fs.readdirSync(outDir).filter((f) => /^BRD-\d+\.json$/.test(f)).sort();
  // One file at a time: holding every parsed catalog at once costs over 300 MB.
  const rows = files.map((f) => summarize(JSON.parse(fs.readFileSync(path.join(outDir, f), "utf8")) as BrandCatalog));
  fs.writeFileSync(path.join(outDir, "index.json"), JSON.stringify({ generatedAt: new Date().toISOString(), brands: rows }, null, 1) + "\n");
  return rows;
}

function summarize(c: BrandCatalog) {
  return {
    brandId: c.brandId,
    status: c.status,
    brandImageUrl: c.brandImage?.url ?? null,
    brandImageStoredUrl: c.brandImage?.storedUrl ?? null,
    watchCount: c.watches.length,
    soldOutCount: c.watches.filter((w) => w.soldOut).length,
    crawledAt: c.crawledAt,
    availabilityCheckedAt: c.watches.reduce<string | null>((m, w) => (!m || (w.availabilityCheckedAt ?? "") > m ? w.availabilityCheckedAt ?? m : m), null),
  };
}
