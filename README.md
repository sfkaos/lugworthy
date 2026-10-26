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

Brand data is synced from the master sheet into Postgres (see "Data and the brands API"). Only the public
columns (A–L) are used. The private outreach columns (R–AN: emails, founders, status, replies,
notes) are never requested or copied into the repo, and the tests fail if an email ends up in
published data or the API.

## Run it

```bash
npm install
npm run dev            # http://localhost:3000
npm run build && npm start
npm test               # unit tests, incl. sync and API on an in-memory Postgres
npm run lint           # type check
npm run test:e2e       # browser + API tests against https://lugworthy.com (Playwright)
npm run test:site      # every page, link and image on the live site, with timings
```

## Tests

Nothing in the test suite writes data: no form is submitted and the API is only read.

| Command | What it checks |
|---|---|
| `npm test` | Unit tests (vitest): filters, sync, crawler, API queries, formatting, theming, and that no email reaches published data |
| `npm run test:e2e` | Browser tests (Playwright) on desktop and a phone-size screen: every page type loads without errors, filters, search, sorting, paging, brand and watch pages, buy links, compare tray, light and dark mode contrast, no sideways scrolling on phones, every image loads and watch cards have photos, load-time limits, and the API (auth, CORS, paging, filters, no private fields) |
| `npm run test:site` | Opens every page in the sitemap and every internal page they link to, checks every internal link, `/out/` buy link and image, and times each page. Writes `test-results/site-check.md` |

Options:

- `BASE_URL=http://localhost:3000` points either suite at another server.
- `BRANDS_API_TOKEN=...` turns on the signed-in API tests (they skip without it).
- Load-time limits for `test:e2e`: `MAX_TTFB_MS` (default 1000), `MAX_DCL_MS` (2500), `MAX_LOAD_MS` (4000),
  `MAX_COLD_MS` (5000, a fresh render that skips the CDN). `MIN_PHOTO_SHARE` (0.9) is the share of
  watch cards that must show a photo.
- `test:site` takes `--limit 500`, `--concurrency 4`, `--slow-ms 3000` and `--images false`.

`.github/workflows/test.yml` runs the unit tests on every push and pull request, the browser tests
against lugworthy.com daily, and the full site check on Mondays (or from "Run workflow"). Add
`BRANDS_API_TOKEN` as a repository secret to include the signed-in API tests.

## Data and the brands API

The master Google Sheet is the source of truth, but nothing reads it at request time. A sync job
copies it into Postgres, and the site and the API read only the database.

```
Google Sheet "Brand master list", Brands!A1:L ─┐
                                                ├─ sync job (/api/cron/sync, daily on Vercel Cron,
data/catalog/*.json (brand-site crawler) ───────┘   or `npm run db:sync`)  ──>  Postgres (Neon)
                                                                                    │
                                    site pages + /api/v1 (via getCatalog() in lib/data.ts) <─┘
```

- **Only columns A–L are ever read from the sheet.** The private outreach columns (R–AN: emails,
  founders, status, replies, notes) never leave Google and never reach the database. The sync
  checks the header row and refuses to run if the columns moved or fewer than 100 rows come back.
- **Sync rules** (`lib/sync/sheet.ts`): brands are upserted on their permanent BRD ID, so renames
  keep their history and models. Rows removed from the sheet are hidden, not deleted. Fields the
  site manages later (claim status, image license, En Punto, colours) are never overwritten. Each
  run is logged in the `data_syncs` table.
- **Publishing rule** (`lib/brands/build.ts`): public on Lugworthy when Ownership is "Independent",
  Lugworthy fit is "Yes", and the brand has a working website.
- **Brand-site catalog** (`lib/sync/catalog.ts`): the crawler's `data/catalog/index.json` and
  `data/catalog/BRD-####.json` files are imported into `brand_crawls`, `site_watches` and
  `site_watch_images`. Each import replaces that brand's watches with the latest crawl.
