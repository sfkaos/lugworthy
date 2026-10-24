// Normalizers shared by the Shopify ingester and the seed builder (doc 07).
// Every function is pure and returns null when it can't be sure.

import type {
  CaseMaterial,
  Complication,
  CrystalMaterial,
  DialColor,
  MovementType,
  StrapType,
  Style,
} from "../types";

const num = (s: string) => Number(s.replace(",", "."));

/** "40mm", "40 mm", 40, "1.57 in" -> 40.0 (mm, 0.1 precision). */
export function toMm(input: unknown): number | null {
  if (input == null || input === "") return null;
  if (typeof input === "number") return Number.isFinite(input) && input > 0 ? round1(input) : null;
  const s = String(input).toLowerCase();
  const inch = s.match(/(\d+(?:[.,]\d+)?)\s*(?:in\b|inch|")/);
  if (inch && !/mm/.test(s)) return round1(num(inch[1]) * 25.4);
  const m = s.match(/(\d+(?:[.,]\d+)?)/);
  if (!m) return null;
  const v = num(m[1]);
  return v > 0 && v < 100 ? round1(v) : null;
}

/** Thickness strings like "11.5 without crystal, 12.5 with crystal". */
export function toThickness(input: unknown): { thickness: number | null; inclCrystal: number | null } {
  if (input == null) return { thickness: null, inclCrystal: null };
  if (typeof input === "number") return { thickness: toMm(input), inclCrystal: null };
  const s = String(input).toLowerCase();
  const without = s.match(/(\d+(?:[.,]\d+)?)\s*(?:mm)?\s*(?:without|excl)/);
  const withC = s.match(/(\d+(?:[.,]\d+)?)\s*(?:mm)?\s*(?:with\s|incl)/);
  if (without || withC) {
    return {
      thickness: without ? toMm(without[1]) : null,
      inclCrystal: withC ? toMm(withC[1]) : null,
    };
  }
  return { thickness: toMm(s), inclCrystal: null };
}

/** 200, "200m", "20 ATM", "20 bar", "10ATM", "660ft" -> metres. */
export function toMetres(input: unknown): number | null {
  if (input == null || input === "") return null;
  if (typeof input === "number") return input > 0 ? Math.round(input) : null;
  const s = String(input).toLowerCase().replace(/\s+/g, " ");
  const atm = s.match(/(\d+(?:[.,]\d+)?)\s*(?:atm|bar)\b/);
  if (atm) return Math.round(num(atm[1]) * 10);
  const ft = s.match(/(\d+)\s*(?:ft|feet)\b/);
  const m = s.match(/(\d+)\s*(?:m\b|meters|metres|m\/)/);
  if (m) return Number(m[1]);
  if (ft) return Math.round(Number(ft[1]) * 0.3048);
  const bare = s.match(/^(\d+)$/);
  return bare ? Number(bare[1]) : null;
}

export function toHours(input: unknown): number | null {
  if (input == null || input === "") return null;
  if (typeof input === "number") return input > 0 ? Math.round(input) : null;
  const m = String(input).match(/(\d+)\s*(?:h|hours|hrs)?/i);
  return m ? Number(m[1]) : null;
}

/** "699.00" -> 69900 */
export function toMinorUnits(price: unknown): number | null {
  if (price == null || price === "") return null;
  const n = typeof price === "number" ? price : Number(String(price).replace(/[^0-9.]/g, ""));
  return Number.isFinite(n) ? Math.round(n * 100) : null;
}

function round1(n: number) {
  return Math.round(n * 10) / 10;
}

// ---------- Calibers ----------

interface CaliberInfo {
  name: string;
  maker: string;
  type: MovementType;
  powerReserveH?: number;
  frequencyBph?: number;
  hacking?: boolean;
  handWinding?: boolean;
  functions?: Complication[];
}

/** Master list (seed for the calibers table). Keys are normalized aliases. */
export const CALIBERS: Record<string, CaliberInfo> = {
  nh35: { name: "Seiko NH35", maker: "Seiko Instruments (TMI)", type: "automatic", powerReserveH: 41, frequencyBph: 21600, hacking: true, handWinding: true, functions: ["date"] },
  nh34: { name: "Seiko NH34", maker: "Seiko Instruments (TMI)", type: "automatic", powerReserveH: 41, frequencyBph: 21600, hacking: true, handWinding: true, functions: ["gmt", "date"] },
  nh38: { name: "Seiko NH38", maker: "Seiko Instruments (TMI)", type: "automatic", powerReserveH: 41, frequencyBph: 21600, hacking: true, handWinding: true },
  "4r35": { name: "Seiko 4R35", maker: "Seiko", type: "automatic", powerReserveH: 41, frequencyBph: 21600, hacking: true, handWinding: true, functions: ["date"] },
  vk63: { name: "Seiko VK63", maker: "Seiko Instruments (TMI)", type: "mecaquartz", functions: ["chronograph", "date"] },
  vk64: { name: "Seiko VK64", maker: "Seiko Instruments (TMI)", type: "mecaquartz", functions: ["chronograph", "date"] },
  "9015": { name: "Miyota 9015", maker: "Miyota (Citizen)", type: "automatic", powerReserveH: 42, frequencyBph: 28800, hacking: true, handWinding: true, functions: ["date"] },
  "9039": { name: "Miyota 9039", maker: "Miyota (Citizen)", type: "automatic", powerReserveH: 42, frequencyBph: 28800, hacking: true, handWinding: true },
  "9075": { name: "Miyota 9075", maker: "Miyota (Citizen)", type: "automatic", powerReserveH: 42, frequencyBph: 28800, hacking: true, handWinding: true, functions: ["gmt", "date"] },
  "8215": { name: "Miyota 8215", maker: "Miyota (Citizen)", type: "automatic", powerReserveH: 42, frequencyBph: 21600, hacking: false, handWinding: true },
  "8217": { name: "Miyota 8217", maker: "Miyota (Citizen)", type: "automatic", powerReserveH: 40, frequencyBph: 21600, hacking: false, handWinding: true },
  sw200: { name: "Sellita SW200-1", maker: "Sellita", type: "automatic", powerReserveH: 38, frequencyBph: 28800, hacking: true, handWinding: true },
  sw300: { name: "Sellita SW300-1", maker: "Sellita", type: "automatic", powerReserveH: 56, frequencyBph: 28800, hacking: true, handWinding: true },
  sw330: { name: "Sellita SW330-2", maker: "Sellita", type: "automatic", powerReserveH: 56, frequencyBph: 28800, hacking: true, handWinding: true, functions: ["gmt", "date"] },
  eta2824: { name: "ETA 2824-2", maker: "ETA", type: "automatic", powerReserveH: 38, frequencyBph: 28800, hacking: true, handWinding: true },
  "505.24h": { name: "Ronda 505.24H", maker: "Ronda", type: "quartz", functions: ["gmt"] },
  "7750": { name: "Valjoux 7750", maker: "ETA", type: "automatic", powerReserveH: 48, frequencyBph: 28800, functions: ["chronograph", "day_date"] },
};

/** "SII NH35A", "Seiko NH35", "Cal. 9015", "Sellita 330", "SW200-1b" -> canonical key. */
export function caliberKey(input: unknown): string | null {
  if (input == null || input === "") return null;
  const s = String(input).toLowerCase().replace(/[\s.]/g, "").replace(/^cal/, "");
  const checks: [RegExp, string][] = [
    [/nh35/, "nh35"],
    [/nh34/, "nh34"],
    [/nh38/, "nh38"],
    [/4r35/, "4r35"],
    [/vk63/, "vk63"],
    [/vk64/, "vk64"],
    [/9015/, "9015"],
    [/9039/, "9039"],
    [/9075/, "9075"],
    [/8215/, "8215"],
    [/8217/, "8217"],
    [/sw-?200/, "sw200"],
    [/sw-?300/, "sw300"],
    [/(sw-?|sellita)330/, "sw330"],
    [/2824/, "eta2824"],
    [/50524h|505\.24h/, "505.24h"],
    [/7750/, "7750"],
  ];
  for (const [re, key] of checks) if (re.test(s)) return key;
  return null;
}

export function caliberName(input: unknown): string | null {
  const key = caliberKey(input);
  if (key) return CALIBERS[key].name;
  return input ? String(input).trim() : null;
}

export function caliberSlug(name: string): string {
  return slugify(name.replace(/^(seiko|miyota|sellita|eta|ronda|valjoux)\s+/i, ""));
}

// ---------- Movement ----------

export function toMovementType(input: unknown, caliber?: unknown, tags: string[] = []): MovementType | null {
  const s = `${input ?? ""} ${tags.join(" ")}`.toLowerCase();
  if (/meca-?\s?quartz/.test(s)) return "mecaquartz";
  if (/solar/.test(s)) return "solar";
  if (/hand[-\s]?wound|manual[-\s]?wind/.test(s)) return "hand_wound";
  if (/automatic|self-?winding/.test(s)) return "automatic";
  if (/quartz/.test(s)) return "quartz";
  const key = caliberKey(caliber);
  return key ? CALIBERS[key].type : null;
}

// ---------- Dial / strap / materials ----------

const DIAL_WORDS: [RegExp, DialColor][] = [
  [/skeleton/, "skeleton"],
  [/salmon/, "salmon"],
  [/teal|turquoise/, "teal"],
  [/cream|ivory|beige|eggshell|crema/, "cream"],
  [/navy|blue|aventurine|azure|denim/, "blue"],
  [/green|olive|moss|agave|vert/, "green"],
  [/black|noir|carbon|onyx|ink/, "black"],
  [/white|blanc|pearl/, "white"],
  [/silver/, "silver"],
  [/grey|gray|slate|ardoise|fog|gris/, "grey"],
  [/red|burgundy|garnet|raspberry|bordeaux/, "red"],
  [/orange/, "orange"],
  [/yellow|gold|taxi/, "yellow"],
  [/brown|tabac|tobacco|truffle|chocolate|copper|bronze/, "brown"],
  [/purple|violet/, "purple"],
  [/pink|rose/, "pink"],
];

export function toDialColor(input: unknown): DialColor | null {
  if (!input) return null;
  const s = String(input).toLowerCase();
  if (/\band\b|&|\//.test(s) && /\b(black|white|teal|yellow)\b.*\b(black|white|teal|yellow)\b/.test(s)) {
    return "multi";
  }
  for (const [re, c] of DIAL_WORDS) if (re.test(s)) return c;
  return null;
}

export function toStrapType(input: unknown): StrapType | null {
  if (!input) return null;
  const s = String(input).toLowerCase();
  if (/milanese|mesh/.test(s)) return "mesh";
  if (/bracelet|bonklip|jubilee|oyster|president|link/.test(s)) return "bracelet";
  if (/fkm/.test(s)) return "fkm";
  if (/rubber/.test(s)) return "rubber";
  if (/silicone/.test(s)) return "silicone";
  if (/nato|single[- ]pass|nylon|velcro|military/.test(s)) return "nato";
  if (/canvas/.test(s)) return "canvas";
  if (/sailcloth/.test(s)) return "sailcloth";
  if (/leather|suede|horween/.test(s)) return "leather";
  if (/^steel$/.test(s.trim())) return "bracelet";
  return "other";
}

export function toCaseMaterial(input: unknown): CaseMaterial | null {
  if (!input) return null;
  const s = String(input).toLowerCase();
  if (/904l/.test(s)) return "steel_904l";
  if (/grade\s*5|gr\.?\s*5/.test(s)) return "titanium_gr5";
  if (/titan/.test(s)) return "titanium_gr2";
  if (/bronze|cusn/.test(s)) return "bronze";
  if (/brass/.test(s)) return "brass";
  if (/ceramic/.test(s)) return "ceramic";
  if (/carbon/.test(s)) return "carbon";
  if (/alumin/.test(s)) return "aluminium";
  if (/316|steel|acier|ss\b/.test(s)) return "steel_316l";
  return "other";
}

export function toCrystal(input: unknown): { material: CrystalMaterial | null; shape: "flat" | "domed" | "double_domed" | "box" | null } {
  if (!input) return { material: null, shape: null };
  const s = String(input).toLowerCase();
  const material: CrystalMaterial | null = /sapphire/.test(s)
    ? "sapphire"
    : /mineral/.test(s)
      ? "mineral"
      : /acrylic|hesalite|plexi/.test(s)
        ? "hesalite_acrylic"
        : "other";
  const shape = /double[- ]domed/.test(s) ? "double_domed" : /box/.test(s) ? "box" : /domed/.test(s) ? "domed" : /flat/.test(s) ? "flat" : null;
  return { material, shape };
}

export function toComplications(list: unknown, title = ""): Complication[] {
  const items = Array.isArray(list) ? list.map(String) : [];
  const s = `${items.join(" ")} ${title}`.toLowerCase();
  const out = new Set<Complication>();
  if (/day[- ]date/.test(s)) out.add("day_date");
  else if (/\bdate\b|quanti/.test(s)) out.add("date");
  if (/gmt|utc|24-hour hand/.test(s)) out.add("gmt");
  if (/world ?tim/.test(s)) out.add("world_time");
  if (/chrono/.test(s)) out.add("chronograph");
  if (/flyback/.test(s)) out.add("flyback");
  if (/moon/.test(s)) out.add("moonphase");
  if (/power reserve/.test(s)) out.add("power_reserve");
  if (/small seconds/.test(s)) out.add("small_seconds");
  return [...out];
}

/** Infer styles from title, tags, bezel and water resistance. Low-stakes: editors can override. */
export function inferStyles(opts: {
  title: string;
  tags: string[];
  productType?: string;
  bezel?: string | null;
  wrM?: number | null;
  complications: Complication[];
  strap?: string | null;
}): Style[] {
  const s = `${opts.title} ${opts.tags.join(" ")} ${opts.productType ?? ""} ${opts.bezel ?? ""}`.toLowerCase();
  const out = new Set<Style>();
  if (/div|plong|offshore|sub\b|helmsman|odyssey|oceanracer/.test(s) || ((opts.wrM ?? 0) >= 200 && /unidirectional|dive|120/.test(s))) out.add("diver");
  if ((opts.wrM ?? 0) >= 200 && opts.bezel && !/fixed|gmt|24/i.test(opts.bezel)) out.add("diver");
  if (/skin ?diver/.test(s)) out.add("skin_diver");
  if (/field|hiker|medic|tactical|explorer/.test(s)) out.add("field");
  if (/pilot|aviat|flieger/.test(s)) out.add("pilot");
  if (opts.complications.includes("gmt") || /gmt|utc/.test(s)) out.add("gmt");
  if (opts.complications.includes("chronograph") || /chrono/.test(opts.title.toLowerCase())) out.add("chronograph");
  if (/racing|racer|rally|motorsport/.test(s)) out.add("racing");
  if (/dress|parade/.test(s)) out.add("dress");
  if (/integrated/.test(`${s} ${opts.strap ?? ""}`)) out.add("integrated_bracelet");
  if (/tool|mil-?diver/.test(s)) out.add("tool");
  if (out.size === 0) out.add("other");
  return [...out];
}

// ---------- Text extraction from body_html (regex + dictionary) ----------

export interface ExtractedSpecs {
  caseDiameterMm?: number;
  lugToLugMm?: number;
  thicknessMm?: number;
  lugWidthMm?: number;
  waterResistanceM?: number;
  caliber?: string;
  crystal?: string;
  powerReserveH?: number;
  confidence: number; // 0..1, share of the core fields found
}

/** Pulls specs out of free text such as Shopify body_html. */
export function extractSpecsFromText(html: string): ExtractedSpecs {
  const text = html.replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/\s+/g, " ");
  const out: ExtractedSpecs = { confidence: 0 };
  const grab = (re: RegExp) => text.match(re)?.[1];

  const dia = grab(/(?:case (?:size|diameter)|diameter)\s*[:\-]?\s*(\d{2}(?:[.,]\d)?)\s*mm/i) ?? grab(/\b(\d{2}(?:[.,]\d)?)\s*mm\s*(?:case|diameter)/i);
  const l2l = grab(/lug[\s-]*to[\s-]*lug\s*[:\-]?\s*(\d{2}(?:[.,]\d)?)/i);
  const thk = grab(/(?:thickness|height)\s*[:\-]?\s*(\d{1,2}(?:[.,]\d)?)\s*mm/i);
  const lug = grab(/lug width\s*[:\-]?\s*(\d{2})/i);
  const wr = grab(/water[\s-]*resist\w*\s*[:\-]?\s*([0-9]+\s*(?:m|meters|metres|atm|bar)\b)/i) ?? grab(/\b(\d{2,4}\s*(?:m|atm))\b\s*water/i);
  const cal = grab(/\b((?:seiko |sii )?nh3[4-8]a?|miyota \d{4}|cal(?:iber)?\.?\s*\d{4}|sellita sw\s?\d{3}(?:-\d)?|sw\s?\d{3}(?:-\d)?|eta \d{4}(?:-\d)?|vk6[34]|ronda [\d.]+\w?)\b/i);
  const crystal = grab(/\b((?:double[- ]domed |domed |box |flat )?(?:sapphire|mineral|acrylic|hesalite))\b/i);
  const pr = grab(/power reserve\s*(?:of)?\s*[:\-]?\s*(\d{2,3})\s*(?:h|hours)/i);

  if (dia) out.caseDiameterMm = toMm(dia) ?? undefined;
  if (l2l) out.lugToLugMm = toMm(l2l) ?? undefined;
  if (thk) out.thicknessMm = toMm(thk) ?? undefined;
  if (lug) out.lugWidthMm = toMm(lug) ?? undefined;
  if (wr) out.waterResistanceM = toMetres(wr) ?? undefined;
  if (cal) out.caliber = caliberName(cal) ?? undefined;
  if (crystal) out.crystal = crystal.toLowerCase();
  if (pr) out.powerReserveH = Number(pr);

  const core = [out.caseDiameterMm, out.lugToLugMm, out.thicknessMm, out.waterResistanceM, out.caliber];
  out.confidence = core.filter((v) => v != null).length / core.length;
  return out;
}

/** Bundles, straps and accessories go on the ignore list (doc 07 Dedupe). */
export function isAccessory(title: string, productType = "", tags: string[] = []): boolean {
  const s = `${title} ${productType} ${tags.join(" ")}`.toLowerCase();
  return /\b(strap|bracelet only|tool|gift ?card|pouch|watch roll|box|buckle|spring bar|sticker|hat|t-?shirt|deposit)\b/.test(s) && !/watch\b/.test(productType.toLowerCase());
}

export function slugify(s: string): string {
  return s
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}
