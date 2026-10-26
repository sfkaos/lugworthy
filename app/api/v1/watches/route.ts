import { NextResponse, type NextRequest } from "next/server";
import { apiHeaders, authError, authorize, queryWatches } from "@/lib/brands/api";
import { getDbCatalog } from "@/lib/data";

// GET /api/v1/watches?q=&brand=BRD-0191&soldOut=false&dia=36-40&mov=automatic&price=-500&sort=price_asc&page=1&limit=50
// Same filters as lugworthy.com/watches. Needs Authorization: Bearer <BRANDS_API_TOKEN>.
export async function GET(req: NextRequest) {
  const auth = authorize(req, null);
  if (auth === "unauthorized" || auth === "not_configured") {
    const e = authError(auth);
    return NextResponse.json(e.body, { status: e.status });
  }
  const catalog = await getDbCatalog();
  const r = queryWatches(catalog, req.nextUrl.searchParams);
  return NextResponse.json({ data: r.data, meta: { ...r.meta, source: catalog.source, syncedAt: catalog.syncedAt } }, { headers: apiHeaders() });
}