- **Freshness:** Vercel Cron runs the sync daily (the Hobby plan's limit). Run it any time from
  `https://<site>/api/cron/sync?secret=<CRON_SECRET>`; changes show within about a minute.
- Without `DATABASE_URL` (local dev, tests), the site runs on the checked-in snapshot
  (`data/raw/master.json`) and the local `data/catalog` files.

### Tables

| Table | What's in it |
|---|---|
| `brands` | One row per master-list brand. `brand_code` is the BRD ID; plus name, website, country, city, Instagram, description, style tags, price band, ownership, Lugworthy fit, site check, directory facts, publish status |
| `brand_crawls` | Latest crawl of each brand's own site: status, platform, crawl time, brand image (URL, kind, source page, size, optional Blob copy), attribution, image rights |
| `site_watches` | Watches found on the brand's site: `BRD-####/<slug>` ID, name, product URL, price, currency, availability, key specs, crawl time |
| `site_watch_images` | Each watch's images in site order (URL, size, optional Blob copy) |
| `data_syncs` | Log of sync runs |

The rest of `db/schema.ts` is the full model from doc 06, ready for models, variants, claims and
so on. Migrations live in `db/migrations` (`npm run db:generate` after a schema change) and are
applied automatically before each build.

### API

Every request needs `Authorization: Bearer <BRANDS_API_TOKEN>`. The token is read-only.

| Endpoint | What it returns |
|---|---|
| `GET /api/v1/brands` | Published brands. Query: `q`, `country` (ISO-2, comma-separated), `style`, `price` (`budget`, `affordable`, `mid`, `upper_mid`, `high`), `class`, `hasModels=true`, `hasImages=true`, `page`, `limit` (max 200) |
| `GET /api/v1/brands/BRD-0348` | One brand by BRD ID or slug, with its brand image |
| `GET /api/v1/brands/BRD-0348/watches` | Watches found on the brand's own website: name, product URL, image URLs, price, key specs, plus crawl date and attribution |
| `GET /api/v1/watches` | Every published watch with the same filters as `/watches` on the site (`q`, `brand`, `soldOut`, `dia`, `mov`, `price`, `sort`, …), `page`, `limit` (max 200). `sort=none` keeps catalog order |
| `?detail=full` | On `/brands` and `/watches`: every field the site's pages use (variants, all photos, stock history, options, raw specs, claim status, colors) |
| `?audience=all` | Every brand in the master list, plus ownership, fit and site check (for En Punto) |
| `GET /api/v1` | Endpoint index |

The same API is served at `https://api.lugworthy.com/brands`, `/watches`, … (`middleware.ts`). Add
`api.lugworthy.com` under the Vercel project's Domains and a DNS record `CNAME api → cname.vercel-dns.com`.

**The site runs on the API.** With `LUGWORTHY_API_URL` set (e.g. `https://api.lugworthy.com`), every
page (browse, brand collections, watch pages, compare, search, outbound links) is built from
`/brands?detail=full` and `/watches?detail=full` (`lib/catalog/from-api.ts`), cached for a minute and
refreshed by the sync. If the API can't be reached, pages read the database directly and log it.
The API routes themselves always read the database.

Responses look like `{ data, meta: { total, page, limit, pages, audience, source, syncedAt } }`.
`source` is `database`, or `snapshot` when no database is connected.

Images are hotlinked from the brand's site with attribution. Following the image policy, the
default audience sees them only for brands that granted the image license; `IMAGES_PUBLIC=logos`
also shows brand logos, and `IMAGES_PUBLIC=all` shows everything. `audience=all` always includes them.

### Setup on Vercel (all free tiers)

1. **Database:** in the Vercel project, Storage → Create → **Neon** (Marketplace), Free plan,
   connected to the lugworthy project. This sets `DATABASE_URL`.
2. **Sheet access:** in Google Cloud Console, create a project, enable the Google Sheets API,
   create a service account and download a JSON key. Share the master sheet with the service
   account's email as **Viewer**.
3. **Environment variables** (Project Settings → Environment Variables):
   `GOOGLE_SERVICE_ACCOUNT_JSON` (paste the key file), `CRON_SECRET` (any long random string),
   `BRANDS_API_TOKEN` (any long random string; share it with whoever calls the API).
4. **API subdomain:** add `api.lugworthy.com` under Domains, add the CNAME at the DNS host, and set
   `LUGWORTHY_API_URL=https://api.lugworthy.com` so the site reads from it.
5. **Redeploy**, then open `/api/cron/sync?secret=<CRON_SECRET>` once to fill the database.

A Viewer service account could technically read the whole sheet, but the code only asks for A–L.
For stricter isolation, put an `IMPORTRANGE` of columns A–L in a separate sheet, share only that
one, and set `BRANDS_SHEET_ID` to it.

### Other data

- `data/raw/master.json` is the local snapshot of columns A–L, used when no database is
  connected and by `npm run db:sync -- --snapshot`. `npm run seed:build` rebuilds
  `data/seed/*.json` from it with the same rules. Never include R–AN.
- `data/raw/directories.json` holds brand-level facts from the Coroa microbrand guide (1,314
  brands) and the Watch Police index. They fill fields the master list doesn't have but never add
  brands. `data/raw/shopify-sample.json` holds the product feeds.
- `npm run ingest -- <domain>` pulls a brand's Shopify feed politely, respecting robots.txt with a
  2 s delay. It needs outbound network access, for example a scheduled job on Vercel.

## Environment variables (all optional)

| Variable | Use |
|---|---|
| `NEXT_PUBLIC_SITE_URL` | Canonical URL for the sitemap, JSON-LD and OG tags |
| `RESEND_API_KEY`, `RESEND_AUDIENCE_ID` | Newsletter signups. Without them, signups are logged with a hashed email |
| `DATABASE_URL` | Postgres (set by the Neon integration). Without it the site uses the snapshot |
| `GOOGLE_SERVICE_ACCOUNT_JSON` | Service account key the sync uses to read the sheet (raw JSON or base64). Or `GOOGLE_SERVICE_ACCOUNT_EMAIL` + `GOOGLE_PRIVATE_KEY` |
| `CRON_SECRET` | Protects `/api/cron/sync`. Vercel Cron sends it automatically |
| `BRANDS_API_TOKEN` | Read-only bearer token for `/api/v1`. The API is off until it's set |
| `LUGWORTHY_API_URL` | Where the site's pages get their data (e.g. `https://api.lugworthy.com`). Needs `BRANDS_API_TOKEN`. Without it pages read the database |
| `LUGWORTHY_API_MAX_WATCHES` | Above this many watches (default 3000) pages read the database instead of pulling the whole catalog through the API |
| `CATALOG_TTL_SECONDS` | How long each server keeps the catalog in memory (default 600). Builds load it once per worker |
| `BRANDS_SHEET_ID` | Sheet to sync. Defaults to the master list |
| `IMAGES_PUBLIC` | `logos` or `all` to show brand-site images before a brand grants the image license |
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
