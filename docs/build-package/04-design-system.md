# 04 Design system — Lugworthy (lugworthy.com)
## Principles
Neutral, gallery-like site chrome so brand photography and brand themes stand out. Specs are dense but scannable.

## Tokens (CSS variables)
- Color: --bg, --surface, --text, --text-muted, --border, --accent (site), --success, --warning, --danger. Light + dark.
- Brand scope: --brand-primary, --brand-secondary, --brand-on-primary, --brand-banner-url (set on brand/model pages only).
- Spacing 4px scale (4,8,12,16,24,32,48,64). Radius 4/8/12. Shadows: none or 1 subtle.
- Breakpoints: 640, 768, 1024, 1280, 1536.

## Typography
Sans for UI (e.g. Inter), optional serif for editorial headings; tabular numerals for specs. Scale 12/14/16/18/24/32/48.

## Components
Header, SearchBar (with chips), FilterRail (Accordion, CheckboxGroup, RangeSlider, Toggle, ColorSwatch), ActiveFilterChips, SortSelect, ModelCard, BrandCard, VideoCard (click-to-play), VideoEmbed, SpecTable (grouped, provenance tooltip), VariantPicker (swatches), Gallery (zoom, lightbox, swipe), CompareTray, CompareTable, CaseOutline (SVG to scale), BrandHero, Badge (En Punto, Verified, Preorder, Limited), StockPill, BuyButton (outbound), NewsletterForm, LanguageSwitch, Breadcrumbs, EmptyState, Skeleton, Toast.

## Brand theming rules
- Theme applies only inside BrandHero, brand page section accents, and model page header/BuyButton.
- Site chrome (nav, filters, spec table text) stays neutral for consistency.
- Contrast: auto-pick on-color text; if brand color fails WCAG AA against bg, use it only as a border/accent, never text bg.
- Banner: min 2400x800, focal point set by brand; fallback = brand primary color gradient-free solid with logo.
- Logo: SVG preferred; light and dark versions.
- Unclaimed brands get neutral theme.

## Brand voice and naming (Lugworthy)
- Name: "Lugworthy", one word, capital L only. Domain lugworthy.com. Never "LugWorthy" or "Lug Worthy". Handle @lugworthy where available.
- Meaning: a pun on lug-to-lug, the spec that decides whether a watch fits your wrist, and on "worthy". The promise is that every watch here has been measured to that level of detail.
- Voice: a knowledgeable enthusiast friend. Precise, plain-spoken and a little dry-witty. Spec-literate without gatekeeping. Respectful of small brands, never hype-y. No "luxury" clichés, no fake urgency.
- Writing rules: specs in mm, meters and hours with a non-breaking space (40 mm, 200 m, 70 h). Use American English. Sentence-case headings. Microcopy is short ("Fits 6.5–7 in wrists", "Measured, not guessed").
- Tagline options (pick one): "Every microbrand, measured." / "Find the watch that fits." / "Indie watches, down to the millimeter."
- En Punto tie-in: a "Seen at En Punto" badge, and video series credited "Lugworthy x En Punto" where relevant.
- Logo direction: a wordmark, with an optional monogram formed by two lugs. Keep it neutral in color so brand themes lead.
