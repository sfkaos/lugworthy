// Turns master-list rows (columns A-L) into Brand records. Used by the live loader
// (lib/brands/source.ts) and by scripts/build-seed.ts, so both apply the same rules.

import directoriesJson from "@/data/raw/directories.json";
import { toIso2 } from "@/lib/countries";
import { slugify } from "@/lib/ingest/normalize";
import type { Brand, PriceBand } from "@/lib/types";
import type { MasterRow } from "./columns";

// Older heritage names that sell like micros. Directory class "legacy_micro".
const LEGACY = new Set(
  ["Yema", "DOXA", "Squale", "Hanhart", "Laco", "Mühle-Glashütte", "MeisterSinger", "Benrus", "Hampden", "Vulcain", "Nivada Grenchen", "Marathon", "Ollech & Wajs Zurich", "Louis Erard", "Christopher Ward", "Steinhart Watches", "Pequignet", "Cimier", "Ardath", "Cadola", "Junkers", "Spinnaker", "AVI-8", "Briston", "Agelocer", "Duxot", "Swan & Edgar", "Van Speyk", "Angelier", "Normalzeit", "Horage", "Itay Noy", "Peacock", "Lucky Harvey", "CIGA Design", "Albishorn", "Mandetbrote", "Reservoir", "Azimuth", "Mezei Watch Company", "Speake-Marin", "Kudoke", "Ikepod", "Phoibos", "Crepas", "Panzera", "Kronosti", "Delhi Watch Company", "Farasute", "Naoya Hida & Co.", "Ōtsuka Lōtec", "toledano&chan", "MING", "Kompas Watches", "Grandeur", "Col&MacArthur", "Temporal Works", "Parivas", "PRIM", "Ercigoj", "ROBOT", "Donut Watch Co.", "ALANTI Watches", "M. Ryan Watch Designs"].map((s) => s.toLowerCase()),
);

