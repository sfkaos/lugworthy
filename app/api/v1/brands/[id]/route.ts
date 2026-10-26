import { NextResponse, type NextRequest } from "next/server";
import { apiHeaders, audienceFor, findBrand } from "@/lib/brands/api";
import { getCatalog } from "@/lib/data";

// GET /api/v1/brands/BRD-0001 (or a slug, e.g. /api/v1/brands/lorier)
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const audience = audienceFor(req, req.nextUrl.searchParams.get("audience"));
  if (audience === "forbidden") return NextResponse.json({ error: "audience=all needs a valid API key" }, { status: 401 });
  const { id } = await params;
  const catalog = await getCatalog();
  const brand = findBrand(catalog, decodeURIComponent(id), audience);
  if (!brand) return NextResponse.json({ error: "Brand not found" }, { status: 404, headers: { ...apiHeaders(audience), ...(audience === "lugworthy" ? { "cache-control": "public, s-maxage=60" } : {}) } });
  return NextResponse.json({ data: brand, meta: { audience, source: catalog.source, syncedAt: catalog.syncedAt } }, { headers: apiHeaders(audience) });
}
