# 07 Ingestion — Lugworthy (lugworthy.com)
## Discovery
Seed list (En Punto exhibitors, brand applications, editor adds). Detect Shopify: GET https://{domain}/products.json returns JSON, or `Shopify.shop` in HTML.
## Pull
GET /products.json?limit=250&page=N until empty (fallback: /collections/all/products.json). Polite: 1 req/2s per domain, custom User-Agent with contact email, respect robots.txt, back off on 429. Store raw payload + hash in raw_products; skip unchanged.
## Mapping
product → model (title, handle→slug, body_html→description, product_type/tags→style). variants → variants (sku, price, compare_at_price, available, option1–3 → dial_color/strap_type via synonym tables). images → media with rights=unknown (never public until license).
## Spec extraction
Parse body_html + tags + metafields-like tables: regex + dictionary per field (e.g. "40mm", "Lug to lug: 47", "NH35", "200m/20ATM", "sapphire"). Optional LLM extraction to JSON schema, always with confidence; low confidence → change_queue for editor.
## Normalization
Units to mm/m/g/hours; ATM/bar ×10 → m; inches → mm; caliber aliases (NH35A=NH35, 4R35 sibling); color/strap synonyms; currency stored as minor units.
## Dedupe
Model key = brand + normalized reference or handle; variants grouped when titles differ only by option. Bundles/straps/accessories excluded by product_type/keywords (strap, tool, gift card) into ignore list.
## Schedule
Daily full price/stock sync; weekly full spec re-parse; on-demand "sync now" in admin/panel.
## Manual overrides
overrides table; locked fields never overwritten; changes to brand-confirmed fields go to change_queue.
## Image rights gating
Imported images stored privately with rights=unknown. Public render requires brand image_license_status=granted or rights=own. On revoke, set rights=revoked, purge CDN within 1h.
## Non-Shopify
CSV template matching 06 fields; brand panel form.
