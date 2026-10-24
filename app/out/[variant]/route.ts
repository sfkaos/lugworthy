import { NextResponse, type NextRequest } from "next/server";
import { findVariant } from "@/lib/data";

// Outbound redirect (doc 13): log the click, then 302 to the brand with affiliate params
// when configured, otherwise UTM. The log line is the outbound_clicks row until Postgres is wired.
export async function GET(req: NextRequest, { params }: { params: Promise<{ variant: string }> }) {
  const id = decodeURIComponent((await params).variant);
  const hit = findVariant(id);
  if (!hit || !hit.variant.url) return NextResponse.redirect(new URL("/watches", req.url), 302);
  const { brand, model, variant } = hit;
  const dest = variant.url!;

  let target: URL;
  const affiliate = brand.affiliate && brand.affiliate.network !== "none" ? brand.affiliate : null;
  if (affiliate) target = new URL(affiliate.urlTemplate.replace("{url}", encodeURIComponent(dest)));
  else target = new URL(dest);
  target.searchParams.set("utm_source", "lugworthy");
  target.searchParams.set("utm_medium", "directory");
  target.searchParams.set("utm_campaign", brand.slug);

  console.log(JSON.stringify({
    event: "outbound_click", ts: new Date().toISOString(), brand_id: brand.slug, model_id: model.slug, variant_id: variant.id,
    page: req.nextUrl.searchParams.get("from") ?? "unknown", affiliate: !!affiliate,
    session_id: req.cookies.get("lw_sid")?.value ?? null,
  }));
  const res = NextResponse.redirect(target, 302);
  res.headers.set("X-Robots-Tag", "noindex, nofollow");
  return res;
}
