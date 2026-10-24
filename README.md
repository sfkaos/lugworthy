# Lugworthy

A directory and spec-search site for independent watch brands, built from the build package in
`docs/build-package/`. MVP rules from the spec are kept: there's no on-site checkout (buy buttons go
to the brand's site through `/out/[variant]`), no brand images until a brand grants the image
license (a to-scale case outline is drawn instead), and no money figures.

## What's in it

- **1,263 published independent brands.** About 610 come from the two brand spreadsheets ("Brand
  outreach status – all brands" and "New independent watch brands", batch 2), and about 650 more
  from the Coroa microbrand guide. Each has a hub page with country, city and style tags, and most
  have founding year, movement type, movement makers, calibers, case-size range and a typical price.
  11 group-owned brands are hidden, and 141 brands are drafts for an editor to check (see below).
- **78 models (204 variants) across 12 brands**, mapped from the brands' public Shopify product
  feeds. They show as "imported, not confirmed" until an editor or the brand reviews them.
- Faceted browse at `/watches` with diameter, lug-to-lug, thickness, water resistance, price,
  movement, caliber, dial, case, strap, crystal, complications, style and country. Counts update
  as filters change, and text search handles typos and synonyms.
- Model pages with a spec table showing where each value came from, a variant picker, a wrist-fit
  hint, similar models and JSON-LD.
- A compare tray for up to 4 watches, with a side-by-side `/compare` view that can show only the
  differences.
- Hubs by style, country and caliber, plus the brands index, the for-brands claim form, takedown,
  image policy, privacy, En Punto, sitemap and robots.

Only public-safe columns from the sheets are used: name, website, country, description, Instagram
and site check. Contact emails, outreach status, notes and founder details are never copied into
the site, and `tests/normalize.test.ts` fails if an email ends up in published data.

## Run it

```bash
npm install
npm run dev            # http://localhost:3000
npm run build && npm start
npm test               # unit tests (normalizers, filters, Shopify mapping, privacy)
npm run lint           # type check
BASE_URL=http://localhost:3000 node tests/e2e/acceptance.mjs   # acceptance checks (Playwright)
```

## Data

- `data/raw/sheets.json` is a snapshot of the spreadsheet columns used, with the private columns
  removed. `data/raw/shopify-sample.json` holds the product feeds.
- `data/raw/directories.json` is a snapshot of brand-level facts from the Coroa microbrand guide
  (all 1,314 brands, detail pages for 706) and the Watch Police brand index (A to N). The seed fills
  missing fields for brands already in the sheets and adds new independent brands. Group-owned
  brands are excluded, and marketplace, fashion-led or unclear brands are added as drafts
  (`EXCLUDE`, `REVIEW` and `WP_ADD` in `scripts/build-seed.ts`). Each build writes
  `data/seed/directory-log.json` listing what was added or excluded and why.
- `npm run seed:build` regenerates `data/seed/brands.json` and `models.json`.
- `npm run ingest -- <domain>` pulls a brand's Shopify feed politely, respecting robots.txt with a
  2 s delay. It needs outbound network access, for example a scheduled job on Vercel.
- `db/schema.ts` is the full Postgres schema from doc 06. `npm run db:generate` and
  `npm run db:seed` load the seed into Postgres. The pages still read the JSON seed through
  `lib/data.ts`, which is the one place to change when you move to the database.

## Environment variables (all optional)

| Variable | Use |
|---|---|
| `NEXT_PUBLIC_SITE_URL` | Canonical URL for the sitemap, JSON-LD and OG tags |
| `RESEND_API_KEY`, `RESEND_AUDIENCE_ID` | Newsletter signups. Without them, signups are logged with a hashed email |
| `DATABASE_URL` | Postgres for `db:seed` |
| `INGEST_CONTACT_EMAIL` | Contact address in the ingest user agent |
| `NEXT_PUBLIC_EN_PUNTO_URL`, `NEXT_PUBLIC_EXHIBIT_URL` | En Punto links |

## Known gaps and assumptions

- Directory facts are brand-level and unconfirmed. Brand pages label them with the source and
  check date. Watch Police's country column is unreliable, so it's only used when nothing else is.
- Models exist for only 12 brands so far. Spec extraction from product descriptions is automatic
  and unreviewed, so some values will be wrong until checked.
- Store currencies for Farer (GBP), Unimatic and Serica (EUR) are assumed. FX rates in
  `data/seed/fx.json` are placeholders, and converted prices are labeled "≈".
- There's no admin CMS, sign-in or brand claim dashboard yet. Claim, takedown and newsletter
  requests are accepted and logged. Videos and editorial pages are empty states.
- No brand is marked as an En Punto exhibitor, because that came only from private outreach status.
