import { NextResponse, type NextRequest } from "next/server";
import { getCatalog } from "@/lib/data";
import { limited } from "@/lib/rate-limit";

// First step of the claim flow (doc 08): a brand asks for an invite. We check the email's
// domain against the brand's website so the admin sees whether domain verification will pass.
export async function POST(req: NextRequest) {
  const catalog = await getCatalog();
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";
  if (limited(`claim:${ip}`, 3)) return NextResponse.json({ ok: false, error: "rate_limited" }, { status: 429 });
  const body = await req.json().catch(() => null);
  const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";
  const brand = typeof body?.brand === "string" ? catalog.getBrand(body.brand) : undefined;
  if (!brand || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return NextResponse.json({ ok: false, error: "invalid" }, { status: 400 });
  const site = brand.websiteUrl ? new URL(brand.websiteUrl).hostname.replace(/^www\./, "") : null;
  const domainMatch = !!site && (email.endsWith(`@${site}`) || email.endsWith(`.${site}`));
  console.log(JSON.stringify({ event: "claim_started", brand: brand.slug, domain_match: domainMatch, method: domainMatch ? "domain_email" : "manual" }));
  return NextResponse.json({ ok: true, domainMatch });
}
