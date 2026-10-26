import { NextResponse } from "next/server";

// A small index so the API is discoverable.
export function GET() {
  return NextResponse.json({
    name: "Lugworthy brands API",
    version: 1,
    source: "Postgres, synced from the Brand master list (source of truth), public columns only",
    endpoints: {
      "GET /api/v1/brands": "List brands. Query: q, country (ISO-2, comma-separated), style, price (budget|affordable|mid|upper_mid|high), class, hasModels=true, hasImages=true, page, limit (max 200).",
      "GET /api/v1/brands/{id}": "One brand by BRD-#### ID or slug, with its brand image (logo/hero from the brand's site).",
      "GET /api/v1/brands/{id}/watches": "Watches found on the brand's own website, with image URLs, price and key specs.",
      "audience=all": "Every brand in the master list, with ownership and fit.",
      auth: "Every request except this index needs Authorization: Bearer <token>.",
    },
  });
}
