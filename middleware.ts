import { NextResponse, type NextRequest } from "next/server";

// api.lugworthy.com serves the brands API at its root: api.lugworthy.com/brands/BRD-0348 is
// /api/v1/brands/BRD-0348 on the main site. Set API_HOST to change the host name.
const API_HOST = process.env.API_HOST ?? "api.lugworthy.com";

const CORS = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "GET, OPTIONS",
  "access-control-allow-headers": "authorization, content-type",
  "access-control-max-age": "86400",
};

export function middleware(req: NextRequest) {
  const host = (req.headers.get("host") ?? "").split(":")[0].toLowerCase();
  const isApiHost = host === API_HOST || host.startsWith("api.");
  const path = req.nextUrl.pathname;
  const isApiPath = path === "/api/v1" || path.startsWith("/api/v1/");

  // Token-based (no cookies), so any origin may call it from a browser.
  if (req.method === "OPTIONS" && (isApiHost || isApiPath)) return new NextResponse(null, { status: 204, headers: CORS });

  if (isApiHost) {
    if (path.startsWith("/api/cron/")) return NextResponse.next();
    const target = isApiPath ? path : `/api/v1${path === "/" ? "" : path}`;
    if (!/^\/api\/v1(\/|$)/.test(target)) return NextResponse.json({ error: "Not found" }, { status: 404, headers: CORS });
    const url = req.nextUrl.clone();
    url.pathname = target;
    const res = NextResponse.rewrite(url);
    for (const [k, v] of Object.entries(CORS)) res.headers.set(k, v);
    return res;
  }
  if (isApiPath) {
    const res = NextResponse.next();
    for (const [k, v] of Object.entries(CORS)) res.headers.set(k, v);
    return res;
  }
  return NextResponse.next();
}

export const config = {
  // Everything except Next's static files.
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
