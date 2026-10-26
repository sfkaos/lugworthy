// App-level types. They mirror the Postgres schema in db/schema.ts (doc 06),
// trimmed to what the directory pages read today.

export type Provenance = "imported" | "brand" | "editor";

export type MovementType =
  | "automatic"
  | "hand_wound"
  | "quartz"
  | "mecaquartz"
  | "solar"
  | "kinetic"
  | "spring_drive"
  | "smart_hybrid";

export type Style =
  | "diver"
  | "field"
  | "pilot"
  | "gmt"
  | "chronograph"
  | "dress"
  | "racing"
  | "skin_diver"
  | "integrated_bracelet"
  | "tool"
  | "digital"
  | "other";

export type DialColor =
  | "black" | "white" | "silver" | "grey" | "blue" | "green" | "red" | "orange"
  | "yellow" | "brown" | "cream" | "salmon" | "purple" | "pink" | "teal" | "multi" | "skeleton";

export type StrapType =
  | "bracelet" | "rubber" | "fkm" | "silicone" | "leather" | "nato" | "canvas"
  | "mesh" | "sailcloth" | "other";

export type CaseMaterial =
  | "steel_316l" | "steel_904l" | "titanium_gr2" | "titanium_gr5" | "bronze" | "brass"
  | "ceramic" | "carbon" | "aluminium" | "gold" | "silver" | "other";

export type CrystalMaterial = "sapphire" | "mineral" | "hesalite_acrylic" | "other";

export type Complication =
  | "date" | "day_date" | "gmt" | "world_time" | "chronograph" | "flyback" | "moonphase"
  | "power_reserve" | "small_seconds" | "alarm" | "annual_calendar" | "regulator";

export type ModelStatus =
  | "in_production" | "preorder" | "crowdfunding" | "discontinued" | "sold_out" | "announced";

export type PriceBand = "budget" | "affordable" | "mid" | "upper_mid" | "high";

export type BrandClass = "microbrand" | "legacy_micro" | "independent";

export interface Brand {
  slug: string;
  brandId?: string; // permanent ID from the master list, e.g. BRD-0001
  name: string;
  websiteUrl: string | null;
  platform: "shopify" | "woocommerce" | "bigcommerce" | "squarespace" | "other" | null;
  country: string | null; // ISO-2
  countryLabel: string | null; // as written in the source sheet when no clean ISO match
  city: string | null;
  story: string | null;
  styleTags: string[]; // free-form tags from the research sheet ("lume lovers", "bronze case")
  priceMin: number | null; // minor units, USD
  priceMax: number | null;
  priceBand: PriceBand | null;
  currency: string;
  instagram: string | null;
  brandClass: BrandClass;
  enPuntoExhibitor: boolean;
  status: "draft" | "published" | "hidden";
  claimStatus: "unclaimed" | "pending" | "claimed";
  imageLicenseStatus: "none" | "granted" | "revoked";
  colorPrimary: string | null;
  colorSecondary: string | null;
  shipsTo: string[];
  affiliate: { network: string; urlTemplate: string } | null;
  lastSyncedAt: string | null;
  sources: string[]; // which spreadsheet(s) the row came from
  founded?: number | null;
  /** Brand-level facts from public watch directories, used until the brand's own catalog is imported. */
  facts?: BrandFacts | null;
  /** Straight from the master list: "Independent", "Group-owned" or "Needs review". */
  ownership?: string | null;
  /** Master list "Lugworthy fit": "Yes", "No" or "Review". */
  lugworthyFit?: string | null;
  siteCheck?: string | null;
}

export interface BrandFacts {
  movement: string | null; // "automatic only", "quartz and mechanical", ...
  caliberFamilies: string[]; // "Miyota/Citizen", "Sellita", "in-house calibre", ...
  calibers: string[];
  caseSizeMm: [number, number] | null;
  typicalPriceUsd: number | null; // minor units; the directory's average listed price
  source: string; // directory URL
  checkedAt: string | null;
}

export interface Specs {
  caseDiameterMm: number | null;
  lugToLugMm: number | null;
  thicknessMm: number | null;
  thicknessInclCrystalMm: number | null;
  lugWidthMm: number | null;
  caseMaterial: CaseMaterial | null;
  bezelType: string | null;
  crystalMaterial: CrystalMaterial | null;
  crystalShape: "flat" | "domed" | "double_domed" | "box" | null;
  waterResistanceM: number | null;
  movementType: MovementType | null;
  caliber: string | null; // canonical caliber name, e.g. "Miyota 9015"
  powerReserveH: number | null;
  complications: Complication[];
  dialColor: DialColor | null;
  dialColorRaw: string | null;
  lumeType: string | null;
  strapType: StrapType | null;
  strapRaw: string | null;
}

export type SpecKey = keyof Specs;

export interface Variant {
  id: string; // stable: brandSlug/modelSlug/index
  sku: string | null;
  title: string;
  price: number; // minor units in variant currency
  currency: string;
  priceUsd: number; // minor units, approximate when currency != USD
  compareAtPrice: number | null;
  available: boolean;
  url: string | null;
}

export interface Model {
  slug: string;
  brandSlug: string;
  /** Permanent master-list ID of the brand. Models follow it if the brand's name (and slug) changes. */
  brandId?: string;
  /** Filled in when the catalog loads, so cards and filters can show the brand without another lookup. */
  brand?: { name: string; country: string | null; styleTags: string[] };
  name: string;
  reference: string | null;
  status: ModelStatus;
  limitedEdition: boolean;
  styles: Style[];
  sourceUrl: string | null;
  published: boolean;
  specs: Specs;
  specSources: Partial<Record<SpecKey, Provenance>>;
  variants: Variant[];
  importedAt: string;
  reviewed: boolean; // false until an editor approves the imported record
}
