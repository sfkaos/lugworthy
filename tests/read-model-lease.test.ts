// Only one process rebuilds the read model at a time (two at once ran the small database out of memory).
import { beforeAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import * as s from "@/db/schema";
import { ensureReadModel, READ_MODEL_VERSION } from "@/lib/catalog/index-build";
import type { Db } from "@/lib/db/client";
import { siteDb } from "@/lib/site-data";

let db: Db;
const setMeta = (key: string, value: string) =>
  db.insert(s.catalogMeta).values({ key, value }).onConflictDoUpdate({ target: s.catalogMeta.key, set: { value } });
const meta = async (key: string) => (await db.select().from(s.catalogMeta).where(eq(s.catalogMeta.key, key)))[0]?.value;

beforeAll(async () => {
  delete process.env.DATABASE_URL;
  delete process.env.POSTGRES_URL;
  db = await siteDb();
}, 120_000);

describe("ensureReadModel", () => {
  it("skips while another process holds a fresh lease", async () => {
    await setMeta("version", "old");
    await setMeta("rebuild_lease", `${Date.now()}:other`);
    expect(await ensureReadModel(db)).toEqual({ rebuilt: false, busy: true });
    expect(await meta("version")).toBe("old");
    expect(await meta("rebuild_lease")).toMatch(/:other$/);
  });

  it("takes over an expired lease, rebuilds, and releases it", async () => {
    await setMeta("rebuild_lease", `${Date.now() - 31 * 60_000}:crashed`);
    const r = await ensureReadModel(db);
    expect(r.rebuilt).toBe(true);
    expect(await meta("version")).toBe(READ_MODEL_VERSION);
    expect(await meta("rebuild_lease")).toBeUndefined();
    expect(await ensureReadModel(db)).toEqual({ rebuilt: false });
  }, 120_000);
});
