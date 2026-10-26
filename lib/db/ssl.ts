// Hosted Postgres (Render's external URL) refuses plain connections, and postgres-js
// only turns on TLS when the URL says so. Ask for TLS unless the URL already sets
// sslmode or points at this machine (local dev, tests).
export function withSsl(url: string): string {
  if (/[?&]sslmode=/.test(url)) return url;
  let host = "";
  try {
    host = new URL(url).hostname;
  } catch {
    return url;
  }
  if (["localhost", "127.0.0.1", "::1", "[::1]"].includes(host)) return url;
  return url + (url.includes("?") ? "&" : "?") + "sslmode=require";
}
