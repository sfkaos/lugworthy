# 11 SEO and i18n — Lugworthy (lugworthy.com)
- English (en-US) is the only launch locale; US audience, USD prices, imperial-friendly helpers (mm stays primary for specs, as the hobby uses mm).
- All UI strings in next-intl message files so Spanish (/es) can be added later; when added: hreflang en, es, x-default.
- schema.org: Organization/Brand on brand pages; Product with Offer (price USD, availability, url to brand), brand, additionalProperty for specs on model pages; VideoObject on video pages; Article on editorial; BreadcrumbList everywhere; ItemList on hubs.
- Sitemaps split: brands, models, videos, articles, hubs; lastmod from updated_at.
- Canonicals: variant URLs canonical to model; filtered browse noindex except whitelisted hubs.
- OG images generated per model/brand (brand colors, photo if licensed).
- Hubs (caliber, style, country, "American microbrands", "best divers under $X") get unique intro copy.
- Core Web Vitals targets in 14.
