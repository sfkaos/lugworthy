# 15 Acceptance criteria and test plan — Lugworthy (lugworthy.com)
## Acceptance (Given/When/Then)
- AC-1 Filtering 36–40mm + automatic + 200m+ returns only matching models; counts update; URL shareable and reloads to same state.
- AC-2 Variant change updates price, stock, images and URL without full reload.
- AC-3 Unlicensed brand page shows no brand images anywhere (pages, OG, sitemap image tags).
- AC-4 Revoking license hides images within 1h.
- AC-5 Claim via domain email or meta tag succeeds; wrong domain fails.
- AC-6 Locked override survives next sync; unchanged products not rewritten (hash).
- AC-7 Video tagged to model appears below spec table and starts at timestamp; not loaded until click.
- AC-8 Compare 4 models; differences-only hides equal rows.
- AC-9 Outbound click logged and redirects with affiliate params when set.
- AC-10 Valid schema.org Product/VideoObject per Rich Results test.
- AC-11 Lighthouse mobile ≥ 90 performance/accessibility on home, browse, model.
- AC-12 No checkout/payment UI exists in MVP.
## Test plan
Unit: normalizers (units, calibers, colors), spec extractor with fixture products.json from 10 real brands. Integration: ingestion end-to-end into staging DB; claim flow emails. E2E (Playwright): AC-1…AC-9. Visual: brand theming contrast. Manual QA: 20 random models vs brand site.
