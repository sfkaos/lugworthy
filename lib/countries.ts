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
  AU: "Australia", NZ: "New Zealand", PT: "Portugal", RU: "Russia", UA: "Ukraine",
  RO: "Romania", LT: "Lithuania", LV: "Latvia", EE: "Estonia", RS: "Serbia", BY: "Belarus",
  LU: "Luxembourg", MC: "Monaco", LI: "Liechtenstein", CY: "Cyprus", MT: "Malta", KR: "South Korea",
  VN: "Vietnam", PK: "Pakistan", BD: "Bangladesh", LK: "Sri Lanka", NP: "Nepal", MO: "Macau",
  QA: "Qatar", SA: "Saudi Arabia", EG: "Egypt", ZA: "South Africa", GH: "Ghana", NG: "Nigeria",
  KE: "Kenya", PE: "Peru", UY: "Uruguay", KZ: "Kazakhstan", GE: "Georgia", AM: "Armenia",
};

const ALIASES: [RegExp, string][] = [
  [/^(usa|united states|us)\b/i, "US"],
  [/^puerto rico/i, "PR"],
  [/^(uk|united kingdom|northern ireland|england|scotland|wales)\b/i, "GB"],
  [/^uae\b|^united arab emirates/i, "AE"],
  [/^hong kong/i, "HK"],
  [/^czech/i, "CZ"],
  [/^(great britain)\b/i, "GB"],
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
