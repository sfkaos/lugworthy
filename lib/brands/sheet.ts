// Reads the public columns of the master list straight from the Google Sheets API.
//
// Auth is a Google Cloud service account (free). The sheet is shared with the service
// account's email as Viewer. Credentials come from env vars, so nothing secret is in the repo:
//   GOOGLE_SERVICE_ACCOUNT_JSON  the whole key file (raw JSON or base64), or
//   GOOGLE_SERVICE_ACCOUNT_EMAIL + GOOGLE_PRIVATE_KEY
//   BRANDS_SHEET_ID              optional, defaults to the master list
//
// No Google SDK: a signed JWT is exchanged for an access token with node:crypto and fetch.

import { createSign } from "node:crypto";
import { DEFAULT_SHEET_ID, PUBLIC_COLUMNS, PUBLIC_RANGE, type MasterRow } from "./columns";

const SCOPE = "https://www.googleapis.com/auth/spreadsheets.readonly";
const TOKEN_URL = "https://oauth2.googleapis.com/token";

export interface ServiceAccount {
  email: string;
  privateKey: string;
}

type Env = Record<string, string | undefined>;

/** Returns null when no credentials are configured (local dev, tests, previews without secrets). */
export function serviceAccountFromEnv(env: Env = process.env): ServiceAccount | null {
  const json = env.GOOGLE_SERVICE_ACCOUNT_JSON?.trim();
  if (json) {
    const text = json.startsWith("{") ? json : Buffer.from(json, "base64").toString("utf8");
    const parsed = JSON.parse(text) as { client_email?: string; private_key?: string };
    if (parsed.client_email && parsed.private_key) return { email: parsed.client_email, privateKey: parsed.private_key };
    throw new Error("GOOGLE_SERVICE_ACCOUNT_JSON is missing client_email or private_key");
  }
  const email = env.GOOGLE_SERVICE_ACCOUNT_EMAIL?.trim();
  const key = env.GOOGLE_PRIVATE_KEY;
  if (email && key) return { email, privateKey: key.replace(/\\n/g, "\n") };
  return null;
}

export function sheetIdFromEnv(env: Env = process.env): string {
  return env.BRANDS_SHEET_ID?.trim() || DEFAULT_SHEET_ID;
}

const b64url = (v: string | Buffer) => Buffer.from(v).toString("base64url");

export function signedAssertion(sa: ServiceAccount, nowS = Math.floor(Date.now() / 1000)): string {
  const header = b64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claims = b64url(JSON.stringify({ iss: sa.email, scope: SCOPE, aud: TOKEN_URL, iat: nowS, exp: nowS + 3600 }));
  const signer = createSign("RSA-SHA256");
  signer.update(`${header}.${claims}`);
  return `${header}.${claims}.${b64url(signer.sign(sa.privateKey))}`;
}

let token: { value: string; expiresAt: number; email: string } | null = null;

async function accessToken(sa: ServiceAccount, fetchImpl: typeof fetch): Promise<string> {
  if (token && token.email === sa.email && token.expiresAt > Date.now() + 60_000) return token.value;
  const res = await fetchImpl(TOKEN_URL, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion: signedAssertion(sa) }),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Google token request failed: ${res.status} ${await res.text()}`);
  const body = (await res.json()) as { access_token: string; expires_in: number };
  token = { value: body.access_token, expiresAt: Date.now() + body.expires_in * 1000, email: sa.email };
  return token.value;
}

/**
 * Fetches columns A-L and returns the data rows (header dropped). Never requests any other column.
 * Throws if the header doesn't match, so a moved or renamed column can't scramble the site.
 */
export async function fetchPublicRows(sa: ServiceAccount, sheetId: string, fetchImpl: typeof fetch = fetch): Promise<MasterRow[]> {
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(sheetId)}/values/${encodeURIComponent(PUBLIC_RANGE)}?majorDimension=ROWS&valueRenderOption=FORMATTED_VALUE`;
  const res = await fetchImpl(url, { headers: { authorization: `Bearer ${await accessToken(sa, fetchImpl)}` }, cache: "no-store" });
  if (!res.ok) throw new Error(`Sheets read failed: ${res.status} ${await res.text()}`);
  const body = (await res.json()) as { range?: string; values?: string[][] };
  // Belt and braces: if Google ever returned a wider range, drop anything past column L.
  const [header = [], ...rows] = (body.values ?? []).map((r) => r.slice(0, 12).map((c) => String(c ?? "")));
  const expected = PUBLIC_COLUMNS.join(" | ");
  const got = header.map((c) => c.trim()).join(" | ");
  if (got !== expected) throw new Error(`Brands tab columns changed. Expected "${expected}", got "${got}"`);
  return rows;
}

export function resetTokenCacheForTests() {
  token = null;
}
