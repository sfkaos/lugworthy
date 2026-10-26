import { createVerify, generateKeyPairSync } from "node:crypto";
import { afterEach, describe, expect, it, vi } from "vitest";
import { audienceFor, findBrand, parseBrandQuery, queryBrands } from "@/lib/brands/api";
import { statusFor } from "@/lib/brands/build";
import { PUBLIC_COLUMNS, PUBLIC_RANGE } from "@/lib/brands/columns";
import { fetchPublicRows, resetTokenCacheForTests, serviceAccountFromEnv, signedAssertion } from "@/lib/brands/sheet";
import { loadMasterRows, snapshotRows } from "@/lib/brands/source";
import { Catalog } from "@/lib/data";

const catalog = new Catalog(snapshotRows());
const q = (s: string) => parseBrandQuery(new URLSearchParams(s));

describe("publishing rule", () => {
  it("publishes only Independent brands with Lugworthy fit Yes and a working site", () => {
    expect(statusFor("Independent", "Yes", true)).toBe("published");
    expect(statusFor("Independent", "Yes", false)).toBe("draft");
    expect(statusFor("Needs review", "Yes", true)).toBe("draft");
    expect(statusFor("Independent", "Review", true)).toBe("draft");
    expect(statusFor("Group-owned", "Yes", true)).toBe("hidden");
    expect(statusFor("Independent", "No", true)).toBe("hidden");
  });
  it("matches the snapshot counts", () => {
    const pub = catalog.publishedBrands();
    expect(pub.length).toBe(1274);
    for (const b of pub) {
      expect(b.ownership).toBe("Independent");
      expect(b.lugworthyFit).toBe("Yes");
    }
  });
});

describe("GET /api/v1/brands", () => {
  it("returns only published brands to the public", () => {
    const r = queryBrands(catalog, q("limit=200&page=1"), "lugworthy");
    expect(r.total).toBe(1274);
    expect(r.data).toHaveLength(200);
    expect(r.pages).toBe(7);
    expect(r.data[0]).not.toHaveProperty("ownership");
  });
  it("searches by name and filters by country", () => {
    const r = queryBrands(catalog, q("q=lorier"), "lugworthy");
    expect(r.data[0].slug).toBe("lorier");
    const us = queryBrands(catalog, q("country=US&limit=200"), "lugworthy");
    expect(us.total).toBeGreaterThan(50);
    expect(us.data.every((b) => b.country === "US")).toBe(true);
  });
  it("ignores accents and finds brands by city", () => {
    const r = queryBrands(catalog, q("q=zurich"), "lugworthy");
    expect(r.total).toBeGreaterThan(0);
  });
  it("lists every brand, with ownership, for audience=all", () => {
    const r = queryBrands(catalog, q("limit=1"), "all");
    expect(r.total).toBe(1437);
    expect(r.data[0]).toHaveProperty("ownership");
    const group = queryBrands(catalog, q("ownership=group"), "all");
    expect(group.total).toBeGreaterThan(0);
  });
});

describe("GET /api/v1/brands/{id}", () => {
  it("finds a brand by BRD ID or slug", () => {
    expect(findBrand(catalog, "BRD-0348", "lugworthy")?.slug).toBe("lorier");
    expect(findBrand(catalog, "brd-0348", "lugworthy")?.name).toBe("LORIER");
    expect(findBrand(catalog, "lorier", "lugworthy")?.id).toBe("BRD-0348");
    expect(findBrand(catalog, "lorier", "lugworthy")?.modelCount).toBeGreaterThan(0);
  });
  it("hides unpublished brands from the public but not from audience=all", () => {
    const hidden = catalog.brands.find((b) => b.status === "hidden")!;
    expect(findBrand(catalog, hidden.brandId!, "lugworthy")).toBeNull();
    expect(findBrand(catalog, hidden.brandId!, "all")?.id).toBe(hidden.brandId);
  });
});

describe("privacy", () => {
  it("only ever requests columns A-L", () => {
    expect(PUBLIC_RANGE).toBe("Brands!A1:L");
  });
  it("never returns emails or outreach fields", () => {
    const all = JSON.stringify(queryBrands(catalog, q("limit=200"), "all").data) + JSON.stringify(queryBrands(catalog, q("limit=200&page=7"), "all").data);
    expect(all).not.toMatch(/[\w.+-]+@[\w-]+\.[\w.]+/);
    expect(all).not.toMatch(/outreach|reply|founder/i);
  });
});

