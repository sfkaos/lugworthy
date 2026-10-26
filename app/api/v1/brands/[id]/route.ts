import { NextResponse, type NextRequest } from "next/server";
import { apiHeaders, authError, authorize, findBrand, resolveBrand } from "@/lib/brands/api";
import { getBrandSiteCatalog, getCatalog } from "@/lib/data";

// GET /api/v1/brands/BRD-0001 (or a slug, e.g. /api/v1/brands/lorier)
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const audience = authorize(req, req.nextUrl.searchParams.get("audience"));
  if (audience === "unauthorized" || audience === "not_configured") {
    const e = authError(audience);
    return NextResponse.json(e.body, { status: e.status });
  }
  const { id } = await params;
  const catalog = await getCatalog();
  const b = resolveBrand(catalog, decodeURIComponent(id), audience);
  const brand = b ? findBrand(catalog, b.brandId!, audience, await getBrandSiteCatalog(b.brandId!)) : null;
  if (!brand) return NextResponse.json({ error: "Brand not found" }, { status: 404, headers: apiHeaders() });
  return NextResponse.json({ data: brand, meta: { audience, source: catalog.source, syncedAt: catalog.syncedAt } }, { headers: apiHeaders() });
}
