# 09 Search and filtering — Lugworthy (lugworthy.com)
Engine indexes one document per variant, collapsed by model in results (show min price, matching variants count).
## Facets
P0 (open): price (range, in chosen currency), case_diameter_mm (range, 0.5 step), lug_to_lug_mm (range), thickness_mm (range), movement_type (multi), water_resistance_m (min: 30/50/100/200/300/500+), style (multi), dial_color (swatches), strap_type (multi), availability (in stock/preorder/crowdfunding/sold out).
P1 (collapsed): caliber (searchable multi), crystal_material, case_material, lug_width_mm (multi), quick_release, lume_type, complications, brand country, ships_to US, bezel_type, crown_type.
P2: dial_texture, date (yes/no), limited_edition, en_punto_exhibitor, has_video, brand_confirmed, release year.
Counts shown per option; zero-count options disabled not hidden.
## Sort
relevance (default with q), newest (default), price_asc, price_desc, diameter_asc, diameter_desc, thinnest.
## URL params
?q=&price=200-800&cur=USD&dia=36-40&l2l=-48&thk=-12&mov=automatic,hand_wound&wr=200&style=diver&dial=blue,green&strap=bracelet&avail=in_stock&cal=nh35&crystal=sapphire&mat=titanium_gr5&lug=20&qr=1&lume=bgw9&comp=gmt&country=MX&ships=US&exhib=1&video=1&sort=newest&page=2
Every state is shareable and SSR-crawlable for curated combos (style/caliber hubs); arbitrary combos noindex.
## Text search
Fields weighted: model name, brand, reference, caliber, collection, tags. Synonyms (dive=diver, band=strap, sapphire crystal=sapphire, auto=automatic). Typo tolerance on.
