// Applies db/migrations to DATABASE_URL. Runs before `next build`; does nothing without a database.
// If the database can't be reached (down, or over its plan quota), the build goes on: pages then
// fall back to the snapshot (lib/data.ts), and the next build applies the migrations. Any other
// migration error still fails the build.
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";
import * as schema from "../db/schema";
import { ensureReadModel } from "../lib/catalog/index-build";
import type { Db } from "../lib/db/client";
import { withSsl } from "../lib/db/ssl";

/** Postgres classes 08 (connection) and 53 (insufficient resources, e.g. Neon's quota), or a network error. */
export function isUnreachable(e: unknown): boolean {
  for (let x = e as { code?: string; cause?: unknown } | undefined, i = 0; x && i < 5; x = x.cause as typeof x, i++) {
    const code = String(x.code ?? "");
    if (/^(08|53)/.test(code) || /^(ECONNREFUSED|ECONNRESET|ENOTFOUND|EAI_AGAIN|ETIMEDOUT|CONNECT_TIMEOUT|CONNECTION_CLOSED)$/.test(code)) return true;
  }
  return false;
}

/** Longer than the 30-minute lease, so a crashed holder's lease expires and this process takes over. */
const READ_MODEL_WAIT_MS = 35 * 60_000;

async function main() {
  const url = process.env.DATABASE_URL?.trim() || process.env.POSTGRES_URL?.trim();
  if (!url) {
    console.log("[migrate] no DATABASE_URL, skipping");
    return;
  }
  const client = postgres(withSsl(url), { max: 1, prepare: false, connect_timeout: 15, onnotice: () => {} });
  try {
    await migrate(drizzle(client), { migrationsFolder: "db/migrations" });
    console.log("[migrate] database is up to date");
    // The site reads catalog_brands/catalog_watches; build them on first deploy or after a format change.
    // The Render jobs pass --skip-read-model: the Vercel build does it, and the crawl import
    // refreshes each brand it saves anyway.
    if (process.argv.includes("--skip-read-model")) return;
    // When another process holds the rebuild lease, wait for it to finish (or for its lease to
    // expire, then take over) rather than build pages against a half-rebuilt read model.
    const t0 = Date.now();
    const db = drizzle(client, { schema }) as unknown as Db;
    let r = await ensureReadModel(db);
    while (r.busy) {
      if (Date.now() - t0 > READ_MODEL_WAIT_MS) throw new Error("[migrate] read model rebuild by another process did not finish in time");
      console.log("[migrate] another process is rebuilding the read model; waiting");
      await new Promise((ok) => setTimeout(ok, 15_000));
      r = await ensureReadModel(db);
    }
    console.log(r.rebuilt ? `[migrate] read model rebuilt: ${r.brands} brands in ${((Date.now() - t0) / 1000).toFixed(0)}s` : "[migrate] read model is current");
  } catch (e) {
    if (!isUnreachable(e)) throw e;
    const err = e as Error & { cause?: Error };
    console.warn(`[migrate] database unreachable, skipping migrations so the build can go on (pages will use the snapshot): ${err.cause?.message ?? err.message}`);
  } finally {
    await client.end({ timeout: 5 }).catch(() => {});
  }
}

if (process.argv[1]?.endsWith("migrate.ts")) {
  main().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
