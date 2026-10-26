import { NextResponse } from "next/server";

// A small index so the API is discoverable.
export function GET() {
  return NextResponse.json({
    name: "Lugworthy brands API",
    version: 1,
    source: "Brand master list (source of truth), Brands tab, public columns only",
    endpoints: {
      "GET /api/v1/brands": "List brands. Query: q, country (ISO-2, comma-separated), style, price (budget|affordable|mid|upper_mid|high), class, hasModels=true, page, limit (max 200).",
      "GET /api/v1/brands/{id}": "One brand by BRD-#### ID or slug.",
      "audience=all": "Every brand in the master list, with ownership and fit. Needs Authorization: Bearer <BRANDS_API_KEY>.",
    },
  });
}
