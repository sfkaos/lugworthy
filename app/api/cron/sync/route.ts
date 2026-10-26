import { timingSafeEqual } from "node:crypto";
import { revalidatePath, revalidateTag } from "next/cache";
import { NextResponse, type NextRequest } from "next/server";
import { BRANDS_TAG, fetchSheetRows } from "@/lib/brands/source";
import { clearCatalogMemo } from "@/lib/data";
import { getDb } from "@/lib/db/client";
import { refreshBrands } from "@/lib/catalog/index-build";
import { importCatalogDir } from "@/lib/sync/catalog";
import { recordSync, syncBrandsFromRows } from "@/lib/sync/sheet";

// Sheet -> database sync, then the crawler files -> database.
// Vercel Cron calls this daily (vercel.json) with Authorization: Bearer <CRON_SECRET>.
// Run it by hand with the same header, or ?secret=<CRON_SECRET>.
export const maxDuration = 60;
export const dynamic = "force-dynamic";

function authorized(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const auth = req.headers.get("authorization");
  const given = (auth?.startsWith("Bearer ") ? auth.slice(7) : null) ?? req.nextUrl.searchParams.get("secret");
  if (!secret || !given) return false;
  const a = Buffer.from(given), b = Buffer.from(secret);
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function GET(req: NextRequest) {
  if (!authorized(req)) return NextResponse.json({ error: "Not allowed" }, { status: 401 });
  const db = getDb();
  if (!db) return NextResponse.json({ error: "DATABASE_URL is not set" }, { status: 503 });
  try {
    const sheet = await recordSync(db, "sheet", async () => syncBrandsFromRows(db, await fetchSheetRows()));
    // Brands whose sheet row changed get their read-model rows rebuilt.
    const readModel = await refreshBrands(db, undefined, { ifChanged: true });
    const catalog = req.nextUrl.searchParams.get("catalog") === "skip" ? null : await recordSync(db, "catalog", () => importCatalogDir(db));
    clearCatalogMemo();
    revalidateTag(BRANDS_TAG);
    revalidatePath("/", "layout");
    return NextResponse.json({ ok: true, sheet, readModel, catalog }, { headers: { "cache-control": "no-store" } });
  } catch (e) {
    console.error("[sync] failed:", e);
    return NextResponse.json({ ok: false, error: (e as Error).message }, { status: 500 });
  }
}
