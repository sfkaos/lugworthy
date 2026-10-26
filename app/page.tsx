import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { BrandCard } from "@/components/BrandCard";
import { ModelGrid } from "@/components/ModelCard";
import { getCatalog } from "@/lib/data";
import { availability } from "@/lib/filters";
import { SITE_URL, jsonLd } from "@/lib/site";

const STYLE_TILES = ["diver", "field", "gmt", "chronograph", "dress", "pilot"] as const;

export default async function Home() {
  const catalog = await getCatalog();
  const t = await getTranslations();
  const stats = catalog.brandStats();
  // Watches with photos lead, so the home page shows real watches when we have them.
  const all = catalog.publishedModels();
  const models = [...all.filter((m) => m.images?.length), ...all.filter((m) => !m.images?.length)];
  // One fresh model per brand first, so the row isn't a single catalog.
  const seen = new Set<string>();
  const fresh = models.filter((m) => availability(m) !== "sold_out").filter((m) => (seen.has(m.brandSlug) ? false : (seen.add(m.brandSlug), true)));
  const newReleases = [...fresh, ...models.filter((m) => !fresh.includes(m))].slice(0, 12);

  const brands = catalog.publishedBrands();
  const withPhotos = brands
    .map((b) => ({ b, n: catalog.modelsForBrand(b.slug).filter((m) => m.images?.length).length }))
    .sort((x, y) => y.n - x.n);
  const featured = withPhotos[0]?.n ? withPhotos[0].b : brands.find((b) => b.slug === "oak-and-oscar") ?? brands[0];
  const featuredModels = [...catalog.modelsForBrand(featured.slug)].sort((a, b) => Number(!!b.images?.length) - Number(!!a.images?.length)).slice(0, 3);
  const newBrands = [...brands.filter((b) => catalog.logoFor(b)), ...brands.filter((b) => !catalog.logoFor(b) && b.story)].slice(0, 8);

  const chips: [string, string][] = [
    ["/watches?price=-500", t("chips.under500")],
    ["/watches?dia=36-39", t("chips.size38")],
    ["/watches?style=diver", t("chips.diver")],
    ["/watches?cal=seiko_nh35", t("chips.nh35")],
    ["/watches?mat=titanium_gr2,titanium_gr5", t("chips.titanium")],
    ["/watches?style=gmt", t("chips.gmt")],
  ];

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={jsonLd({ "@context": "https://schema.org", "@type": "WebSite", name: "Lugworthy", url: SITE_URL, potentialAction: { "@type": "SearchAction", target: `${SITE_URL}/search?q={q}`, "query-input": "required name=q" } })} />
      <section className="border-b border-line">
        <div className="mx-auto max-w-7xl px-4 py-12 md:py-16">
          <h1 className="max-w-3xl font-serif text-4xl font-semibold tracking-tight md:text-5xl">{t("home.heroTitle")}</h1>
          <p className="mt-3 max-w-2xl text-lg text-muted">{t("home.heroBody", { brands: stats.brands, countries: stats.countries })}</p>
          <form action="/watches" role="search" className="mt-6 flex max-w-2xl gap-2">
            <label htmlFor="home-q" className="sr-only">{t("nav.search")}</label>
            <input id="home-q" name="q" type="search" className="input h-12 text-base" placeholder={t("nav.searchPlaceholder")} />
            <button className="btn btn-primary h-12">{t("nav.search")}</button>
          </form>
          <ul className="mt-4 flex flex-wrap gap-2">
            {chips.map(([href, label]) => (
              <li key={href}><Link className="chip" href={href}>{label}</Link></li>
            ))}
          </ul>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-10">
        <div className="mb-4 flex items-baseline justify-between">
          <h2 className="text-2xl font-semibold">{t("home.newReleases")}</h2>
          <Link className="link text-sm" href="/watches">{t("home.seeAll")}</Link>
        </div>
        <ModelGrid models={newReleases} />
      </section>

      {featured && (
        <section className="mx-auto max-w-7xl px-4 py-6">
          <div className="card grid gap-6 overflow-hidden md:grid-cols-[1fr_2fr]">
            <div className="flex flex-col justify-center gap-2 bg-surface-2 p-6">
              <p className="eyebrow">{t("home.featuredBrand")}</p>
              <h2 className="font-serif text-3xl font-semibold">{featured.name}</h2>
              {featured.story && <p className="text-muted">{featured.story}</p>}
              <Link className="btn mt-2 self-start" href={`/brands/${featured.slug}`}>{t("brand.models")} →</Link>
            </div>
            <div className="p-4 md:py-6 md:pr-6 md:pl-0">
              <ModelGrid models={featuredModels} showBrand={false} />
            </div>
          </div>
        </section>
      )}

      <section className="mx-auto grid max-w-7xl gap-6 px-4 py-10 md:grid-cols-2">
        <div>
          <h2 className="mb-4 text-2xl font-semibold">{t("home.browseByStyle")}</h2>
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {STYLE_TILES.map((s) => (
              <li key={s}>
                <Link href={`/styles/${s}`} className="card flex h-20 items-end p-3 font-semibold hover:border-ink">{t(`enum.style.${s}`)}</Link>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <h2 className="mb-4 text-2xl font-semibold">{t("home.latestVideo")}</h2>
          <div className="card flex aspect-video items-center justify-center p-6 text-center text-muted">{t("home.videoSoon")}</div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-6">
        <div className="mb-4 flex items-baseline justify-between">
          <h2 className="text-2xl font-semibold">{t("home.newBrands")}</h2>
          <Link className="link text-sm" href="/brands">{t("home.seeAll")}</Link>
        </div>
        <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {newBrands.map((b) => (
            <li key={b.slug}><BrandCard brand={b} modelCount={catalog.modelsForBrand(b.slug).length} logo={catalog.logoFor(b)} /></li>
          ))}
        </ul>
      </section>
    </>
  );
}
