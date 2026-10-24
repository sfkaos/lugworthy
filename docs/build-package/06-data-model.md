# 06 Data model (Postgres; units in parentheses) — Lugworthy (lugworthy.com)
Common columns: id uuid, created_at, updated_at. Localized text = jsonb {en, es?} (en required; es optional for later).

## brands
slug uniq, name, legal_name, website_url, shopify_domain, platform enum(shopify,woocommerce,bigcommerce,squarespace,other), country (ISO-2), city, founded_year, story jsonb, tagline jsonb, logo_media_id, logo_dark_media_id, banner_media_id, banner_focal_x/y (0–1), color_primary hex, color_secondary hex, price_min/price_max (minor units) + currency (ISO-4217), socials jsonb {instagram,youtube,tiktok}, is_microbrand_class enum(microbrand,legacy_micro,independent), en_punto_exhibitor bool, en_punto_editions text[], status enum(draft,published,hidden), claim_status enum(unclaimed,pending,claimed), image_license_status enum(none,granted,revoked), affiliate_program jsonb {network,param,url_template}, ships_to text[] (ISO-2), last_synced_at.

## collections
brand_id fk, slug, name jsonb, description jsonb, sort.

## models (a reference/design)
brand_id fk, collection_id fk null, slug, name, reference, description jsonb, release_date, status enum(in_production,preorder,crowdfunding,discontinued,sold_out,announced), limited_edition bool, edition_size int, style enum[] (diver,field,pilot,gmt,chronograph,dress,racing,skin_diver,integrated_bracelet,tool,digital,other), source_url, published bool.

## variants (SKU: dial/strap/size)
model_id fk, sku, shopify_variant_id, title, price (minor), currency, compare_at_price, available bool, inventory_policy, preorder bool, ship_estimate text, dial_color enum, strap_type enum, url, sort.

## specs (one row per model; variant_specs overrides same columns nullable)
Case: case_diameter_mm numeric(4,1), lug_to_lug_mm, thickness_mm, thickness_incl_crystal_mm, lug_width_mm, weight_head_g, weight_total_g, case_material enum(steel_316l,steel_904l,titanium_gr2,titanium_gr5,bronze,brass,ceramic,carbon,aluminium,gold,silver,other), case_finish enum[](brushed,polished,bead_blasted,mixed), case_coating enum(none,dlc,pvd,ip), case_shape enum(round,cushion,tonneau,square,rectangular,other).
Crown/bezel: crown_type enum(screw_down,push_pull), crown_position enum(3,4,2,9,other), crown_guards bool, bezel_type enum(fixed,unidirectional_60,unidirectional_120,bidirectional,gmt_24h,12h,countdown,internal_rotating,none), bezel_insert_material enum(ceramic,aluminium,sapphire,steel,bakelite,other), bezel_lume_pip bool.
Crystal: crystal_material enum(sapphire,mineral,hesalite_acrylic,other), crystal_shape enum(flat,domed,double_domed,box), ar_coating enum(none,inner,outer,both), caseback enum(solid,exhibition,screwdown_solid,screwdown_exhibition).
Water: water_resistance_m int, iso6425 bool, helium_valve bool.
Movement: movement_type enum(automatic,hand_wound,quartz,mecaquartz,solar,kinetic,spring_drive,smart_hybrid), caliber_id fk, in_house bool, regulation text, accuracy_spec text.
calibers table: name, maker, base_caliber, country, jewels, frequency_bph, power_reserve_h, hacking bool, hand_winding bool, functions text[].
Functions: complications enum[] (date,day_date,gmt,world_time,chronograph,flyback,moonphase,power_reserve,small_seconds,alarm,annual_calendar,regulator,none).
Dial: dial_color enum(black,white,silver,grey,blue,green,red,orange,yellow,brown,cream,salmon,purple,pink,teal,multi,skeleton), dial_texture enum(sunburst,matte,gloss,enamel,stone,guilloche,textured,fume,sandwich,meteorite,mother_of_pearl), indices enum(applied,printed,numerals_applied,numerals_printed,mixed), hand_style text, date_position text, date_color_matched bool.
Lume: lume_type enum(super_luminova_bgw9,c3,c1,x1,old_radium,tritium_tubes,none,other), lume_color text, lume_locations text[].
Strap: strap_type enum(bracelet,rubber,fkm,silicone,leather,nato,canvas,mesh,sailcloth,other), bracelet_link enum(oyster,jubilee,beads_of_rice,integrated,president,h_link,other), endlinks enum(solid,folded,integrated,none), taper_mm text, clasp enum(micro_adjust,on_the_fly,tool_free,deployant,buckle,butterfly), quick_release bool, extra_straps text.
Origin/warranty: assembly_country ISO-2, origin_claim text (Swiss Made etc.), warranty_years.
Provenance: spec_sources jsonb {field: imported|brand|editor}, brand_confirmed_at.

## media
owner_type enum(brand,model,variant,article), owner_id, kind enum(product_front,product_side,product_back,wrist,lifestyle,360,banner,logo,detail), source_url, storage_key, width, height, alt jsonb, credit, rights enum(unknown,licensed,own,revoked), sort. Public queries must filter rights in (licensed,own).

## videos
platform enum(youtube,instagram,tiktok), external_id, url, series_id, title jsonb, description jsonb, thumbnail_media_id, duration_s, published_at, status.
video_series: slug, name jsonb.
video_links: video_id, brand_id null, model_id null, timestamp_s null, note jsonb. (At least one of brand/model.)

## editorial
articles: slug, title jsonb, dek jsonb, body jsonb (blocks incl. model_card, video_card), type enum(guide,roundup,fair,interview), author, published_at, status. article_models, article_brands link tables.

## claims and licenses
users: email, role enum(admin,editor,brand), brand_id.
claims: brand_id, email, method enum(domain_email,meta_tag,dns_txt,manual), token, status enum(pending,verified,rejected,expired), verified_at.
image_licenses: brand_id, version, accepted_by_user_id, accepted_at, ip, revoked_at.

## ingestion
sync_runs: brand_id, started_at, finished_at, status, counts jsonb, error.
raw_products: brand_id, shopify_product_id, payload jsonb, hash, fetched_at.
change_queue: entity, entity_id, field, old, new, source, status enum(pending,approved,rejected).
overrides: entity, entity_id, field, value, locked bool (sync never overwrites locked).

## analytics/affiliate
outbound_clicks: variant_id, model_id, brand_id, page, session_id, affiliate bool, ts.
fx_rates: date, base, quote, rate.
