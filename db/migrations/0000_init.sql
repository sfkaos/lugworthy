CREATE TYPE "public"."ar_coating" AS ENUM('none', 'inner', 'outer', 'both');--> statement-breakpoint
CREATE TYPE "public"."article_type" AS ENUM('guide', 'roundup', 'fair', 'interview');--> statement-breakpoint
CREATE TYPE "public"."bezel_insert" AS ENUM('ceramic', 'aluminium', 'sapphire', 'steel', 'bakelite', 'other');--> statement-breakpoint
CREATE TYPE "public"."bezel_type" AS ENUM('fixed', 'unidirectional_60', 'unidirectional_120', 'bidirectional', 'gmt_24h', '12h', 'countdown', 'internal_rotating', 'none');--> statement-breakpoint
CREATE TYPE "public"."bracelet_link" AS ENUM('oyster', 'jubilee', 'beads_of_rice', 'integrated', 'president', 'h_link', 'other');--> statement-breakpoint
CREATE TYPE "public"."brand_class" AS ENUM('microbrand', 'legacy_micro', 'independent');--> statement-breakpoint
CREATE TYPE "public"."case_coating" AS ENUM('none', 'dlc', 'pvd', 'ip');--> statement-breakpoint
CREATE TYPE "public"."case_finish" AS ENUM('brushed', 'polished', 'bead_blasted', 'mixed');--> statement-breakpoint
CREATE TYPE "public"."case_material" AS ENUM('steel_316l', 'steel_904l', 'titanium_gr2', 'titanium_gr5', 'bronze', 'brass', 'ceramic', 'carbon', 'aluminium', 'gold', 'silver', 'other');--> statement-breakpoint
CREATE TYPE "public"."case_shape" AS ENUM('round', 'cushion', 'tonneau', 'square', 'rectangular', 'other');--> statement-breakpoint
CREATE TYPE "public"."caseback" AS ENUM('solid', 'exhibition', 'screwdown_solid', 'screwdown_exhibition');--> statement-breakpoint
CREATE TYPE "public"."claim_method" AS ENUM('domain_email', 'meta_tag', 'dns_txt', 'manual');--> statement-breakpoint
CREATE TYPE "public"."claim_state" AS ENUM('pending', 'verified', 'rejected', 'expired');--> statement-breakpoint
CREATE TYPE "public"."claim_status" AS ENUM('unclaimed', 'pending', 'claimed');--> statement-breakpoint
CREATE TYPE "public"."clasp" AS ENUM('micro_adjust', 'on_the_fly', 'tool_free', 'deployant', 'buckle', 'butterfly');--> statement-breakpoint
CREATE TYPE "public"."complication" AS ENUM('date', 'day_date', 'gmt', 'world_time', 'chronograph', 'flyback', 'moonphase', 'power_reserve', 'small_seconds', 'alarm', 'annual_calendar', 'regulator', 'none');--> statement-breakpoint
CREATE TYPE "public"."crown_position" AS ENUM('3', '4', '2', '9', 'other');--> statement-breakpoint
CREATE TYPE "public"."crown_type" AS ENUM('screw_down', 'push_pull');--> statement-breakpoint
CREATE TYPE "public"."crystal_material" AS ENUM('sapphire', 'mineral', 'hesalite_acrylic', 'other');--> statement-breakpoint
CREATE TYPE "public"."crystal_shape" AS ENUM('flat', 'domed', 'double_domed', 'box');--> statement-breakpoint
CREATE TYPE "public"."dial_color" AS ENUM('black', 'white', 'silver', 'grey', 'blue', 'green', 'red', 'orange', 'yellow', 'brown', 'cream', 'salmon', 'purple', 'pink', 'teal', 'multi', 'skeleton');--> statement-breakpoint
CREATE TYPE "public"."dial_texture" AS ENUM('sunburst', 'matte', 'gloss', 'enamel', 'stone', 'guilloche', 'textured', 'fume', 'sandwich', 'meteorite', 'mother_of_pearl');--> statement-breakpoint
CREATE TYPE "public"."endlinks" AS ENUM('solid', 'folded', 'integrated', 'none');--> statement-breakpoint
CREATE TYPE "public"."indices" AS ENUM('applied', 'printed', 'numerals_applied', 'numerals_printed', 'mixed');--> statement-breakpoint
CREATE TYPE "public"."license_status" AS ENUM('none', 'granted', 'revoked');--> statement-breakpoint
CREATE TYPE "public"."lume_type" AS ENUM('super_luminova_bgw9', 'c3', 'c1', 'x1', 'old_radium', 'tritium_tubes', 'none', 'other');--> statement-breakpoint
CREATE TYPE "public"."media_kind" AS ENUM('product_front', 'product_side', 'product_back', 'wrist', 'lifestyle', '360', 'banner', 'logo', 'detail');--> statement-breakpoint
CREATE TYPE "public"."media_owner" AS ENUM('brand', 'model', 'variant', 'article');--> statement-breakpoint
CREATE TYPE "public"."media_rights" AS ENUM('unknown', 'licensed', 'own', 'revoked');--> statement-breakpoint
CREATE TYPE "public"."model_status" AS ENUM('in_production', 'preorder', 'crowdfunding', 'discontinued', 'sold_out', 'announced');--> statement-breakpoint
CREATE TYPE "public"."movement_type" AS ENUM('automatic', 'hand_wound', 'quartz', 'mecaquartz', 'solar', 'kinetic', 'spring_drive', 'smart_hybrid');--> statement-breakpoint
CREATE TYPE "public"."platform" AS ENUM('shopify', 'woocommerce', 'bigcommerce', 'squarespace', 'other');--> statement-breakpoint
CREATE TYPE "public"."publish_status" AS ENUM('draft', 'published', 'hidden');--> statement-breakpoint
CREATE TYPE "public"."review_state" AS ENUM('pending', 'approved', 'rejected');--> statement-breakpoint
CREATE TYPE "public"."strap_type" AS ENUM('bracelet', 'rubber', 'fkm', 'silicone', 'leather', 'nato', 'canvas', 'mesh', 'sailcloth', 'other');--> statement-breakpoint
CREATE TYPE "public"."style" AS ENUM('diver', 'field', 'pilot', 'gmt', 'chronograph', 'dress', 'racing', 'skin_diver', 'integrated_bracelet', 'tool', 'digital', 'other');--> statement-breakpoint
CREATE TYPE "public"."user_role" AS ENUM('admin', 'editor', 'brand');--> statement-breakpoint
CREATE TYPE "public"."video_platform" AS ENUM('youtube', 'instagram', 'tiktok');--> statement-breakpoint
CREATE TABLE "article_brands" (
	"article_id" uuid NOT NULL,
	"brand_id" uuid NOT NULL
);
--> statement-breakpoint
CREATE TABLE "article_models" (
	"article_id" uuid NOT NULL,
	"model_id" uuid NOT NULL
);
--> statement-breakpoint
CREATE TABLE "articles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"slug" text NOT NULL,
	"title" jsonb NOT NULL,
	"dek" jsonb,
	"body" jsonb NOT NULL,
	"type" "article_type" NOT NULL,
	"author" text,
	"published_at" timestamp with time zone,
	"status" "publish_status" DEFAULT 'draft' NOT NULL,
	CONSTRAINT "articles_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "audit_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid,
	"action" text NOT NULL,
	"entity" text NOT NULL,
	"entity_id" uuid,
	"diff" jsonb,
	"ts" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "brand_crawls" (
	"brand_id" uuid PRIMARY KEY NOT NULL,
	"website" text,
	"crawled_at" timestamp with time zone NOT NULL,
	"status" text NOT NULL,
	"platform" text,
	"brand_image_url" text,
	"brand_image_stored_url" text,
	"brand_image_kind" text,
	"brand_image_source_page" text,
	"brand_image_width" integer,
	"brand_image_height" integer,
	"attribution" text,
	"image_rights" text DEFAULT 'unknown' NOT NULL,
	"imported_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "brands" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"brand_code" text,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"legal_name" text,
	"website_url" text,
	"shopify_domain" text,
	"platform" "platform",
	"country" text,
	"city" text,
	"founded_year" integer,
	"story" jsonb,
	"tagline" jsonb,
	"logo_media_id" uuid,
	"logo_dark_media_id" uuid,
	"banner_media_id" uuid,
	"banner_focal_x" double precision,
	"banner_focal_y" double precision,
	"color_primary" text,
	"color_secondary" text,
	"price_min" integer,
	"price_max" integer,
	"currency" text DEFAULT 'USD' NOT NULL,
	"socials" jsonb,
	"style_tags" text[] DEFAULT '{}' NOT NULL,
	"is_microbrand_class" "brand_class" DEFAULT 'microbrand' NOT NULL,
	"en_punto_exhibitor" boolean DEFAULT false NOT NULL,
	"en_punto_editions" text[] DEFAULT '{}' NOT NULL,
	"status" "publish_status" DEFAULT 'draft' NOT NULL,
	"claim_status" "claim_status" DEFAULT 'unclaimed' NOT NULL,
	"image_license_status" "license_status" DEFAULT 'none' NOT NULL,
	"affiliate_program" jsonb,
	"ships_to" text[] DEFAULT '{}' NOT NULL,
	"last_synced_at" timestamp with time zone,
	"country_label" text,
	"price_band" text,
	"ownership" text,
	"lugworthy_fit" text,
	"site_check" text,
	"facts" jsonb,
	"sources" text[] DEFAULT '{}' NOT NULL,
	"in_sheet" boolean DEFAULT true NOT NULL,
	"sheet_synced_at" timestamp with time zone,
	CONSTRAINT "brands_brand_code_unique" UNIQUE("brand_code"),
	CONSTRAINT "brands_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "calibers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"name" text NOT NULL,
	"aliases" text[] DEFAULT '{}' NOT NULL,
	"maker" text,
	"base_caliber" text,
	"country" text,
	"jewels" integer,
	"frequency_bph" integer,
	"power_reserve_h" integer,
	"hacking" boolean,
	"hand_winding" boolean,
	"functions" text[],
	CONSTRAINT "calibers_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "change_queue" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"entity" text NOT NULL,
	"entity_id" uuid NOT NULL,
	"field" text NOT NULL,
	"old" jsonb,
	"new" jsonb,
	"source" text NOT NULL,
	"confidence" double precision,
	"status" "review_state" DEFAULT 'pending' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "claims" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"brand_id" uuid NOT NULL,
	"email" text NOT NULL,
	"method" "claim_method" NOT NULL,
	"token" text NOT NULL,
	"status" "claim_state" DEFAULT 'pending' NOT NULL,
	"verified_at" timestamp with time zone,
	CONSTRAINT "claims_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "collections" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"brand_id" uuid NOT NULL,
	"slug" text NOT NULL,
	"name" jsonb NOT NULL,
	"description" jsonb,
	"sort" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "data_syncs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"kind" text NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"finished_at" timestamp with time zone,
	"status" text NOT NULL,
	"counts" jsonb,
	"error" text
);
--> statement-breakpoint
CREATE TABLE "fx_rates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"date" date NOT NULL,
	"base" text NOT NULL,
	"quote" text NOT NULL,
	"rate" double precision NOT NULL
);
--> statement-breakpoint
CREATE TABLE "image_licenses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"brand_id" uuid NOT NULL,
	"version" text NOT NULL,
	"accepted_by_user_id" uuid NOT NULL,
	"accepted_at" timestamp with time zone NOT NULL,
	"ip" text,
	"revoked_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "media" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"owner_type" "media_owner" NOT NULL,
	"owner_id" uuid NOT NULL,
	"kind" "media_kind" NOT NULL,
	"source_url" text,
	"storage_key" text,
	"width" integer,
	"height" integer,
	"alt" jsonb,
	"credit" text,
	"rights" "media_rights" DEFAULT 'unknown' NOT NULL,
	"sort" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "models" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"brand_id" uuid NOT NULL,
	"collection_id" uuid,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"reference" text,
	"description" jsonb,
	"release_date" date,
	"status" "model_status" DEFAULT 'in_production' NOT NULL,
	"limited_edition" boolean DEFAULT false NOT NULL,
	"edition_size" integer,
	"style" "style"[] DEFAULT '{}' NOT NULL,
	"source_url" text,
	"published" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "outbound_clicks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"variant_id" uuid,
	"model_id" uuid,
	"brand_id" uuid,
	"page" text,
	"session_id" text,
	"affiliate" boolean DEFAULT false NOT NULL,
	"ts" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "overrides" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"entity" text NOT NULL,
	"entity_id" uuid NOT NULL,
	"field" text NOT NULL,
	"value" jsonb,
	"locked" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "raw_products" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"brand_id" uuid NOT NULL,
	"shopify_product_id" text NOT NULL,
	"payload" jsonb NOT NULL,
	"hash" text NOT NULL,
	"fetched_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "site_watch_images" (
	"watch_id" text NOT NULL,
	"position" integer NOT NULL,
	"url" text NOT NULL,
	"stored_url" text,
	"width" integer,
	"height" integer,
	CONSTRAINT "site_watch_images_watch_id_position_pk" PRIMARY KEY("watch_id","position")
);
--> statement-breakpoint
CREATE TABLE "site_watches" (
	"id" text PRIMARY KEY NOT NULL,
	"brand_id" uuid NOT NULL,
	"name" text NOT NULL,
	"url" text NOT NULL,
	"price_minor" integer,
	"currency" text,
	"available" boolean,
	"specs" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"hash" text,
	"position" integer DEFAULT 0 NOT NULL,
	"crawled_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "specs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"model_id" uuid NOT NULL,
	"case_diameter_mm" numeric(4, 1),
	"lug_to_lug_mm" numeric(4, 1),
	"thickness_mm" numeric(4, 1),
	"thickness_incl_crystal_mm" numeric(4, 1),
	"lug_width_mm" numeric(4, 1),
	"weight_head_g" integer,
	"weight_total_g" integer,
	"case_material" "case_material",
	"case_finish" "case_finish"[],
	"case_coating" "case_coating",
	"case_shape" "case_shape",
	"crown_type" "crown_type",
	"crown_position" "crown_position",
	"crown_guards" boolean,
	"bezel_type" "bezel_type",
	"bezel_insert_material" "bezel_insert",
	"bezel_lume_pip" boolean,
	"crystal_material" "crystal_material",
	"crystal_shape" "crystal_shape",
	"ar_coating" "ar_coating",
	"caseback" "caseback",
	"water_resistance_m" integer,
	"iso6425" boolean,
	"helium_valve" boolean,
	"movement_type" "movement_type",
	"caliber_id" uuid,
	"in_house" boolean,
	"regulation" text,
	"accuracy_spec" text,
	"complications" "complication"[],
	"dial_color" "dial_color",
	"dial_texture" "dial_texture",
	"indices" "indices",
	"hand_style" text,
	"date_position" text,
	"date_color_matched" boolean,
	"lume_type" "lume_type",
	"lume_color" text,
	"lume_locations" text[],
	"strap_type" "strap_type",
	"bracelet_link" "bracelet_link",
	"endlinks" "endlinks",
	"taper_mm" text,
	"clasp" "clasp",
	"quick_release" boolean,
	"extra_straps" text,
	"assembly_country" text,
	"origin_claim" text,
	"warranty_years" integer,
	"spec_sources" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"brand_confirmed_at" timestamp with time zone,
	CONSTRAINT "specs_model_id_unique" UNIQUE("model_id")
);
--> statement-breakpoint
CREATE TABLE "sync_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"brand_id" uuid NOT NULL,
	"started_at" timestamp with time zone NOT NULL,
	"finished_at" timestamp with time zone,
	"status" text NOT NULL,
	"counts" jsonb,
	"error" text
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"email" text NOT NULL,
	"role" "user_role" NOT NULL,
	"brand_id" uuid,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "variant_specs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"variant_id" uuid NOT NULL,
	"case_diameter_mm" numeric(4, 1),
	"lug_to_lug_mm" numeric(4, 1),
	"thickness_mm" numeric(4, 1),
	"thickness_incl_crystal_mm" numeric(4, 1),
	"lug_width_mm" numeric(4, 1),
	"weight_head_g" integer,
	"weight_total_g" integer,
	"case_material" "case_material",
	"case_finish" "case_finish"[],
	"case_coating" "case_coating",
	"case_shape" "case_shape",
	"crown_type" "crown_type",
	"crown_position" "crown_position",
	"crown_guards" boolean,
	"bezel_type" "bezel_type",
	"bezel_insert_material" "bezel_insert",
	"bezel_lume_pip" boolean,
	"crystal_material" "crystal_material",
	"crystal_shape" "crystal_shape",
	"ar_coating" "ar_coating",
	"caseback" "caseback",
	"water_resistance_m" integer,
	"iso6425" boolean,
	"helium_valve" boolean,
	"movement_type" "movement_type",
	"caliber_id" uuid,
	"in_house" boolean,
	"regulation" text,
	"accuracy_spec" text,
	"complications" "complication"[],
	"dial_color" "dial_color",
	"dial_texture" "dial_texture",
	"indices" "indices",
	"hand_style" text,
	"date_position" text,
	"date_color_matched" boolean,
	"lume_type" "lume_type",
	"lume_color" text,
	"lume_locations" text[],
	"strap_type" "strap_type",
	"bracelet_link" "bracelet_link",
	"endlinks" "endlinks",
	"taper_mm" text,
	"clasp" "clasp",
	"quick_release" boolean,
	"extra_straps" text,
	"assembly_country" text,
	"origin_claim" text,
	"warranty_years" integer,
	CONSTRAINT "variant_specs_variant_id_unique" UNIQUE("variant_id")
);
--> statement-breakpoint
CREATE TABLE "variants" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"model_id" uuid NOT NULL,
	"sku" text,
	"shopify_variant_id" text,
	"title" text NOT NULL,
	"price" integer NOT NULL,
	"currency" text NOT NULL,
	"compare_at_price" integer,
	"available" boolean DEFAULT true NOT NULL,
	"inventory_policy" text,
	"preorder" boolean DEFAULT false NOT NULL,
	"ship_estimate" text,
	"dial_color" "dial_color",
	"strap_type" "strap_type",
	"url" text,
	"sort" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "video_links" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"video_id" uuid NOT NULL,
	"brand_id" uuid,
	"model_id" uuid,
	"timestamp_s" integer,
	"note" jsonb
);
--> statement-breakpoint
CREATE TABLE "video_series" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"slug" text NOT NULL,
	"name" jsonb NOT NULL,
	CONSTRAINT "video_series_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "videos" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"platform" "video_platform" NOT NULL,
	"external_id" text NOT NULL,
	"url" text NOT NULL,
	"series_id" uuid,
	"title" jsonb NOT NULL,
	"description" jsonb,
	"thumbnail_media_id" uuid,
	"duration_s" integer,
	"published_at" timestamp with time zone,
	"status" "publish_status" DEFAULT 'draft' NOT NULL
);
--> statement-breakpoint
ALTER TABLE "article_brands" ADD CONSTRAINT "article_brands_article_id_articles_id_fk" FOREIGN KEY ("article_id") REFERENCES "public"."articles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "article_brands" ADD CONSTRAINT "article_brands_brand_id_brands_id_fk" FOREIGN KEY ("brand_id") REFERENCES "public"."brands"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "article_models" ADD CONSTRAINT "article_models_article_id_articles_id_fk" FOREIGN KEY ("article_id") REFERENCES "public"."articles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "article_models" ADD CONSTRAINT "article_models_model_id_models_id_fk" FOREIGN KEY ("model_id") REFERENCES "public"."models"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "brand_crawls" ADD CONSTRAINT "brand_crawls_brand_id_brands_id_fk" FOREIGN KEY ("brand_id") REFERENCES "public"."brands"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "claims" ADD CONSTRAINT "claims_brand_id_brands_id_fk" FOREIGN KEY ("brand_id") REFERENCES "public"."brands"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "collections" ADD CONSTRAINT "collections_brand_id_brands_id_fk" FOREIGN KEY ("brand_id") REFERENCES "public"."brands"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "image_licenses" ADD CONSTRAINT "image_licenses_brand_id_brands_id_fk" FOREIGN KEY ("brand_id") REFERENCES "public"."brands"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "image_licenses" ADD CONSTRAINT "image_licenses_accepted_by_user_id_users_id_fk" FOREIGN KEY ("accepted_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "models" ADD CONSTRAINT "models_brand_id_brands_id_fk" FOREIGN KEY ("brand_id") REFERENCES "public"."brands"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "models" ADD CONSTRAINT "models_collection_id_collections_id_fk" FOREIGN KEY ("collection_id") REFERENCES "public"."collections"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "raw_products" ADD CONSTRAINT "raw_products_brand_id_brands_id_fk" FOREIGN KEY ("brand_id") REFERENCES "public"."brands"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "site_watch_images" ADD CONSTRAINT "site_watch_images_watch_id_site_watches_id_fk" FOREIGN KEY ("watch_id") REFERENCES "public"."site_watches"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "site_watches" ADD CONSTRAINT "site_watches_brand_id_brands_id_fk" FOREIGN KEY ("brand_id") REFERENCES "public"."brands"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "specs" ADD CONSTRAINT "specs_model_id_models_id_fk" FOREIGN KEY ("model_id") REFERENCES "public"."models"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "specs" ADD CONSTRAINT "specs_caliber_id_calibers_id_fk" FOREIGN KEY ("caliber_id") REFERENCES "public"."calibers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sync_runs" ADD CONSTRAINT "sync_runs_brand_id_brands_id_fk" FOREIGN KEY ("brand_id") REFERENCES "public"."brands"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_brand_id_brands_id_fk" FOREIGN KEY ("brand_id") REFERENCES "public"."brands"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "variant_specs" ADD CONSTRAINT "variant_specs_variant_id_variants_id_fk" FOREIGN KEY ("variant_id") REFERENCES "public"."variants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "variant_specs" ADD CONSTRAINT "variant_specs_caliber_id_calibers_id_fk" FOREIGN KEY ("caliber_id") REFERENCES "public"."calibers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "variants" ADD CONSTRAINT "variants_model_id_models_id_fk" FOREIGN KEY ("model_id") REFERENCES "public"."models"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "video_links" ADD CONSTRAINT "video_links_video_id_videos_id_fk" FOREIGN KEY ("video_id") REFERENCES "public"."videos"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "video_links" ADD CONSTRAINT "video_links_brand_id_brands_id_fk" FOREIGN KEY ("brand_id") REFERENCES "public"."brands"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "video_links" ADD CONSTRAINT "video_links_model_id_models_id_fk" FOREIGN KEY ("model_id") REFERENCES "public"."models"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "videos" ADD CONSTRAINT "videos_series_id_video_series_id_fk" FOREIGN KEY ("series_id") REFERENCES "public"."video_series"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "collections_brand_slug" ON "collections" USING btree ("brand_id","slug");--> statement-breakpoint
CREATE UNIQUE INDEX "fx_rates_day" ON "fx_rates" USING btree ("date","base","quote");--> statement-breakpoint
CREATE INDEX "media_owner" ON "media" USING btree ("owner_type","owner_id");--> statement-breakpoint
CREATE UNIQUE INDEX "models_brand_slug" ON "models" USING btree ("brand_id","slug");--> statement-breakpoint
CREATE UNIQUE INDEX "overrides_target" ON "overrides" USING btree ("entity","entity_id","field");--> statement-breakpoint
CREATE UNIQUE INDEX "raw_products_brand_product" ON "raw_products" USING btree ("brand_id","shopify_product_id");--> statement-breakpoint
CREATE INDEX "site_watches_brand" ON "site_watches" USING btree ("brand_id");--> statement-breakpoint
CREATE INDEX "variants_model" ON "variants" USING btree ("model_id");