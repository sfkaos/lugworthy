// Postgres schema (doc 06) for Drizzle. Brands are filled from the master Google Sheet by the
// sync job (lib/sync/sheet.ts) and read by the site and /api/v1 (lib/db/read.ts). The catalog
// crawler's results land in brand_crawls, site_watches and site_watch_images.
// Prices are minor units. Localized text is jsonb { en, es? }.

import { sql } from "drizzle-orm";
import {
  boolean, date, doublePrecision, integer, jsonb, numeric, pgEnum, pgTable, primaryKey, text, timestamp, uniqueIndex, uuid, index,
} from "drizzle-orm/pg-core";

type L10n = { en: string; es?: string };

const id = () => uuid("id").primaryKey().default(sql`gen_random_uuid()`);
const stamps = {
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
};

export const platform = pgEnum("platform", ["shopify", "woocommerce", "bigcommerce", "squarespace", "other"]);
export const brandClass = pgEnum("brand_class", ["microbrand", "legacy_micro", "independent"]);
export const publishStatus = pgEnum("publish_status", ["draft", "published", "hidden"]);
export const claimStatus = pgEnum("claim_status", ["unclaimed", "pending", "claimed"]);
export const licenseStatus = pgEnum("license_status", ["none", "granted", "revoked"]);
export const modelStatus = pgEnum("model_status", ["in_production", "preorder", "crowdfunding", "discontinued", "sold_out", "announced"]);
export const style = pgEnum("style", ["diver", "field", "pilot", "gmt", "chronograph", "dress", "racing", "skin_diver", "integrated_bracelet", "tool", "digital", "other"]);
export const dialColor = pgEnum("dial_color", ["black", "white", "silver", "grey", "blue", "green", "red", "orange", "yellow", "brown", "cream", "salmon", "purple", "pink", "teal", "multi", "skeleton"]);
export const strapType = pgEnum("strap_type", ["bracelet", "rubber", "fkm", "silicone", "leather", "nato", "canvas", "mesh", "sailcloth", "other"]);
export const caseMaterial = pgEnum("case_material", ["steel_316l", "steel_904l", "titanium_gr2", "titanium_gr5", "bronze", "brass", "ceramic", "carbon", "aluminium", "gold", "silver", "other"]);
export const caseFinish = pgEnum("case_finish", ["brushed", "polished", "bead_blasted", "mixed"]);
export const caseCoating = pgEnum("case_coating", ["none", "dlc", "pvd", "ip"]);
export const caseShape = pgEnum("case_shape", ["round", "cushion", "tonneau", "square", "rectangular", "other"]);
export const crownType = pgEnum("crown_type", ["screw_down", "push_pull"]);
export const crownPosition = pgEnum("crown_position", ["3", "4", "2", "9", "other"]);
export const bezelType = pgEnum("bezel_type", ["fixed", "unidirectional_60", "unidirectional_120", "bidirectional", "gmt_24h", "12h", "countdown", "internal_rotating", "none"]);
export const bezelInsert = pgEnum("bezel_insert", ["ceramic", "aluminium", "sapphire", "steel", "bakelite", "other"]);
export const crystalMaterial = pgEnum("crystal_material", ["sapphire", "mineral", "hesalite_acrylic", "other"]);
export const crystalShape = pgEnum("crystal_shape", ["flat", "domed", "double_domed", "box"]);
export const arCoating = pgEnum("ar_coating", ["none", "inner", "outer", "both"]);
export const caseback = pgEnum("caseback", ["solid", "exhibition", "screwdown_solid", "screwdown_exhibition"]);
export const movementType = pgEnum("movement_type", ["automatic", "hand_wound", "quartz", "mecaquartz", "solar", "kinetic", "spring_drive", "smart_hybrid"]);
export const complication = pgEnum("complication", ["date", "day_date", "gmt", "world_time", "chronograph", "flyback", "moonphase", "power_reserve", "small_seconds", "alarm", "annual_calendar", "regulator", "none"]);
export const dialTexture = pgEnum("dial_texture", ["sunburst", "matte", "gloss", "enamel", "stone", "guilloche", "textured", "fume", "sandwich", "meteorite", "mother_of_pearl"]);
export const indices = pgEnum("indices", ["applied", "printed", "numerals_applied", "numerals_printed", "mixed"]);
export const lumeType = pgEnum("lume_type", ["super_luminova_bgw9", "c3", "c1", "x1", "old_radium", "tritium_tubes", "none", "other"]);
export const braceletLink = pgEnum("bracelet_link", ["oyster", "jubilee", "beads_of_rice", "integrated", "president", "h_link", "other"]);
export const endlinks = pgEnum("endlinks", ["solid", "folded", "integrated", "none"]);
export const clasp = pgEnum("clasp", ["micro_adjust", "on_the_fly", "tool_free", "deployant", "buckle", "butterfly"]);
export const mediaOwner = pgEnum("media_owner", ["brand", "model", "variant", "article"]);
export const mediaKind = pgEnum("media_kind", ["product_front", "product_side", "product_back", "wrist", "lifestyle", "360", "banner", "logo", "detail"]);
export const mediaRights = pgEnum("media_rights", ["unknown", "licensed", "own", "revoked"]);
export const videoPlatform = pgEnum("video_platform", ["youtube", "instagram", "tiktok"]);
export const articleType = pgEnum("article_type", ["guide", "roundup", "fair", "interview"]);
export const userRole = pgEnum("user_role", ["admin", "editor", "brand"]);
export const claimMethod = pgEnum("claim_method", ["domain_email", "meta_tag", "dns_txt", "manual"]);
export const claimState = pgEnum("claim_state", ["pending", "verified", "rejected", "expired"]);
export const reviewState = pgEnum("review_state", ["pending", "approved", "rejected"]);

