import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { BrandCard } from "@/components/BrandCard";
import { ModelGrid } from "@/components/ModelCard";
import { StyleIcon } from "@/components/StyleIcon";
import { homeData } from "@/lib/site-data";
import { SITE_URL, jsonLd } from "@/lib/site";

const STYLE_TILES = ["diver", "field", "gmt", "chronograph", "dress", "pilot"] as const;

export default async function Home() {
  // Only what this page shows: counts, 12 new watches, one featured brand with 3 watches, 8 brands.
  const { stats, newReleases, featured: featuredRow, featuredModels, newBrands } = await homeData();
  const t = await getTranslations();
  const featured = featuredRow?.brand ?? null;

  const chips: [string, string][] = [
    ["/watches?price=-500", t("chips.under500")],
    ["/watches?dia=36-39", t("chips.size38")],
    ["/watches?style=diver", t("chips.diver")],
    ["/watches?cal=seiko_nh35", t("chips.nh35")],
    ["/watches?mat=titanium_gr2,titanium_gr5", t("chips.titanium")],
    ["/watches?style=gmt", t("chips.gmt")],
  ];

  const stats3: [number, string][] = [
    [stats.brands, t("home.statBrands")],
    [stats.countries, t("home.statCountries")],
    [stats.models, t("home.statWatches")],
  ];
  const trust = [1, 2, 3] as const;

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={jsonLd({ "@context": "https://schema.org", "@type": "WebSite", name: "Lugworthy", url: SITE_URL, potentialAction: { "@type": "SearchAction", target: `${SITE_URL}/search?q={q}`, "query-input": "required name=q" } })} />

      {/* Hero: search is the main action (directory pattern). */}
      <section className="border-b border-line">
        <div className="mx-auto grid max-w-7xl gap-10 px-4 pb-12 pt-12 md:pt-20 lg:grid-cols-[1.5fr_1fr] lg:items-end">
          <div>
            <p className="eyebrow eyebrow-brass">{t("home.eyebrow")}</p>
            <h1 className="mt-4 max-w-3xl text-5xl leading-[1.02] md:text-7xl">{t("home.heroTitle")}</h1>
            <p className="mt-5 max-w-xl text-lg text-muted">{t("home.heroBody", { brands: stats.brands, countries: stats.countries })}</p>
            <form action="/watches" role="search" className="mt-8 flex max-w-2xl gap-2">
              <label htmlFor="home-q" className="sr-only">{t("nav.search")}</label>
              <input id="home-q" name="q" type="search" className="input h-14 px-4 text-base" placeholder={t("nav.searchPlaceholder")} />
              <button className="btn btn-primary h-14 px-6">{t("nav.search")}</button>
            </form>
            <div className="mt-5 flex flex-wrap items-center gap-2">
              <span className="mr-1 text-sm text-muted">{t("home.popular")}</span>
              <ul className="contents">
                {chips.map(([href, label]) => (
                  <li key={href}><Link className="chip" href={href}>{label}</Link></li>
                ))}
              </ul>
            </div>
          </div>
          <dl className="grid grid-cols-3 border-t border-line-strong lg:grid-cols-1 lg:border-t-0 lg:border-l lg:pl-10">
            {stats3.map(([n, label], i) => (
              <div key={label} className={`flex flex-col-reverse justify-end gap-2 py-4 ${i > 0 ? "border-l border-line pl-4 lg:border-l-0 lg:border-t lg:pl-0" : ""}`}>
                <dt className="text-xs font-semibold uppercase tracking-[.12em] text-muted">{label}</dt>
                <dd className="tabular font-serif text-4xl font-semibold leading-none md:text-5xl">{n.toLocaleString("en-US")}</dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 pt-14" aria-labelledby="styles-h">
        <div className="section-head"><h2 id="styles-h">{t("home.browseByStyle")}</h2></div>
        <ul className="grid grid-cols-2 gap-px overflow-hidden rounded-[var(--radius-lg)] border border-line bg-line sm:grid-cols-3 lg:grid-cols-6">
          {STYLE_TILES.map((s) => (
            <li key={s} className="flex">
              <Link href={`/styles/${s}`} className="group flex w-full flex-col items-center gap-3 bg-surface px-3 py-6 text-center transition-colors duration-200 hover:bg-surface-2">
                <StyleIcon style={s} className="h-12 w-12 text-ink transition-colors duration-200 group-hover:text-brass" />
                <span className="font-semibold">{t(`enum.style.${s}`)}</span>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <section className="mx-auto max-w-7xl px-4 pt-16" aria-labelledby="new-h">
        <div className="section-head">
          <h2 id="new-h">{t("home.newReleases")}</h2>
          <Link className="link text-sm font-semibold" href="/watches">{t("home.seeAll")}</Link>
        </div>
        <ModelGrid models={newReleases} />
      </section>

      {featured && (
        <section className="mx-auto max-w-7xl px-4 pt-16">
          <div className="grid overflow-hidden rounded-[var(--radius-lg)] border border-line md:grid-cols-[1fr_2fr]">
            <div className="flex flex-col justify-center gap-3 bg-ink p-8 text-bg">
              <p className="eyebrow !text-[var(--brass-soft)] opacity-90">{t("home.featuredBrand")}</p>
              <h2 className="text-5xl">{featured.name}</h2>
              {featured.story && <p className="opacity-80">{featured.story}</p>}
              <Link className="btn mt-3 self-start border-bg bg-transparent text-bg hover:bg-bg hover:text-ink" href={`/brands/${featured.slug}`}>{t("brand.models")} →</Link>
            </div>
            <div className="bg-surface p-4 md:p-6">
              <ModelGrid models={featuredModels} showBrand={false} />
            </div>
          </div>
        </section>
      )}

      <section className="mx-auto max-w-7xl px-4 pt-16" aria-labelledby="trust-h">
        <div className="section-head"><h2 id="trust-h">{t("home.trustTitle")}</h2></div>
        <ol className="grid gap-8 md:grid-cols-3">
          {trust.map((n) => (
            <li key={n} className="border-t border-ink pt-4">
              <span className="tabular font-serif text-2xl text-brass">0{n}</span>
              <h3 className="mt-1 text-lg font-semibold">{t(`home.trust${n}Title`)}</h3>
              <p className="mt-1 text-muted">{t(`home.trust${n}Body`)}</p>
            </li>
          ))}
        </ol>
      </section>

      <section className="mx-auto max-w-7xl px-4 pt-16" aria-labelledby="brands-h">
        <div className="section-head">
          <h2 id="brands-h">{t("home.newBrands")}</h2>
          <Link className="link text-sm font-semibold" href="/brands">{t("home.seeAll")}</Link>
        </div>
        <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {newBrands.map((b) => (
            <li key={b.brand.slug}><BrandCard brand={b.brand} modelCount={b.modelCount} logo={b.logo} /></li>
          ))}
        </ul>
      </section>

      <section className="mx-auto max-w-7xl px-4 pt-16">
        <div className="grid gap-8 rounded-[var(--radius-lg)] border border-line bg-surface p-8 md:grid-cols-[1fr_1.2fr] md:items-center">
          <div>
            <p className="eyebrow eyebrow-brass">En Punto</p>
            <h2 className="mt-2 text-4xl">{t("home.latestVideo")}</h2>
            <p className="mt-3 text-muted">{t("home.videoSoon")}</p>
          </div>
          <div className="flex aspect-video items-center justify-center rounded-[var(--radius-md)] bg-surface-2 text-muted">
            <svg aria-hidden viewBox="0 0 48 48" width="56" height="56" fill="none" stroke="currentColor" strokeWidth="1.5"><circle cx="24" cy="24" r="20" /><path d="M20 16l12 8-12 8z" fill="currentColor" /></svg>
          </div>
        </div>
      </section>
    </>
  );
}
