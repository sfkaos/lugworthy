CREATE TABLE "site_watch_availability_events" (
	"watch_id" text NOT NULL,
	"brand_id" uuid NOT NULL,
	"at" timestamp with time zone NOT NULL,
	"availability" text NOT NULL,
	CONSTRAINT "site_watch_availability_events_watch_id_at_pk" PRIMARY KEY("watch_id","at")
);
--> statement-breakpoint
ALTER TABLE "site_watches" ADD COLUMN "availability" text;--> statement-breakpoint
ALTER TABLE "site_watches" ADD COLUMN "sold_out" boolean;--> statement-breakpoint
ALTER TABLE "site_watches" ADD COLUMN "availability_checked_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "site_watches" ADD COLUMN "description" text;--> statement-breakpoint
ALTER TABLE "site_watches" ADD COLUMN "product_type" text;--> statement-breakpoint
ALTER TABLE "site_watches" ADD COLUMN "tags" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "site_watches" ADD COLUMN "options" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "site_watches" ADD COLUMN "variants" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "site_watches" ADD COLUMN "specs_raw" jsonb DEFAULT '{}'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "site_watch_availability_events" ADD CONSTRAINT "site_watch_availability_events_brand_id_brands_id_fk" FOREIGN KEY ("brand_id") REFERENCES "public"."brands"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "site_watch_availability_brand" ON "site_watch_availability_events" USING btree ("brand_id");