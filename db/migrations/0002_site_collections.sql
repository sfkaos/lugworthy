CREATE TABLE "site_collections" (
	"id" text PRIMARY KEY NOT NULL,
	"brand_id" uuid NOT NULL,
	"name" text NOT NULL,
	"url" text,
	"description" text,
	"image_url" text,
	"image_stored_url" text,
	"position" integer DEFAULT 0 NOT NULL,
	"crawled_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "site_watch_collections" (
	"watch_id" text NOT NULL,
	"collection_id" text NOT NULL,
	CONSTRAINT "site_watch_collections_watch_id_collection_id_pk" PRIMARY KEY("watch_id","collection_id")
);
--> statement-breakpoint
ALTER TABLE "site_collections" ADD CONSTRAINT "site_collections_brand_id_brands_id_fk" FOREIGN KEY ("brand_id") REFERENCES "public"."brands"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "site_watch_collections" ADD CONSTRAINT "site_watch_collections_watch_id_site_watches_id_fk" FOREIGN KEY ("watch_id") REFERENCES "public"."site_watches"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "site_watch_collections" ADD CONSTRAINT "site_watch_collections_collection_id_site_collections_id_fk" FOREIGN KEY ("collection_id") REFERENCES "public"."site_collections"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "site_collections_brand" ON "site_collections" USING btree ("brand_id");--> statement-breakpoint
CREATE INDEX "site_watch_collections_collection" ON "site_watch_collections" USING btree ("collection_id");