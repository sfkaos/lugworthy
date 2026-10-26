// Writes data/catalog/index.json: one summary row per brand catalog.
import fs from "node:fs";
import path from "node:path";
import type { BrandCatalog } from "./catalog";

export function writeCatalogIndex(outDir: string) {
  const files = fs.readdirSync(outDir).filter((f) => /^BRD-\d+\.json$/.test(f)).sort();
  const rows = files.map((f) => JSON.parse(fs.readFileSync(path.join(outDir, f), "utf8")) as BrandCatalog).map((c) => ({
    brandId: c.brandId,
    status: c.status,
    brandImageUrl: c.brandImage?.url ?? null,
    brandImageStoredUrl: c.brandImage?.storedUrl ?? null,
    watchCount: c.watches.length,
    soldOutCount: c.watches.filter((w) => w.soldOut).length,
    crawledAt: c.crawledAt,
    availabilityCheckedAt: c.watches.reduce<string | null>((m, w) => (!m || (w.availabilityCheckedAt ?? "") > m ? w.availabilityCheckedAt ?? m : m), null),
  }));
  fs.writeFileSync(path.join(outDir, "index.json"), JSON.stringify({ generatedAt: new Date().toISOString(), brands: rows }, null, 1) + "\n");
  return rows;
}
