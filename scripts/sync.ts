// Runs the sync from the command line (same code as /api/cron/sync).
//   npm run db:sync               sheet (needs Google credentials) + data/catalog files
//   npm run db:sync -- --snapshot use data/raw/master.json instead of the live sheet
//   npm run db:sync -- --catalog-only
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "../db/schema";
import { fetchSheetRows, snapshotRows } from "../lib/brands/source";
import type { Db } from "../lib/db/client";
import { importCatalogDir } from "../lib/sync/catalog";
import { recordSync, syncBrandsFromRows } from "../lib/sync/sheet";

const url = process.env.DATABASE_URL?.trim() || process.env.POSTGRES_URL?.trim();
if (!url) throw new Error("DATABASE_URL is not set");
const args = new Set(process.argv.slice(2));
const client = postgres(url, { max: 1, prepare: false });
const db = drizzle(client, { schema }) as unknown as Db;

(async () => {
  if (!args.has("--catalog-only")) {
    const rows = args.has("--snapshot") ? snapshotRows() : await fetchSheetRows();
    console.log("sheet:", await recordSync(db, "sheet", () => syncBrandsFromRows(db, rows)));
  }
  console.log("catalog:", await recordSync(db, "catalog", () => importCatalogDir(db, process.env.CATALOG_DIR || undefined)));
})().finally(() => client.end());