export function cleanDomain(raw: string | undefined | null): string | null {
  if (!raw) return null;
  const first = raw.trim().split(/\s/)[0];
  if (!first || !/\./.test(first)) return null;
  return first.replace(/^https?:\/\//, "").replace(/^www\./, "").replace(/\/.*$/, "").toLowerCase();
}

export const keyName = (s: string) => slugify(s).replace(/-?(watch(es)?|watch-co|co|company|timepieces)$/g, "");

/** "Lume lovers, field watch microbrand from Chihuahua, Mexico; budget-friendly ($150–$400)." */
function parseDescription(desc: string) {
  const out: { tags: string[]; min: number | null; max: number | null; band: PriceBand | null } = { tags: [], min: null, max: null, band: null };
  const m = desc.match(/^(.*?)\s+microbrand from\s+([^;.]+?)(?:;\s*([a-z -]+?))?(?:\s*\(\$([\d,]+)\s*[–-]\s*\$([\d,]+)\))?\.?$/i);
  if (!m) return out;
  out.tags = m[1].split(",").map((t) => t.trim().toLowerCase()).filter((t) => t && t !== "independent");
  if (m[4] && m[5]) {
    out.min = Number(m[4].replace(/,/g, "")) * 100;
    out.max = Number(m[5].replace(/,/g, "")) * 100;
  }
  const label = (m[3] ?? "").toLowerCase();
  out.band = label.startsWith("budget") ? "budget" : label.startsWith("affordable") ? "affordable" : label.startsWith("upper") ? "upper_mid" : label.startsWith("mid") ? "mid" : null;
  return out;
}

export function bandFor(minUsdMinor: number | null): PriceBand | null {
  if (minUsdMinor == null) return null;
  const d = minUsdMinor / 100;
  if (d < 300) return "budget";
  if (d < 700) return "affordable";
  if (d < 1500) return "mid";
  if (d < 3000) return "upper_mid";
  return "high";
}

function safeLabel(raw: string | null): string | null {
  if (!raw || raw.length > 30 || /\d|;|:|unknown|uncertain|possibly/i.test(raw)) return null;
  return raw.trim();
}

/**
 * Lugworthy publishes a brand only when the sheet marks it Independent, Lugworthy fit is "Yes",
 * and it has a working website. "No" fit or group-owned rows are hidden; the rest wait as drafts.
 */
export function statusFor(ownership: string, fit: string, siteOk: boolean): Brand["status"] {
  if (fit === "No" || /group/i.test(ownership)) return "hidden";
  if (fit === "Yes" && /^independent$/i.test(ownership) && siteOk) return "published";
  return "draft";
}

export function brandsFromRows(rows: MasterRow[]): Brand[] {
  const brands = new Map<string, Brand>();
  for (const r of rows) {
    const [brandId, name, site, , countryRaw, city, instagram, description, siteCheck, ownership, , fit] = Array.from({ length: 12 }, (_, i) => (r[i] ?? "").trim());
    if (!/^BRD-\d+$/i.test(brandId) || !name) continue;
    let slug = slugify(name);
    if (brands.has(slug)) slug = `${slug}-${brandId.toLowerCase()}`;
    const domain = cleanDomain(site);
    const parsed = parseDescription(description);
    const iso = toIso2(countryRaw);
    const siteOk = !!domain && !/missing|not verified|wrong site/i.test(siteCheck);
    brands.set(slug, {
      slug,
      brandId: brandId.toUpperCase(),
      name,
      websiteUrl: domain ? (/^https?:\/\//.test(site) ? site : `https://${site.replace(/^www\./, "www.")}`) : null,
      platform: null,
      country: iso,
      countryLabel: iso ? null : safeLabel(countryRaw || null),
      city: city || null,
      story: description || null,
      styleTags: parsed.tags,
      priceMin: parsed.min,
      priceMax: parsed.max,
      priceBand: parsed.band ?? bandFor(parsed.min),
      currency: "USD",
      instagram: instagram || null,
      brandClass: LEGACY.has(name.toLowerCase()) ? "legacy_micro" : "microbrand",
      enPuntoExhibitor: false,
      status: statusFor(ownership, fit, siteOk),
      claimStatus: "unclaimed",
      imageLicenseStatus: "none",
      colorPrimary: null,
      colorSecondary: null,
      shipsTo: [],
      affiliate: null,
      lastSyncedAt: null,
      sources: ["master-list"],
      ownership: ownership || null,
      lugworthyFit: fit || null,
      siteCheck: siteCheck || null,
    });
  }
  return [...brands.values()];
}

// ---------- Directory facts (Coroa microbrand guide, Watch Police) ----------
//
// data/raw/directories.json holds brand-level facts read from two public directories. They fill
// fields the master list doesn't have; they never add brands (the master list decides that).

interface CoroaRow {
  coroaSlug: string; name: string; country?: string; city?: string; website?: string;
  founded?: number; movement?: string; caliberFamilies?: string[]; calibers?: string[];
  caseSizeMm?: [number, number]; styles?: string[]; avgPriceUsd?: number; checked?: string;
}
interface WpRow { name: string; slug: string; country: string | null; founded: number | null; watchCount: number }
export interface Directories {
  coroa: { source: string; brands: CoroaRow[] };
  watchpolice: { source: string; brands: WpRow[] };
}

const COROA_STYLE: Record<string, string> = { chronograph: "chronograph", dive: "dive", dress: "dress", field: "field", gmt: "GMT", pilot: "pilot" };

/** Fills founded year, movement, calibers, case sizes and typical price from the directories. Mutates `brands`. */
export function applyDirectoryFacts(brands: Brand[], dirs: Directories = directoriesJson as unknown as Directories): number {
  const byKey = new Map<string, Brand>();
  const byDomain = new Map<string, Brand>();
  for (const b of brands) {
    byKey.set(keyName(b.name), b);
    const d = cleanDomain(b.websiteUrl);
    if (d) byDomain.set(d, b);
  }

  let matched = 0;
  for (const c of dirs.coroa.brands) {
    const d = c.website && !/https?:\/\/[^/]+\/.+/.test(c.website.replace(/\/$/, "")) ? cleanDomain(c.website) : null;
    const b = (d && byDomain.get(d)) || byKey.get(keyName(c.name));
    if (!b) continue;
    matched++;
    b.sources.push("coroa");
    b.city ??= c.city ?? null;
    if (!b.country && c.country) { b.country = c.country; b.countryLabel = null; }
    b.founded ??= c.founded ?? null;
    if (!b.styleTags.length) b.styleTags = (c.styles ?? []).map((s) => COROA_STYLE[s]).filter(Boolean);
    if (!b.priceBand && c.avgPriceUsd) b.priceBand = bandFor(c.avgPriceUsd * 100);
    const fam = c.caliberFamilies ?? [];
    if ((c.avgPriceUsd ?? 0) >= 10000 || (fam.length && fam.every((f) => f === "in-house calibre"))) b.brandClass = "independent";
    else if (b.brandClass === "microbrand" && c.founded != null && c.founded < 1980) b.brandClass = "legacy_micro";
    if (!b.facts && (c.movement || fam.length || c.caseSizeMm || c.avgPriceUsd)) {
      b.facts = {
        movement: c.movement ?? null,
        caliberFamilies: fam,
        calibers: [...new Set(c.calibers ?? [])].slice(0, 12),
        caseSizeMm: c.caseSizeMm ?? null,
        typicalPriceUsd: c.avgPriceUsd ? c.avgPriceUsd * 100 : null,
        source: `${dirs.coroa.source}brand/${c.coroaSlug}/`,
        checkedAt: c.checked ?? null,
      };
    }
  }
  for (const w of dirs.watchpolice.brands) {
    const b = byKey.get(keyName(w.name));
    if (!b) continue;
    if (!b.sources.includes("watchpolice")) b.sources.push("watchpolice");
    b.founded ??= w.founded;
  }
  return matched;
}

/** Full pipeline: rows -> brands with directory facts, sorted by name. */
export function buildBrands(rows: MasterRow[], dirs?: Directories): Brand[] {
  const brands = brandsFromRows(rows);
  applyDirectoryFacts(brands, dirs);
  return brands.sort((a, b) => a.name.localeCompare(b.name, "en", { sensitivity: "base" }));
}
