# 14 Non-functional requirements — Lugworthy (lugworthy.com)
- Performance: LCP < 2.5s, INP < 200ms, CLS < 0.1 on 75th percentile mobile; browse results < 300ms server response; images AVIF/WebP responsive; video facades.
- Scale: 2,000 brands, 100k variants, 500k images without redesign.
- Accessibility: WCAG 2.2 AA; keyboard filters, slider ARIA, alt text required for public images, color swatches labeled, brand colors contrast-checked.
- Security: auth via provider; RBAC enforced server-side; brand users scoped to own brand; rate-limit claim and forms; sanitize brand HTML; secrets in env; ingestion runs isolated with timeouts.
- Privacy: minimal data (newsletter email, brand user email); cookie consent where required; analytics IP anonymized; privacy policy; data deletion on request (CCPA-friendly).
- Legal: image license log, takedown form with 48h SLA, affiliate disclosure, robots.txt respected in ingestion.
- Reliability: daily backups, sync failures alert admin, stale data flagged after 7 days.
