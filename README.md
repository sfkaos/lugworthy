# Lugworthy

A directory and spec-search site for independent watch brands, built from the build package in
`docs/build-package/`. MVP rules from the spec are kept: there's no on-site checkout (buy buttons go
to the brand's site through `/out/[variant]`), no brand images until a brand grants the image
license (a to-scale case outline is drawn instead), and no money figures.

## What's in it

- **1,274 published independent brands** from the "Brand master list (source of truth)" Google Sheet
  (1,437 brands with permanent BRD IDs). Each has a hub page with country, city, description and
  style tags, and most also show founding year, movement type, movement makers, calibers, case-size
  range and a typical price from the Coroa microbrand guide. The 11 group-owned brands are hidden.
  152 brands are drafts: 4 marked "Needs review", 133 with no website yet, and 15 whose site check
  failed.
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

Brand data is read live from the master sheet (see "Data and the brands API"). Only the public
columns (A–L) are used. The private outreach columns (R–AN: emails, founders, status, replies,
notes) are never requested or copied into the repo, and the tests fail if an email ends up in
published data or the API.

## Run it

```bash
npm install
npm run dev            # http://localhost:3000
npm run build && npm start
npm test               # unit tests (normalizers, filters, Shopify mapping, privacy)
npm run lint           # type check
BASE_URL=http://localhost:3000 node tests/e2e/acceptance.mjs   # acceptance checks (Playwright)
```

## Data and the brands API

Brand data comes from the **"Brand master list (source of truth)"** Google Sheet, Brands tab. The
site and the API both read it live through `getCatalog()` in `lib/data.ts`, so they always agree.

```
Google Sheet (Brands!A1:L) --Sheets API, service account--> lib/brands/source.ts (cached 10 min, tag "brands")
   |                                                              |
   └── data/raw/master.json (snapshot, used when the sheet       lib/brands/build.ts (publish rules, directory facts)
       can't be reached or no credentials are set)                |
                                                     lib/data.ts getCatalog() --> pages and /api/v1/brands
```

- **Only columns A–L are ever requested.** The private outreach columns (R–AN: emails, founders,
  status, replies, notes) never leave Google. The live read also checks the header row and falls
  back to the snapshot if the columns were moved, or if fewer than 100 brand rows come back.
- **Publishing rule:** a brand is public on Lugworthy when Ownership is "Independent", Lugworthy fit
  is "Yes", and it has a working website. "No" fit or group-owned brands are hidden; the rest are
  drafts.
- **Freshness:** sheet edits show up within 10 minutes (`BRANDS_REVALIDATE_SECONDS`), with no
  rebuild. Visit `/api/v1/brands/refresh?secret=<BRANDS_REFRESH_SECRET>` to make them live now.
- Models (`data/seed/models.json`) are linked to brands by BRD ID, so renaming a brand in the sheet
  keeps its models.

### API

| Endpoint | What it returns |
|---|---|
| `GET /api/v1/brands` | Published brands. Query: `q`, `country` (ISO-2, comma-separated), `style`, `price` (`budget`, `affordable`, `mid`, `upper_mid`, `high`), `class`, `hasModels=true`, `hasImages=true`, `page`, `limit` (max 200) |
| `GET /api/v1/brands/BRD-0348` | One brand by BRD ID or slug |
| `?audience=all` | Every brand in the master list, plus ownership, fit and site check. Needs `Authorization: Bearer <BRANDS_API_KEY>`. Meant for En Punto and internal tools |
| `GET /api/v1/brands/BRD-0348/watches` | Watches found on the brand's own website: name, product URL, image URLs, price, key specs, plus crawl date and attribution |
| `GET /api/v1` | Endpoint index |

Brand and watch images come from the catalog crawler, which writes `data/catalog/index.json` and
one `data/catalog/BRD-####.json` per brand (format in `lib/brands/media.ts`). Images are hotlinked
from the brand's site with attribution. Following the image policy, the public API shows them only
for brands that granted the image license; `IMAGES_PUBLIC=logos` also shows brand logos for
everyone, and `IMAGES_PUBLIC=all` shows everything. `audience=all` always includes them.

Responses look like `{ data, meta: { total, page, limit, pages, audience, source, syncedAt } }`.
`source` is `sheet` for a live read or `snapshot` for the fallback. Public responses allow any
origin (CORS) and are cached at the edge for 5 minutes.

### Connecting the sheet (one time, free)

1. In Google Cloud Console, create a project, enable the **Google Sheets API**, and create a
   **service account**. Add a JSON key and download it.
2. Share the master sheet with the service account's email (`...@...iam.gserviceaccount.com`)
   as **Viewer**.
3. In Vercel, Project Settings → Environment Variables, add `GOOGLE_SERVICE_ACCOUNT_JSON` (paste
   the key file contents), `BRANDS_REFRESH_SECRET` and, when En Punto needs it, `BRANDS_API_KEY`.
   Redeploy.

A Viewer service account can technically read the whole sheet, but the code only asks for A–L.
For stricter isolation, put an `IMPORTRANGE` of columns A–L in a separate sheet, share only that
one, and set `BRANDS_SHEET_ID` to it.

### Other data

- `data/raw/master.json` is the fallback snapshot of columns A–L. `npm run seed:build` rebuilds
  `data/seed/*.json` from it with the same rules as the live site. Refresh it now and then so the
  fallback stays close to the sheet; never include R–AN.
- `data/raw/directories.json` holds brand-level facts from the Coroa microbrand guide (1,314
  brands) and the Watch Police index. They fill fields the master list doesn't have but never add
  brands. `data/raw/shopify-sample.json` holds the product feeds.
- `npm run ingest -- <domain>` pulls a brand's Shopify feed politely, respecting robots.txt with a
  2 s delay. It needs outbound network access, for example a scheduled job on Vercel.
- `db/schema.ts` is the full Postgres schema from doc 06. `npm run db:generate` and
  `npm run db:seed` load the seed into Postgres. No database is needed today.

## Environment variables (all optional)

| Variable | Use |
|---|---|
| `NEXT_PUBLIC_SITE_URL` | Canonical URL for the sitemap, JSON-LD and OG tags |
| `RESEND_API_KEY`, `RESEND_AUDIENCE_ID` | Newsletter signups. Without them, signups are logged with a hashed email |
| `GOOGLE_SERVICE_ACCOUNT_JSON` | Service account key for reading the master sheet live (raw JSON or base64). Or set `GOOGLE_SERVICE_ACCOUNT_EMAIL` + `GOOGLE_PRIVATE_KEY`. Without it, the snapshot is used |
| `BRANDS_SHEET_ID` | Sheet to read. Defaults to the master list |
| `BRANDS_REVALIDATE_SECONDS` | How long a sheet read is cached. Default 600 |
| `BRANDS_REFRESH_SECRET` | Secret for `/api/v1/brands/refresh` |
| `BRANDS_API_KEY` | Unlocks `audience=all` on the brands API (En Punto) |
| `IMAGES_PUBLIC` | `logos` or `all` to show brand-site images publicly before a brand grants the image license |
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
