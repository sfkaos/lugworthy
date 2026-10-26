// Faceted browse over models (doc 09). Pure functions so they run on the server
// (SSR, shareable URLs) and in tests. One document per model; variant prices are
// collapsed to the model's minimum.

import { countryName } from "./countries";
import { brandInfo, isAvailable, minPriceUsd } from "./model-utils";
import type { Model } from "./types";

export type Range = { min?: number; max?: number };

export interface Filters {
  q?: string;
  price?: Range; // whole USD
  dia?: Range;
  l2l?: Range;
  thk?: Range;
  mov?: string[];
  wr?: number;
  style?: string[];
  dial?: string[];
  strap?: string[];
  avail?: string[];
  cal?: string[];
  crystal?: string[];
  mat?: string[];
  lug?: string[];
  comp?: string[];
  country?: string[];
  sort?: SortKey;
  page?: number;
}

export type SortKey = "relevance" | "newest" | "price_asc" | "price_desc" | "diameter_asc" | "diameter_desc" | "thinnest";
export const SORTS: SortKey[] = ["relevance", "newest", "price_asc", "price_desc", "diameter_asc", "diameter_desc", "thinnest"];

export const PAGE_SIZE = 24;
export const WR_STEPS = [30, 50, 100, 200, 300, 500];

type Params = Record<string, string | string[] | undefined>;

function one(p: Params, k: string): string | undefined {
  const v = p[k];
  return Array.isArray(v) ? v[0] : v;
}

/** "200-800", "-48", "36-" -> Range */
export function parseRange(s: string | undefined): Range | undefined {
  if (!s) return undefined;
  const m = s.match(/^(\d*(?:\.\d+)?)-(\d*(?:\.\d+)?)$/);
  if (!m) return undefined;
  const r: Range = {};
  if (m[1]) r.min = Number(m[1]);
  if (m[2]) r.max = Number(m[2]);
  return r.min == null && r.max == null ? undefined : r;
}

export function formatRange(r: Range | undefined): string | undefined {
  if (!r || (r.min == null && r.max == null)) return undefined;
  return `${r.min ?? ""}-${r.max ?? ""}`;
}

const list = (s: string | undefined) => (s ? s.split(",").map((x) => x.trim()).filter(Boolean) : undefined);

export function parseFilters(p: Params): Filters {
  const sort = one(p, "sort") as SortKey | undefined;
  const page = Number(one(p, "page") ?? 1);
  return {
    q: one(p, "q")?.trim() || undefined,
    price: parseRange(one(p, "price")),
    dia: parseRange(one(p, "dia")),
    l2l: parseRange(one(p, "l2l")),
    thk: parseRange(one(p, "thk")),
    mov: list(one(p, "mov")),
    wr: one(p, "wr") ? Number(one(p, "wr")) : undefined,
    style: list(one(p, "style")),
    dial: list(one(p, "dial")),
    strap: list(one(p, "strap")),
    avail: list(one(p, "avail")),
    cal: list(one(p, "cal")),
    crystal: list(one(p, "crystal")),
    mat: list(one(p, "mat")),
    lug: list(one(p, "lug")),
    comp: list(one(p, "comp")),
    country: list(one(p, "country"))?.map((c) => c.toUpperCase()),
    sort: sort && SORTS.includes(sort) ? sort : undefined,
    page: Number.isFinite(page) && page > 1 ? Math.floor(page) : undefined,
  };
}

export function toSearchParams(f: Filters): URLSearchParams {
  const sp = new URLSearchParams();
  const set = (k: string, v: string | undefined) => v && sp.set(k, v);
  set("q", f.q);
  set("price", formatRange(f.price));
  set("dia", formatRange(f.dia));
  set("l2l", formatRange(f.l2l));
  set("thk", formatRange(f.thk));
  set("mov", f.mov?.join(","));
  set("wr", f.wr ? String(f.wr) : undefined);
  set("style", f.style?.join(","));
  set("dial", f.dial?.join(","));
  set("strap", f.strap?.join(","));
  set("avail", f.avail?.join(","));
  set("cal", f.cal?.join(","));
  set("crystal", f.crystal?.join(","));
  set("mat", f.mat?.join(","));
  set("lug", f.lug?.join(","));
  set("comp", f.comp?.join(","));
  set("country", f.country?.join(","));
  set("sort", f.sort);
  set("page", f.page ? String(f.page) : undefined);
  return sp;
}

