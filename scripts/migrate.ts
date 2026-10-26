// Applies db/migrations to DATABASE_URL. Runs before `next build`; does nothing without a database.
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";
import { withSsl } from "../lib/db/ssl";

const url = process.env.DATABASE_URL?.trim() || process.env.POSTGRES_URL?.trim();
if (!url) {
  console.log("[migrate] no DATABASE_URL, skipping");
  process.exit(0);
}
const client = postgres(withSsl(url), { max: 1, prepare: false });
migrate(drizzle(client), { migrationsFolder: "db/migrations" })
  .then(() => console.log("[migrate] database is up to date"))
  .finally(() => client.end());
