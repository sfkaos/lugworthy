// ISO-2 lookup for the country names used in the brand spreadsheets.

export const COUNTRY_NAMES: Record<string, string> = {
  US: "United States", GB: "United Kingdom", CA: "Canada", MX: "Mexico", BR: "Brazil",
  AR: "Argentina", CL: "Chile", CO: "Colombia", PR: "Puerto Rico", FR: "France",
  DE: "Germany", CH: "Switzerland", IT: "Italy", ES: "Spain", NL: "Netherlands",
  BE: "Belgium", AT: "Austria", SE: "Sweden", NO: "Norway", DK: "Denmark", FI: "Finland",
  IS: "Iceland", IE: "Ireland", PL: "Poland", CZ: "Czech Republic", SK: "Slovakia",
  SI: "Slovenia", HR: "Croatia", HU: "Hungary", BG: "Bulgaria", GR: "Greece", AL: "Albania",
  TR: "Turkey", AE: "United Arab Emirates", BH: "Bahrain", KW: "Kuwait", LB: "Lebanon",
  IL: "Israel", IN: "India", CN: "China", HK: "Hong Kong", TW: "Taiwan", JP: "Japan",
  SG: "Singapore", MY: "Malaysia", ID: "Indonesia", TH: "Thailand", PH: "Philippines",
  AU: "Australia", NZ: "New Zealand",
};

const ALIASES: [RegExp, string][] = [
  [/^(usa|united states|us)\b/i, "US"],
  [/^puerto rico/i, "PR"],
  [/^(uk|united kingdom|northern ireland|england|scotland|wales)\b/i, "GB"],
  [/^uae\b|^united arab emirates/i, "AE"],
  [/^hong kong/i, "HK"],
  [/^czech/i, "CZ"],
];

/** "USA (Dallas, TX)" -> "US"; "Unknown" or ambiguous mixes -> null. */
export function toIso2(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const s = raw.trim();
  if (!s || /^unknown|^uncertain/i.test(s)) return null;
  for (const [re, iso] of ALIASES) if (re.test(s)) return iso;
  const head = s.split(/[(/;,]/)[0].replace(/\?|\(likely\)/g, "").trim().toLowerCase();
  for (const [iso, name] of Object.entries(COUNTRY_NAMES)) {
    if (name.toLowerCase() === head) return iso;
  }
  return null;
}

export function countryName(iso: string | null | undefined): string {
  if (!iso) return "Unknown";
  return COUNTRY_NAMES[iso] ?? iso;
}

export function countrySlug(iso: string): string {
  return iso.toLowerCase();
}
