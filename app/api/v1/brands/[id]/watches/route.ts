import { NextResponse, type NextRequest } from "next/server";
import { apiHeaders, apiWatches, authError, authorize, resolveBrand } from "@/lib/brands/api";
import { getBrandSiteCatalog, getDbCatalog } from "@/lib/data";

// GET /api/v1/brands/BRD-0001/watches[?soldOut=true|false]: every watch found on the brand's own
// website, with images, variants, full specs and sold-out history.
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const audience = authorize(req, req.nextUrl.searchParams.get("audience"));
  if (audience === "unauthorized" || audience === "not_configured") {
    const e = authError(audience);
    return NextResponse.json(e.body, { status: e.status });
  }
  const { id } = await params;
  const b = resolveBrand(await getDbCatalog(), decodeURIComponent(id), audience);
  if (!b) return NextResponse.json({ error: "Brand not found" }, { status: 404, headers: apiHeaders() });
  const so = req.nextUrl.searchParams.get("soldOut");
  const soldOut = so === "true" ? true : so === "false" ? false : undefined;
  return NextResponse.json(apiWatches(b, await getBrandSiteCatalog(b.brandId!), audience, soldOut), { headers: apiHeaders() });
}
