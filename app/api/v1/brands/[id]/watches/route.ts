import { NextResponse, type NextRequest } from "next/server";
import { apiHeaders, apiWatches, authError, authorize, resolveBrand } from "@/lib/brands/api";
import { getBrandSiteCatalog, getCatalog } from "@/lib/data";

// GET /api/v1/brands/BRD-0001/watches: every watch found on the brand's own website, with images.
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const audience = authorize(req, req.nextUrl.searchParams.get("audience"));
  if (audience === "unauthorized" || audience === "not_configured") {
    const e = authError(audience);
    return NextResponse.json(e.body, { status: e.status });
  }
  const { id } = await params;
  const b = resolveBrand(await getCatalog(), decodeURIComponent(id), audience);
  if (!b) return NextResponse.json({ error: "Brand not found" }, { status: 404, headers: apiHeaders() });
  return NextResponse.json(apiWatches(b, await getBrandSiteCatalog(b.brandId!), audience), { headers: apiHeaders() });
}
