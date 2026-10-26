CREATE TABLE "catalog_brands" (
	"slug" text PRIMARY KEY NOT NULL,
	"brand_code" text NOT NULL,
	"name" text NOT NULL,
	"ord" integer NOT NULL,
	"letter" text NOT NULL,
	"country" text,
	"city" text,
	"price_band" text,
	"style_tags" text[] DEFAULT '{}' NOT NULL,
	"words" text[] DEFAULT '{}' NOT NULL,
	"image_license" text NOT NULL,
	"logo_url" text,
	"has_story" boolean DEFAULT false NOT NULL,
	"model_count" integer DEFAULT 0 NOT NULL,
	"photo_count" integer DEFAULT 0 NOT NULL,
	"data" jsonb NOT NULL,
	"inputs_hash" text NOT NULL,
	"refreshed_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "catalog_brands_brand_code_unique" UNIQUE("brand_code")
);
--> statement-breakpoint
CREATE TABLE "catalog_meta" (
	"key" text PRIMARY KEY NOT NULL,
	"value" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "catalog_watches" (
	"id" text PRIMARY KEY NOT NULL,
	"brand_slug" text NOT NULL,
	"brand_code" text NOT NULL,
	"slug" text NOT NULL,
	"ord" integer NOT NULL,
	"origin" text NOT NULL,
	"name" text NOT NULL,
	"image_license" text NOT NULL,
	"has_image" boolean NOT NULL,
	"in_stock" boolean NOT NULL,
	"imported_at" timestamp with time zone,
	"min_price" integer NOT NULL,
	"dia" double precision,
	"l2l" double precision,
	"thk" double precision,
	"wr" integer,
	"movement" text,
	"caliber" text,
	"styles" text[] DEFAULT '{}' NOT NULL,
	"f_mov" text[] DEFAULT '{}' NOT NULL,
	"f_style" text[] DEFAULT '{}' NOT NULL,
	"f_dial" text[] DEFAULT '{}' NOT NULL,
	"f_strap" text[] DEFAULT '{}' NOT NULL,
	"f_avail" text[] DEFAULT '{}' NOT NULL,
	"f_cal" text[] DEFAULT '{}' NOT NULL,
	"f_crystal" text[] DEFAULT '{}' NOT NULL,
	"f_mat" text[] DEFAULT '{}' NOT NULL,
	"f_lug" text[] DEFAULT '{}' NOT NULL,
	"f_comp" text[] DEFAULT '{}' NOT NULL,
	"f_country" text[] DEFAULT '{}' NOT NULL,
	"w5" text[] DEFAULT '{}' NOT NULL,
	"w4" text[] DEFAULT '{}' NOT NULL,
	"w3" text[] DEFAULT '{}' NOT NULL,
	"w2" text[] DEFAULT '{}' NOT NULL,
	"w1" text[] DEFAULT '{}' NOT NULL,
	"r5" text DEFAULT '' NOT NULL,
	"r4" text DEFAULT '' NOT NULL,
	"r3" text DEFAULT '' NOT NULL,
	"r2" text DEFAULT '' NOT NULL,
	"r1" text DEFAULT '' NOT NULL,
	"variant_ids" text[] DEFAULT '{}' NOT NULL,
	"card" jsonb NOT NULL,
	"detail" jsonb NOT NULL
);
--> statement-breakpoint
CREATE INDEX "catalog_brands_ord" ON "catalog_brands" USING btree ("ord");--> statement-breakpoint
CREATE INDEX "catalog_watches_brand" ON "catalog_watches" USING btree ("brand_slug","ord");--> statement-breakpoint
CREATE INDEX "catalog_watches_code" ON "catalog_watches" USING btree ("brand_code");--> statement-breakpoint
CREATE INDEX "catalog_watches_variants" ON "catalog_watches" USING gin ("variant_ids");