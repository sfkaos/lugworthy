// Postgres connection (Neon on Vercel). DATABASE_URL is what the Neon integration sets;
// POSTGRES_URL is accepted too. Without either, the app runs on the checked-in snapshot.

import { drizzle } from "drizzle-orm/postgres-js";
import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";
import postgres from "postgres";
import * as schema from "@/db/schema";

export type Db = PgDatabase<PgQueryResultHKT, typeof schema>;

export function databaseUrl(env: Record<string, string | undefined> = process.env): string | null {
  return env.DATABASE_URL?.trim() || env.POSTGRES_URL?.trim() || null;
}

let cached: { url: string; db: Db } | null = null;

export function getDb(): Db | null {
  const url = databaseUrl();
  if (!url) return null;
  if (cached?.url !== url) {
    // Small pool: serverless functions each hold their own. prepare:false suits Neon's pooler.
    const client = postgres(url, { max: 3, prepare: false, idle_timeout: 20 });
    cached = { url, db: drizzle(client, { schema }) as unknown as Db };
  }
  return cached.db;
}