export const brands = pgTable("brands", {
  id: id(), ...stamps,
  // Permanent master-list ID (BRD-####). The sync job upserts on it.
  brandCode: text("brand_code").unique(),
  slug: text("slug").notNull().unique(),
  name: text("name").notNull(),
  legalName: text("legal_name"),
  websiteUrl: text("website_url"),
  shopifyDomain: text("shopify_domain"),
  platform: platform("platform"),
  country: text("country"), // ISO-2
  city: text("city"),
  foundedYear: integer("founded_year"),
  story: jsonb("story").$type<L10n>(),
  tagline: jsonb("tagline").$type<L10n>(),
  logoMediaId: uuid("logo_media_id"),
  logoDarkMediaId: uuid("logo_dark_media_id"),
  bannerMediaId: uuid("banner_media_id"),
  bannerFocalX: doublePrecision("banner_focal_x"),
  bannerFocalY: doublePrecision("banner_focal_y"),
  colorPrimary: text("color_primary"),
  colorSecondary: text("color_secondary"),
  priceMin: integer("price_min"),
  priceMax: integer("price_max"),
  currency: text("currency").notNull().default("USD"),
  socials: jsonb("socials").$type<{ instagram?: string; youtube?: string; tiktok?: string }>(),
  styleTags: text("style_tags").array().notNull().default(sql`'{}'`),
  isMicrobrandClass: brandClass("is_microbrand_class").notNull().default("microbrand"),
  enPuntoExhibitor: boolean("en_punto_exhibitor").notNull().default(false),
  enPuntoEditions: text("en_punto_editions").array().notNull().default(sql`'{}'`),
  status: publishStatus("status").notNull().default("draft"),
  claimStatus: claimStatus("claim_status").notNull().default("unclaimed"),
  imageLicenseStatus: licenseStatus("image_license_status").notNull().default("none"),
  affiliateProgram: jsonb("affiliate_program").$type<{ network: string; param?: string; url_template: string }>(),
  shipsTo: text("ships_to").array().notNull().default(sql`'{}'`),
  lastSyncedAt: timestamp("last_synced_at", { withTimezone: true }),
  // From the master sheet's public columns (A-L) and the directory facts.
  countryLabel: text("country_label"),
  priceBand: text("price_band"),
  ownership: text("ownership"),
  lugworthyFit: text("lugworthy_fit"),
  siteCheck: text("site_check"),
  facts: jsonb("facts").$type<Record<string, unknown>>(),
  sources: text("sources").array().notNull().default(sql`'{}'`),
  inSheet: boolean("in_sheet").notNull().default(true), // false once a row disappears from the sheet
  sheetSyncedAt: timestamp("sheet_synced_at", { withTimezone: true }),
});

