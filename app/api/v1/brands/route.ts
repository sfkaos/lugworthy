import { NextResponse, type NextRequest } from "next/server";
import { apiHeaders, audienceFor, parseBrandQuery, queryBrands } from "@/lib/brands/api";
import { getCatalog } from "@/lib/data";

// GET /api/v1/brands?q=&country=US,GB&style=diver&price=budget,affordable&class=microbrand&hasModels=true&page=1&limit=50
// Add audience=all with the BRANDS_API_KEY to include every brand in the master list.
export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const audience = audienceFor(req, sp.get("audience"));
  if (audience === "forbidden") return NextResponse.json({ error: "audience=all needs a valid API key" }, { status: 401 });
  const catalog = await getCatalog();
  const result = queryBrands(catalog, parseBrandQuery(sp), audience);
  return NextResponse.json(
    { data: result.data, meta: { total: result.total, page: result.page, limit: result.limit, pages: result.pages, audience, source: catalog.source, syncedAt: catalog.syncedAt } },
    { headers: apiHeaders(audience) },
  );
}
