import { NextResponse, type NextRequest } from "next/server";
import { apiCollections, apiHeaders, authError, authorize, resolveBrand } from "@/lib/brands/api";
import { getBrandSiteCatalog, getDbCatalog } from "@/lib/data";

// GET /api/v1/brands/BRD-0001/collections: the collections (series, model families) on the brand's
// own website. Watches list their collections in collectionIds; a watch may belong to none.
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const audience = authorize(req, req.nextUrl.searchParams.get("audience"));
  if (audience === "unauthorized" || audience === "not_configured") {
    const e = authError(audience);
    return NextResponse.json(e.body, { status: e.status });
  }
  const { id } = await params;
  const b = resolveBrand(await getDbCatalog(), decodeURIComponent(id), audience);
  if (!b) return NextResponse.json({ error: "Brand not found" }, { status: 404, headers: apiHeaders() });
  return NextResponse.json(apiCollections(b, await getBrandSiteCatalog(b.brandId!), audience), { headers: apiHeaders() });
}
