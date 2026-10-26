import { NextResponse, type NextRequest } from "next/server";
import { apiHeaders, authError, authorize, parseBrandQuery, queryBrands } from "@/lib/brands/api";
import { getCatalog } from "@/lib/data";

// GET /api/v1/brands?q=&country=US,GB&style=diver&price=budget,affordable&class=microbrand&hasModels=true&page=1&limit=50
// Needs Authorization: Bearer <BRANDS_API_TOKEN>. Add audience=all for every brand in the master list.
export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const audience = authorize(req, sp.get("audience"));
  if (audience === "unauthorized" || audience === "not_configured") {
    const e = authError(audience);
    return NextResponse.json(e.body, { status: e.status });
  }
  const catalog = await getCatalog();
  const result = queryBrands(catalog, parseBrandQuery(sp), audience);
  return NextResponse.json(
    { data: result.data, meta: { total: result.total, page: result.page, limit: result.limit, pages: result.pages, audience, source: catalog.source, syncedAt: catalog.syncedAt } },
    { headers: apiHeaders() },
  );
}
