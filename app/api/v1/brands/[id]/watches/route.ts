import { NextResponse, type NextRequest } from "next/server";
import { apiHeaders, apiWatches, audienceFor, resolveBrand } from "@/lib/brands/api";
import { loadBrandCatalog } from "@/lib/brands/media";
import { getCatalog } from "@/lib/data";

// GET /api/v1/brands/BRD-0001/watches: every watch found on the brand's own website, with images.
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const audience = audienceFor(req, req.nextUrl.searchParams.get("audience"));
  if (audience === "forbidden") return NextResponse.json({ error: "audience=all needs a valid API key" }, { status: 401 });
  const { id } = await params;
  const b = resolveBrand(await getCatalog(), decodeURIComponent(id), audience);
  if (!b) return NextResponse.json({ error: "Brand not found" }, { status: 404, headers: apiHeaders(audience) });
  return NextResponse.json(apiWatches(b, await loadBrandCatalog(b.brandId!), audience), { headers: apiHeaders(audience) });
}