// ---------- Facet value accessors ----------

export function availability(m: Model): string {
  if (m.status === "preorder") return "preorder";
  if (m.status === "crowdfunding") return "crowdfunding";
  return isAvailable(m) ? "in_stock" : "sold_out";
}

export const caliberFacet = (m: Model) => (m.specs.caliber ? m.specs.caliber.toLowerCase().replace(/[^a-z0-9]+/g, "_") : null);

const ACCESSORS: Record<string, (m: Model) => string[]> = {
  mov: (m) => (m.specs.movementType ? [m.specs.movementType] : []),
  style: (m) => m.styles,
  dial: (m) => (m.specs.dialColor ? [m.specs.dialColor] : []),
  strap: (m) => (m.specs.strapType ? [m.specs.strapType] : []),
  avail: (m) => [availability(m)],
  cal: (m) => (caliberFacet(m) ? [caliberFacet(m)!] : []),
  crystal: (m) => (m.specs.crystalMaterial ? [m.specs.crystalMaterial] : []),
  mat: (m) => (m.specs.caseMaterial ? [m.specs.caseMaterial] : []),
  lug: (m) => (m.specs.lugWidthMm ? [String(m.specs.lugWidthMm)] : []),
  comp: (m) => m.specs.complications,
  country: (m) => (brandInfo(m).country ? [brandInfo(m).country!] : []),
};

export const MULTI_FACETS = Object.keys(ACCESSORS) as (keyof typeof ACCESSORS)[];

const inRange = (v: number | null, r?: Range) => {
  if (!r) return true;
  if (v == null) return false;
  return (r.min == null || v >= r.min) && (r.max == null || v <= r.max);
};

// ---------- Text search ----------

const SYNONYMS: Record<string, string> = {
  dive: "diver", divers: "diver", band: "strap", auto: "automatic", automatics: "automatic",
  manual: "hand_wound", handwound: "hand_wound", "hand-wound": "hand_wound", ti: "titanium",
  chrono: "chronograph", pilot: "pilot", flieger: "pilot", gmts: "gmt", sapphire: "sapphire",
};

function editDistanceLe1(a: string, b: string): boolean {
  if (a === b) return true;
  if (Math.abs(a.length - b.length) > 1) return false;
  let i = 0, j = 0, edits = 0;
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) { i++; j++; continue; }
    if (++edits > 1) return false;
    if (a.length > b.length) i++;
    else if (b.length > a.length) j++;
    else if (a[i + 1] === b[j] && a[i] === b[j + 1]) { i += 2; j += 2; } // transposition
    else { i++; j++; }
  }
  return edits + (a.length - i) + (b.length - j) <= 1;
}

function haystack(m: Model): { field: string; weight: number }[] {
  const b = brandInfo(m);
  return [
    { field: m.name, weight: 5 },
    { field: b.name, weight: 4 },
    { field: m.reference ?? "", weight: 4 },
    { field: m.specs.caliber ?? "", weight: 3 },
    { field: `${m.styles.join(" ")} ${m.specs.movementType ?? ""} ${m.specs.complications.join(" ")}`, weight: 2 },
    { field: `${m.specs.dialColorRaw ?? ""} ${m.specs.caseMaterial ?? ""} ${m.specs.crystalMaterial ?? ""} ${countryName(b.country)} ${b.styleTags.join(" ")}`, weight: 1 },
  ];
}

export function tokenize(q: string): string[] {
  return q
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .split(/[^a-z0-9_.]+/)
    .filter(Boolean)
    .map((t) => SYNONYMS[t] ?? t);
}

/** Every query token must match some field (prefix, substring or 1 typo for tokens of 5+). */
export function textScore(m: Model, q: string): number {
  const tokens = tokenize(q);
  if (!tokens.length) return 1;
  const fields = haystack(m).map((f) => ({ words: tokenize(f.field), raw: f.field.toLowerCase(), weight: f.weight }));
  let score = 0;
  for (const t of tokens) {
    let best = 0;
    for (const f of fields) {
      if (f.words.some((w) => w === t)) best = Math.max(best, f.weight * 2);
      else if (f.words.some((w) => w.startsWith(t)) || f.raw.includes(t)) best = Math.max(best, f.weight * 1.5);
      else if (t.length >= 5 && f.words.some((w) => editDistanceLe1(w, t))) best = Math.max(best, f.weight);
    }
    if (!best) return 0;
    score += best;
  }
  return score;
}

