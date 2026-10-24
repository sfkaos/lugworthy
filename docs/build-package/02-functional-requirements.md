# 02 Functional requirements — Lugworthy (lugworthy.com)
## Directory
- FR-1 List all published brands with A–Z, country, price band, style, "seen at En Punto" filters.
- FR-2 Brand page shows themed hero (banner, logo, accent colors), story, collections, every published model, spec summary, videos, where-to-buy, claim/sync status.
- FR-3 Model page shows gallery, all spec groups from 06, variants with own price/stock/images, related videos with timestamps, more-from-brand, similar models.
- FR-4 Variant picker updates images, price, stock, and SKU-specific specs without page reload; URL reflects variant (?v=).
- FR-5 Prices shown in USD (converted daily from brand currency when needed, labeled approximate) with the brand currency on hover.
- FR-6 Every spec field shows provenance on hover (brand-confirmed, imported, editor).
## Search and filter
- FR-7 Faceted browse across models per 09 with counts, range sliders, multi-select, shareable URL params.
- FR-8 Full-text search across brands, models, calibers, with typo tolerance, common synonyms.
- FR-9 Sort: relevance, newest, price asc/desc, diameter asc/desc, thinnest.
## Compare
- FR-10 Add up to 4 models to compare from cards/pages; tray persists in localStorage; /compare?ids= shareable.
- FR-11 Compare shows grouped spec rows, "differences only" toggle, scaled case outlines.
## Video
- FR-12 Admin creates video (YouTube/IG URL, series, title, thumbnail) and tags brands, models, timestamps.
- FR-13 Tagged videos appear on brand/model pages below core content; click-to-play lazy embed.
- FR-14 Video hub groups by series; video page lists chapters linked to models.
## Editorial
- FR-15 Articles (MDX/rich text) can embed live model cards and video cards by ID.
## Brands
- FR-16 Claim flow per 08 (domain email or site meta-tag verification).
- FR-17 Claimed brand can edit profile, theme, specs, publish/unpublish models, upload images.
- FR-18 Image license acceptance logged (who, when, version); revocation hides images within 1 hour.
- FR-19 Spec changes from sync on confirmed fields require brand/admin approval.
## Ingestion
- FR-20 Daily Shopify products.json pull per 07; manual CSV import for others.
- FR-21 Admin review queue for new/changed records.
## Outbound and growth
- FR-22 "Buy at brand" links carry affiliate params when configured, else UTM; all tracked.
- FR-23 Newsletter signup (email only) and "Apply to exhibit at En Punto" CTA on brand pages.
- FR-24 English UI; all strings externalized so a Spanish locale can be added later without code changes.
## Admin
- FR-25 Admin CMS per 12 with roles admin/editor/brand.
