# Build package: Lugworthy (lugworthy.com)
Owner: Win Raguini (En Punto). English-first, US-focused (USD). Spanish is an optional later locale. Indie/microbrand watches only.

## How to use
Read in order. 01 = why/what, 02 = numbered requirements (source of truth), 03–05 = structure and UI, 06 = schema, 07–10 = data, claim, search, video, 11–14 = SEO, admin, analytics, NFRs, 15 = acceptance tests, 16 = milestones. If documents conflict, 02 and 06 win. Do not invent features not listed; ask or log as open question.

## Recommended stack (RECOMMENDATION, swappable)
- Next.js (App Router, TypeScript) on Vercel; ISR for brand/model pages.
- Postgres (Neon or Supabase) + Drizzle ORM.
- Search: Postgres + Meilisearch or Typesense for faceted search (Algolia acceptable).
- Images: Cloudinary or Vercel Blob + next/image; store originals, serve AVIF/WebP.
- Auth for brands/admin: Clerk or Supabase Auth (magic link).
- Jobs: Vercel Cron / Inngest for daily ingestion.
- Analytics: PostHog. Email: Resend.
- i18n: next-intl, set up from day one with English only (Spanish added later). Styling: Tailwind + CSS variables for brand theming.

## Build order
1. Schema + seed (06) → 2. Ingestion + admin review (07, 12) → 3. Browse/filter + model + brand pages (05, 09) → 4. Claim/opt-in (08) → 5. Videos (10) → 6. Compare, editorial → 7. SEO/i18n polish (11) → 8. Analytics/affiliates (13) → 9. Acceptance (15).

## Hard rules
- No on-site checkout in MVP. Buy buttons link to brand sites.
- No brand images displayed publicly until the brand grants the image license (08).
- No money figures in this package.