// ---------- Apply ----------

function passes(m: Model, f: Filters, skip?: string): boolean {
  const s = m.specs;
  if (skip !== "price" && !inRange(minPriceUsd(m) / 100, f.price)) return false;
  if (skip !== "dia" && !inRange(s.caseDiameterMm, f.dia)) return false;
  if (skip !== "l2l" && !inRange(s.lugToLugMm, f.l2l)) return false;
  if (skip !== "thk" && !inRange(s.thicknessMm ?? s.thicknessInclCrystalMm, f.thk)) return false;
  if (skip !== "wr" && f.wr && (s.waterResistanceM ?? 0) < f.wr) return false;
  for (const k of MULTI_FACETS) {
    if (k === skip) continue;
    const want = f[k as keyof Filters] as string[] | undefined;
    if (want?.length && !ACCESSORS[k](m).some((v) => want.includes(v))) return false;
  }
  return true;
}

export interface FacetCounts {
  [facet: string]: Record<string, number>;
}

export interface BrowseResult {
  total: number;
  items: Model[];
  /** Every match in sorted order, before paging (the API pages these itself). */
  all: Model[];
  page: number;
  pages: number;
  counts: FacetCounts;
  wrCounts: Record<number, number>;
}

export function browse(models: Model[], f: Filters): BrowseResult {
  const scored = new Map<Model, number>();
  const textMatched = f.q
    ? models.filter((m) => {
        const sc = textScore(m, f.q!);
        if (sc > 0) scored.set(m, sc);
        return sc > 0;
      })
    : models;

  const matched = textMatched.filter((m) => passes(m, f));

  // Counts per option ignore the facet's own selection, so options stay selectable.
  const counts: FacetCounts = {};
  for (const k of MULTI_FACETS) {
    const c: Record<string, number> = {};
    for (const m of textMatched) {
      if (!passes(m, f, k)) continue;
      for (const v of ACCESSORS[k](m)) c[v] = (c[v] ?? 0) + 1;
    }
    // keep zero-count options that exist in the catalog (shown disabled)
    for (const m of models) for (const v of ACCESSORS[k](m)) c[v] ??= 0;
    counts[k] = c;
  }
  const wrCounts: Record<number, number> = {};
  const wrBase = textMatched.filter((m) => passes(m, f, "wr"));
  for (const step of WR_STEPS) wrCounts[step] = wrBase.filter((m) => (m.specs.waterResistanceM ?? 0) >= step).length;

  const sort = f.sort ?? (f.q ? "relevance" : "newest");
  const byNum = (get: (m: Model) => number | null, dir: 1 | -1) => (a: Model, b: Model) => {
    const va = get(a), vb = get(b);
    if (va == null && vb == null) return 0;
    if (va == null) return 1;
    if (vb == null) return -1;
    return (va - vb) * dir;
  };
  const sorted = [...matched];
  switch (sort) {
    case "relevance": sorted.sort((a, b) => (scored.get(b) ?? 0) - (scored.get(a) ?? 0)); break;
    case "price_asc": sorted.sort(byNum(minPriceUsd, 1)); break;
    case "price_desc": sorted.sort(byNum(minPriceUsd, -1)); break;
    case "diameter_asc": sorted.sort(byNum((m) => m.specs.caseDiameterMm, 1)); break;
    case "diameter_desc": sorted.sort(byNum((m) => m.specs.caseDiameterMm, -1)); break;
    case "thinnest": sorted.sort(byNum((m) => m.specs.thicknessMm ?? m.specs.thicknessInclCrystalMm, 1)); break;
    default:
      // newest: in-stock and preorder first, then import order
      sorted.sort((a, b) => Number(availability(b) !== "sold_out") - Number(availability(a) !== "sold_out"));
  }

  const pages = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
  const page = Math.min(f.page ?? 1, pages);
  return {
    total: sorted.length,
    items: sorted.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE),
    all: sorted,
    page,
    pages,
    counts,
    wrCounts,
  };
}

/** Number of active filters (excluding q/sort/page). */
export function activeCount(f: Filters): number {
  let n = 0;
  for (const k of ["price", "dia", "l2l", "thk", "wr"] as const) if (f[k]) n++;
  for (const k of MULTI_FACETS) n += (f[k as keyof Filters] as string[] | undefined)?.length ?? 0;
  return n;
}