describe("API keys", () => {
  const req = (h: Record<string, string> = {}) => new Request("https://x.test/api/v1/brands", { headers: h });
  it("defaults to the public audience", () => {
    expect(audienceFor(req(), null, {})).toBe("lugworthy");
  });
  it("needs the right key for audience=all", () => {
    expect(audienceFor(req(), "all", {})).toBe("forbidden");
    expect(audienceFor(req({ authorization: "Bearer nope" }), "all", { BRANDS_API_KEY: "secret" })).toBe("forbidden");
    expect(audienceFor(req({ authorization: "Bearer secret" }), "all", { BRANDS_API_KEY: "secret" })).toBe("all");
    expect(audienceFor(req({ "x-api-key": "secret" }), "all", { BRANDS_API_KEY: "secret" })).toBe("all");
  });
});

describe("catalog", () => {
  it("keeps a brand's models when the brand is renamed in the sheet", () => {
    const rows = snapshotRows().rows.map((r) => (r[0] === "BRD-0348" ? [r[0], "Lorier Watches NYC", ...r.slice(2)] : r));
    const c = new Catalog({ rows, source: "sheet", syncedAt: new Date().toISOString() });
    const b = c.brandById("BRD-0348")!;
    expect(b.slug).toBe("lorier-watches-nyc");
    expect(c.modelsForBrand(b.slug).length).toBeGreaterThan(0);
    expect(c.modelsForBrand(b.slug)[0].brand?.name).toBe("Lorier Watches NYC");
  });
  it("falls back to the snapshot without Google credentials", async () => {
    const r = await loadMasterRows();
    expect(r.source).toBe("snapshot");
    expect(r.rows.length).toBe(1437);
  });
});

describe("Google Sheets client", () => {
  const { privateKey, publicKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
  const pem = privateKey.export({ type: "pkcs8", format: "pem" }).toString();
  const sa = { email: "lugworthy@test.iam.gserviceaccount.com", privateKey: pem };
  afterEach(() => resetTokenCacheForTests());

  it("reads credentials from env", () => {
    expect(serviceAccountFromEnv({})).toBeNull();
    expect(serviceAccountFromEnv({ GOOGLE_SERVICE_ACCOUNT_EMAIL: sa.email, GOOGLE_PRIVATE_KEY: pem.replace(/\n/g, "\\n") })).toEqual(sa);
    const json = JSON.stringify({ client_email: sa.email, private_key: pem });
    expect(serviceAccountFromEnv({ GOOGLE_SERVICE_ACCOUNT_JSON: json })).toEqual(sa);
    expect(serviceAccountFromEnv({ GOOGLE_SERVICE_ACCOUNT_JSON: Buffer.from(json).toString("base64") })).toEqual(sa);
  });

  it("signs a read-only JWT", () => {
    const jwt = signedAssertion(sa, 1_000);
    const [h, c, sig] = jwt.split(".");
    const v = createVerify("RSA-SHA256");
    v.update(`${h}.${c}`);
    expect(v.verify(publicKey, Buffer.from(sig, "base64url"))).toBe(true);
    const claims = JSON.parse(Buffer.from(c, "base64url").toString());
    expect(claims.scope).toBe("https://www.googleapis.com/auth/spreadsheets.readonly");
    expect(claims.exp - claims.iat).toBe(3600);
  });

  it("fetches only the public range and trims extra columns", async () => {
    const calls: string[] = [];
    const fake = vi.fn(async (url: string | URL | Request) => {
      calls.push(String(url));
      if (String(url).includes("oauth2")) return new Response(JSON.stringify({ access_token: "tok", expires_in: 3600 }));
      return new Response(JSON.stringify({ values: [[...PUBLIC_COLUMNS, "Contact email"], ["BRD-0001", "A", "a.com", "", "France", "", "", "", "OK", "Independent", "", "Yes", "private@x.com"]] }));
    });
    const rows = await fetchPublicRows(sa, "sheet123", fake as unknown as typeof fetch);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toHaveLength(12);
    expect(calls[1]).toContain(encodeURIComponent("Brands!A1:L"));
    expect(calls[1]).toContain("/spreadsheets/sheet123/");
  });

  it("refuses a sheet whose columns moved", async () => {
    const moved = [...PUBLIC_COLUMNS];
    [moved[4], moved[5]] = [moved[5], moved[4]];
    const fake = async (url: string | URL | Request) =>
      String(url).includes("oauth2") ? new Response(JSON.stringify({ access_token: "tok", expires_in: 3600 })) : new Response(JSON.stringify({ values: [moved] }));
    await expect(fetchPublicRows(sa, "s", fake as unknown as typeof fetch)).rejects.toThrow(/columns changed/);
  });
});
