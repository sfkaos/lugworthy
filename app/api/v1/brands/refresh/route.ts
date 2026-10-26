import { timingSafeEqual } from "node:crypto";
import { revalidatePath, revalidateTag } from "next/cache";
import { NextResponse, type NextRequest } from "next/server";
import { BRANDS_TAG } from "@/lib/brands/source";

// Drops the cached sheet read so the next request picks up edits right away.
// GET or POST /api/v1/brands/refresh?secret=<BRANDS_REFRESH_SECRET>
// (or header x-refresh-secret). Without this, edits still show up within ~10 minutes.
function authorized(req: NextRequest) {
  const secret = process.env.BRANDS_REFRESH_SECRET;
  const given = req.headers.get("x-refresh-secret") ?? req.nextUrl.searchParams.get("secret");
  if (!secret || !given) return false;
  const a = Buffer.from(given), b = Buffer.from(secret);
  return a.length === b.length && timingSafeEqual(a, b);
}

async function refresh(req: NextRequest) {
  if (!authorized(req)) return NextResponse.json({ error: "Not allowed" }, { status: 401 });
  revalidateTag(BRANDS_TAG);
  revalidatePath("/", "layout");
  return NextResponse.json({ ok: true, refreshedAt: new Date().toISOString() }, { headers: { "cache-control": "no-store" } });
}

export const GET = refresh;
export const POST = refresh;
