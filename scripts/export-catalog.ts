// Writes every crawled brand from the database back out as crawler files, so a job on a
// fresh machine (Render) starts from the last crawl: sold-out history and stored images carry over.
//   CATALOG_DIR=/tmp/catalog npm run catalog:export
import fs from "node:fs";
import path from "node:path";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "../db/schema";
import type { Db } from "../lib/db/client";
import { readSiteCatalogs } from "../lib/db/read";
import { writeCatalogIndex } from "../lib/crawl/index-file";
import { withSsl } from "../lib/db/ssl";

const url = process.env.DATABASE_URL?.trim() || process.env.POSTGRES_URL?.trim();
if (!url) throw new Error("DATABASE_URL is not set");
const outDir = path.resolve(process.env.CATALOG_DIR ?? "data/catalog");
fs.mkdirSync(outDir, { recursive: true });
const client = postgres(withSsl(url), { max: 1, prepare: false });
const db = drizzle(client, { schema }) as unknown as Db;

(async () => {
  // One brand at a time keeps each query's parameter list small.
  const codes = await db.select({ code: schema.brands.brandCode }).from(schema.brandCrawls).innerJoin(schema.brands, eq(schema.brands.id, schema.brandCrawls.brandId));
  let watches = 0;
  for (const { code } of codes) {
    const [c] = await readSiteCatalogs(db, code!);
    if (!c) continue;
    watches += c.watches.length;
    fs.writeFileSync(path.join(outDir, `${c.brandId}.json`), JSON.stringify(c) + "\n");
  }
  writeCatalogIndex(outDir);
  console.log(`exported ${codes.length} brands, ${watches} watches to ${outDir}`);
})().finally(() => client.end());