// ---------- Brand-site catalog (written by the crawler import, lib/sync/catalog.ts) ----------

/** One row per brand: the latest crawl of the brand's own website and its brand image (logo/hero). */
export const brandCrawls = pgTable("brand_crawls", {
  brandId: uuid("brand_id").primaryKey().references(() => brands.id, { onDelete: "cascade" }),
  website: text("website"),
  crawledAt: timestamp("crawled_at", { withTimezone: true }).notNull(),
  status: text("status").notNull(), // ok | no_website | robots_disallowed | unreachable | no_catalog_found | blocked_by_site
  platform: text("platform"), // shopify | woocommerce | html
  brandImageUrl: text("brand_image_url"),
  brandImageStoredUrl: text("brand_image_stored_url"), // copy in Vercel Blob, when mirrored
  brandImageKind: text("brand_image_kind"), // logo | og_image | hero | icon
  brandImageSourcePage: text("brand_image_source_page"),
  brandImageWidth: integer("brand_image_width"),
  brandImageHeight: integer("brand_image_height"),
  attribution: text("attribution"),
  imageRights: text("image_rights").notNull().default("unknown"),
  importedAt: timestamp("imported_at", { withTimezone: true }).notNull().defaultNow(),
});

/** Watches found on a brand's own website. id is "BRD-0001/<slug>". */
export const siteWatches = pgTable("site_watches", {
  id: text("id").primaryKey(),
  brandId: uuid("brand_id").notNull().references(() => brands.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  url: text("url").notNull(),
  priceMinor: integer("price_minor"),
  currency: text("currency"),
  available: boolean("available"),
  specs: jsonb("specs").$type<Record<string, string | number | null>>().notNull().default({}),
  hash: text("hash"),
  position: integer("position").notNull().default(0),
  crawledAt: timestamp("crawled_at", { withTimezone: true }).notNull(),
  // Sold-out tracking (weekly re-check) and everything else on the watch's page.
  availability: text("availability"), // in_stock | sold_out | preorder | unknown
  soldOut: boolean("sold_out"),
  availabilityCheckedAt: timestamp("availability_checked_at", { withTimezone: true }),
  description: text("description"),
  productType: text("product_type"),
  tags: jsonb("tags").$type<string[]>().notNull().default([]),
  options: jsonb("options").$type<{ name: string; values: string[] }[]>().notNull().default([]),
  variants: jsonb("variants").$type<Record<string, unknown>[]>().notNull().default([]),
  specsRaw: jsonb("specs_raw").$type<Record<string, string>>().notNull().default({}),
}, (t) => [index("site_watches_brand").on(t.brandId)]);

/**
 * Availability changes per watch, oldest first. Not tied to site_watches by a foreign key, so the
 * history survives each re-import that replaces a brand's watches.
 */
export const siteWatchAvailabilityEvents = pgTable("site_watch_availability_events", {
  watchId: text("watch_id").notNull(),
  brandId: uuid("brand_id").notNull().references(() => brands.id, { onDelete: "cascade" }),
  at: timestamp("at", { withTimezone: true }).notNull(),
  availability: text("availability").notNull(),
}, (t) => [primaryKey({ columns: [t.watchId, t.at] }), index("site_watch_availability_brand").on(t.brandId)]);

/** Images for a watch, in the brand site's order. Position 0 is the main image. */
export const siteWatchImages = pgTable("site_watch_images", {
  watchId: text("watch_id").notNull().references(() => siteWatches.id, { onDelete: "cascade" }),
  position: integer("position").notNull(),
  url: text("url").notNull(),
  storedUrl: text("stored_url"), // copy in Vercel Blob, when mirrored
  width: integer("width"),
  height: integer("height"),
}, (t) => [primaryKey({ columns: [t.watchId, t.position] })]);

/** Collections (model families, series, categories) found on a brand's own website. id is "BRD-0001/<slug>". */
export const siteCollections = pgTable("site_collections", {
  id: text("id").primaryKey(),
  brandId: uuid("brand_id").notNull().references(() => brands.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  url: text("url"),
  description: text("description"),
  imageUrl: text("image_url"),
  imageStoredUrl: text("image_stored_url"),
  position: integer("position").notNull().default(0),
  crawledAt: timestamp("crawled_at", { withTimezone: true }).notNull(),
}, (t) => [index("site_collections_brand").on(t.brandId)]);

/** Which collections a watch belongs to. Optional: a watch can belong to none, one or several. */
export const siteWatchCollections = pgTable("site_watch_collections", {
  watchId: text("watch_id").notNull().references(() => siteWatches.id, { onDelete: "cascade" }),
  collectionId: text("collection_id").notNull().references(() => siteCollections.id, { onDelete: "cascade" }),
}, (t) => [primaryKey({ columns: [t.watchId, t.collectionId] }), index("site_watch_collections_collection").on(t.collectionId)]);

/** One row per sync run (sheet or catalog), for troubleshooting. */
export const dataSyncs = pgTable("data_syncs", {
  id: id(),
  kind: text("kind").notNull(), // sheet | catalog
  startedAt: timestamp("started_at", { withTimezone: true }).notNull().defaultNow(),
  finishedAt: timestamp("finished_at", { withTimezone: true }),
  status: text("status").notNull(), // running | ok | error
  counts: jsonb("counts"),
  error: text("error"),
});

export const collections = pgTable("collections", {
  id: id(), ...stamps,
  brandId: uuid("brand_id").notNull().references(() => brands.id, { onDelete: "cascade" }),
  slug: text("slug").notNull(),
  name: jsonb("name").$type<L10n>().notNull(),
  description: jsonb("description").$type<L10n>(),
  sort: integer("sort").notNull().default(0),
}, (t) => [uniqueIndex("collections_brand_slug").on(t.brandId, t.slug)]);

export const calibers = pgTable("calibers", {
  id: id(), ...stamps,
  name: text("name").notNull().unique(),
  aliases: text("aliases").array().notNull().default(sql`'{}'`),
  maker: text("maker"),
  baseCaliber: text("base_caliber"),
  country: text("country"),
  jewels: integer("jewels"),
  frequencyBph: integer("frequency_bph"),
  powerReserveH: integer("power_reserve_h"),
  hacking: boolean("hacking"),
  handWinding: boolean("hand_winding"),
  functions: text("functions").array(),
});

export const models = pgTable("models", {
  id: id(), ...stamps,
  brandId: uuid("brand_id").notNull().references(() => brands.id, { onDelete: "cascade" }),
  collectionId: uuid("collection_id").references(() => collections.id),
  slug: text("slug").notNull(),
  name: text("name").notNull(),
  reference: text("reference"),
  description: jsonb("description").$type<L10n>(),
  releaseDate: date("release_date"),
  status: modelStatus("status").notNull().default("in_production"),
  limitedEdition: boolean("limited_edition").notNull().default(false),
  editionSize: integer("edition_size"),
  style: style("style").array().notNull().default(sql`'{}'`),
  sourceUrl: text("source_url"),
  published: boolean("published").notNull().default(false),
}, (t) => [uniqueIndex("models_brand_slug").on(t.brandId, t.slug)]);

export const variants = pgTable("variants", {
  id: id(), ...stamps,
  modelId: uuid("model_id").notNull().references(() => models.id, { onDelete: "cascade" }),
  sku: text("sku"),
  shopifyVariantId: text("shopify_variant_id"),
  title: text("title").notNull(),
  price: integer("price").notNull(),
  currency: text("currency").notNull(),
  compareAtPrice: integer("compare_at_price"),
  available: boolean("available").notNull().default(true),
  inventoryPolicy: text("inventory_policy"),
  preorder: boolean("preorder").notNull().default(false),
  shipEstimate: text("ship_estimate"),
  dialColor: dialColor("dial_color"),
  strapType: strapType("strap_type"),
  url: text("url"),
  sort: integer("sort").notNull().default(0),
}, (t) => [index("variants_model").on(t.modelId)]);

// One row per model; variant_specs (same columns, all nullable) overrides per SKU.
const specColumns = () => ({
  caseDiameterMm: numeric("case_diameter_mm", { precision: 4, scale: 1 }),
  lugToLugMm: numeric("lug_to_lug_mm", { precision: 4, scale: 1 }),
  thicknessMm: numeric("thickness_mm", { precision: 4, scale: 1 }),
  thicknessInclCrystalMm: numeric("thickness_incl_crystal_mm", { precision: 4, scale: 1 }),
  lugWidthMm: numeric("lug_width_mm", { precision: 4, scale: 1 }),
  weightHeadG: integer("weight_head_g"),
  weightTotalG: integer("weight_total_g"),
  caseMaterial: caseMaterial("case_material"),
  caseFinish: caseFinish("case_finish").array(),
  caseCoating: caseCoating("case_coating"),
  caseShape: caseShape("case_shape"),
  crownType: crownType("crown_type"),
  crownPosition: crownPosition("crown_position"),
  crownGuards: boolean("crown_guards"),
  bezelType: bezelType("bezel_type"),
  bezelInsertMaterial: bezelInsert("bezel_insert_material"),
  bezelLumePip: boolean("bezel_lume_pip"),
  crystalMaterial: crystalMaterial("crystal_material"),
  crystalShape: crystalShape("crystal_shape"),
  arCoating: arCoating("ar_coating"),
  caseback: caseback("caseback"),
  waterResistanceM: integer("water_resistance_m"),
  iso6425: boolean("iso6425"),
  heliumValve: boolean("helium_valve"),
  movementType: movementType("movement_type"),
  caliberId: uuid("caliber_id").references(() => calibers.id),
  inHouse: boolean("in_house"),
  regulation: text("regulation"),
  accuracySpec: text("accuracy_spec"),
  complications: complication("complications").array(),
  dialColor: dialColor("dial_color"),
  dialTexture: dialTexture("dial_texture"),
  indices: indices("indices"),
  handStyle: text("hand_style"),
  datePosition: text("date_position"),
  dateColorMatched: boolean("date_color_matched"),
  lumeType: lumeType("lume_type"),
  lumeColor: text("lume_color"),
  lumeLocations: text("lume_locations").array(),
  strapType: strapType("strap_type"),
  braceletLink: braceletLink("bracelet_link"),
  endlinks: endlinks("endlinks"),
  taperMm: text("taper_mm"),
  clasp: clasp("clasp"),
  quickRelease: boolean("quick_release"),
  extraStraps: text("extra_straps"),
  assemblyCountry: text("assembly_country"),
  originClaim: text("origin_claim"),
  warrantyYears: integer("warranty_years"),
});

export const specs = pgTable("specs", {
  id: id(), ...stamps,
  modelId: uuid("model_id").notNull().unique().references(() => models.id, { onDelete: "cascade" }),
  ...specColumns(),
  specSources: jsonb("spec_sources").$type<Record<string, "imported" | "brand" | "editor">>().notNull().default({}),
  brandConfirmedAt: timestamp("brand_confirmed_at", { withTimezone: true }),
});

export const variantSpecs = pgTable("variant_specs", {
  id: id(), ...stamps,
  variantId: uuid("variant_id").notNull().unique().references(() => variants.id, { onDelete: "cascade" }),
  ...specColumns(),
});

export const media = pgTable("media", {
  id: id(), ...stamps,
  ownerType: mediaOwner("owner_type").notNull(),
  ownerId: uuid("owner_id").notNull(),
  kind: mediaKind("kind").notNull(),
  sourceUrl: text("source_url"),
  storageKey: text("storage_key"),
  width: integer("width"),
  height: integer("height"),
  alt: jsonb("alt").$type<L10n>(),
  credit: text("credit"),
  // Public queries must filter rights in ('licensed','own') (doc 06).
  rights: mediaRights("rights").notNull().default("unknown"),
  sort: integer("sort").notNull().default(0),
}, (t) => [index("media_owner").on(t.ownerType, t.ownerId)]);

export const videoSeries = pgTable("video_series", { id: id(), ...stamps, slug: text("slug").notNull().unique(), name: jsonb("name").$type<L10n>().notNull() });

export const videos = pgTable("videos", {
  id: id(), ...stamps,
  platform: videoPlatform("platform").notNull(),
  externalId: text("external_id").notNull(),
  url: text("url").notNull(),
  seriesId: uuid("series_id").references(() => videoSeries.id),
  title: jsonb("title").$type<L10n>().notNull(),
  description: jsonb("description").$type<L10n>(),
  thumbnailMediaId: uuid("thumbnail_media_id"),
  durationS: integer("duration_s"),
  publishedAt: timestamp("published_at", { withTimezone: true }),
  status: publishStatus("status").notNull().default("draft"),
});

export const videoLinks = pgTable("video_links", {
  id: id(), ...stamps,
  videoId: uuid("video_id").notNull().references(() => videos.id, { onDelete: "cascade" }),
  brandId: uuid("brand_id").references(() => brands.id),
  modelId: uuid("model_id").references(() => models.id),
  timestampS: integer("timestamp_s"),
  note: jsonb("note").$type<L10n>(),
});

export const articles = pgTable("articles", {
  id: id(), ...stamps,
  slug: text("slug").notNull().unique(),
  title: jsonb("title").$type<L10n>().notNull(),
  dek: jsonb("dek").$type<L10n>(),
  body: jsonb("body").notNull(), // blocks incl. model_card, video_card
  type: articleType("type").notNull(),
  author: text("author"),
  publishedAt: timestamp("published_at", { withTimezone: true }),
  status: publishStatus("status").notNull().default("draft"),
});
export const articleModels = pgTable("article_models", { articleId: uuid("article_id").notNull().references(() => articles.id), modelId: uuid("model_id").notNull().references(() => models.id) });
export const articleBrands = pgTable("article_brands", { articleId: uuid("article_id").notNull().references(() => articles.id), brandId: uuid("brand_id").notNull().references(() => brands.id) });

export const users = pgTable("users", {
  id: id(), ...stamps,
  email: text("email").notNull().unique(),
  role: userRole("role").notNull(),
  brandId: uuid("brand_id").references(() => brands.id),
});

export const claims = pgTable("claims", {
  id: id(), ...stamps,
  brandId: uuid("brand_id").notNull().references(() => brands.id),
  email: text("email").notNull(),
  method: claimMethod("method").notNull(),
  token: text("token").notNull().unique(),
  status: claimState("status").notNull().default("pending"),
  verifiedAt: timestamp("verified_at", { withTimezone: true }),
});

export const imageLicenses = pgTable("image_licenses", {
  id: id(), ...stamps,
  brandId: uuid("brand_id").notNull().references(() => brands.id),
  version: text("version").notNull(),
  acceptedByUserId: uuid("accepted_by_user_id").notNull().references(() => users.id),
  acceptedAt: timestamp("accepted_at", { withTimezone: true }).notNull(),
  ip: text("ip"),
  revokedAt: timestamp("revoked_at", { withTimezone: true }),
});

export const syncRuns = pgTable("sync_runs", {
  id: id(), ...stamps,
  brandId: uuid("brand_id").notNull().references(() => brands.id),
  startedAt: timestamp("started_at", { withTimezone: true }).notNull(),
  finishedAt: timestamp("finished_at", { withTimezone: true }),
  status: text("status").notNull(),
  counts: jsonb("counts"),
  error: text("error"),
});

export const rawProducts = pgTable("raw_products", {
  id: id(), ...stamps,
  brandId: uuid("brand_id").notNull().references(() => brands.id),
  shopifyProductId: text("shopify_product_id").notNull(),
  payload: jsonb("payload").notNull(),
  hash: text("hash").notNull(),
  fetchedAt: timestamp("fetched_at", { withTimezone: true }).notNull(),
}, (t) => [uniqueIndex("raw_products_brand_product").on(t.brandId, t.shopifyProductId)]);

export const changeQueue = pgTable("change_queue", {
  id: id(), ...stamps,
  entity: text("entity").notNull(),
  entityId: uuid("entity_id").notNull(),
  field: text("field").notNull(),
  old: jsonb("old"),
  new: jsonb("new"),
  source: text("source").notNull(),
  confidence: doublePrecision("confidence"),
  status: reviewState("status").notNull().default("pending"),
});

export const overrides = pgTable("overrides", {
  id: id(), ...stamps,
  entity: text("entity").notNull(),
  entityId: uuid("entity_id").notNull(),
  field: text("field").notNull(),
  value: jsonb("value"),
  locked: boolean("locked").notNull().default(false), // sync never overwrites locked fields
}, (t) => [uniqueIndex("overrides_target").on(t.entity, t.entityId, t.field)]);

export const outboundClicks = pgTable("outbound_clicks", {
  id: id(),
  variantId: uuid("variant_id"),
  modelId: uuid("model_id"),
  brandId: uuid("brand_id"),
  page: text("page"),
  sessionId: text("session_id"),
  affiliate: boolean("affiliate").notNull().default(false),
  ts: timestamp("ts", { withTimezone: true }).notNull().defaultNow(),
});

export const fxRates = pgTable("fx_rates", {
  id: id(),
  date: date("date").notNull(),
  base: text("base").notNull(),
  quote: text("quote").notNull(),
  rate: doublePrecision("rate").notNull(),
}, (t) => [uniqueIndex("fx_rates_day").on(t.date, t.base, t.quote)]);

export const auditLog = pgTable("audit_log", {
  id: id(),
  userId: uuid("user_id"),
  action: text("action").notNull(),
  entity: text("entity").notNull(),
  entityId: uuid("entity_id"),
  diff: jsonb("diff"),
  ts: timestamp("ts", { withTimezone: true }).notNull().defaultNow(),
});

// ---------- Read model for the site (lib/catalog/index-build.ts writes it, lib/site-data.ts reads it) ----------
// One row per published brand and per published watch, holding exactly what pages list, filter and
// sort on, so each page asks the database for only the rows and fields it shows. Rebuilt per brand
// whenever that brand's sheet row or crawl changes. Image visibility is decided when reading, from
// image_license and the site's IMAGES_PUBLIC setting.

export const catalogBrands = pgTable("catalog_brands", {
  slug: text("slug").primaryKey(),
  brandCode: text("brand_code").notNull().unique(),
  name: text("name").notNull(),
  ord: integer("ord").notNull(), // A–Z position
  letter: text("letter").notNull(), // A–Z index letter, or "#"
  country: text("country"),
  city: text("city"),
  priceBand: text("price_band"),
  styleTags: text("style_tags").array().notNull().default(sql`'{}'`),
  words: text("words").array().notNull().default(sql`'{}'`), // search words: name, city, style tags
  imageLicense: text("image_license").notNull(),
  logoUrl: text("logo_url"),
  hasStory: boolean("has_story").notNull().default(false),
  modelCount: integer("model_count").notNull().default(0),
  photoCount: integer("photo_count").notNull().default(0),
  data: jsonb("data").$type<unknown>().notNull(), // Brand
  inputsHash: text("inputs_hash").notNull(),
  refreshedAt: timestamp("refreshed_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [index("catalog_brands_ord").on(t.ord)]);

export const catalogWatches = pgTable("catalog_watches", {
  id: text("id").primaryKey(), // brandSlug~modelSlug
  brandSlug: text("brand_slug").notNull(),
  brandCode: text("brand_code").notNull(),
  slug: text("slug").notNull(),
  ord: integer("ord").notNull(), // position in the brand's catalog
  origin: text("origin").notNull(), // seed | site
  name: text("name").notNull(),
  imageLicense: text("image_license").notNull(),
  hasImage: boolean("has_image").notNull(),
  inStock: boolean("in_stock").notNull(), // availability is not sold_out
  importedAt: timestamp("imported_at", { withTimezone: true }),
  minPrice: integer("min_price").notNull(), // USD minor units
  dia: doublePrecision("dia"),
  l2l: doublePrecision("l2l"),
  thk: doublePrecision("thk"),
  wr: integer("wr"),
  movement: text("movement"),
  caliber: text("caliber"),
  styles: text("styles").array().notNull().default(sql`'{}'`),
  // Facet values, as lib/filters.ts reads them off a model.
  fMov: text("f_mov").array().notNull().default(sql`'{}'`),
  fStyle: text("f_style").array().notNull().default(sql`'{}'`),
  fDial: text("f_dial").array().notNull().default(sql`'{}'`),
  fStrap: text("f_strap").array().notNull().default(sql`'{}'`),
  fAvail: text("f_avail").array().notNull().default(sql`'{}'`),
  fCal: text("f_cal").array().notNull().default(sql`'{}'`),
  fCrystal: text("f_crystal").array().notNull().default(sql`'{}'`),
  fMat: text("f_mat").array().notNull().default(sql`'{}'`),
  fLug: text("f_lug").array().notNull().default(sql`'{}'`),
  fComp: text("f_comp").array().notNull().default(sql`'{}'`),
  fCountry: text("f_country").array().notNull().default(sql`'{}'`),
  /** Every facet value above as "facet:value", so facet counts need one unnest per watch. */
  tags: text("tags").array().notNull().default(sql`'{}'`),
  // Text search, weight 5 (name) down to 1: words for exact and typo matches, raw text for substrings.
  w5: text("w5").array().notNull().default(sql`'{}'`),
  w4: text("w4").array().notNull().default(sql`'{}'`),
  w3: text("w3").array().notNull().default(sql`'{}'`),
  w2: text("w2").array().notNull().default(sql`'{}'`),
  w1: text("w1").array().notNull().default(sql`'{}'`),
  r5: text("r5").notNull().default(""),
  r4: text("r4").notNull().default(""),
  r3: text("r3").notNull().default(""),
  r2: text("r2").notNull().default(""),
  r1: text("r1").notNull().default(""),
  variantIds: text("variant_ids").array().notNull().default(sql`'{}'`),
  card: jsonb("card").$type<unknown>().notNull(), // Model, trimmed to what a card shows
  detail: jsonb("detail").$type<unknown>().notNull(), // Model, everything the watch page shows
}, (t) => [
  index("catalog_watches_brand").on(t.brandSlug, t.ord),
  index("catalog_watches_code").on(t.brandCode),
  index("catalog_watches_variants").using("gin", t.variantIds),
]);

/** Small key/value table; holds the read model's format version. */
export const catalogMeta = pgTable("catalog_meta", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
});
