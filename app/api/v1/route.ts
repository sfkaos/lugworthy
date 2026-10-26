import { NextResponse } from "next/server";

// A small index so the API is discoverable.
export function GET() {
  return NextResponse.json({
    name: "Lugworthy brands API",
    version: 1,
    source: "Postgres, synced from the Brand master list (source of truth), public columns only",
    baseUrls: ["https://api.lugworthy.com", "https://lugworthy.com/api/v1"],
    endpoints: {
      "GET /brands": "List brands. Query: q, country (ISO-2, comma-separated), style, price (budget|affordable|mid|upper_mid|high), class, hasModels=true, hasImages=true, page, limit (max 200).",
      "GET /brands/{id}": "One brand by BRD-#### ID or slug, with its brand image (logo/hero from the brand's site).",
      "GET /watches": "Every published watch, with the same filters as lugworthy.com/watches (q, brand, soldOut, dia, l2l, wr, price, mov, style, cal, mat, sort, page, limit).",
      "GET /brands/{id}/watches": "Watches found on the brand's own website: photos, price, variants, options, description, every listed spec, sold-out status and history. ?soldOut=true|false filters.",
      "audience=all": "Every brand in the master list, with ownership and fit.",
      auth: "Every request except this index needs Authorization: Bearer <token>.",
    },
  });
}
