import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { BrandLogo } from "@/components/BrandLogo";
import { ModelCard } from "@/components/ModelCard";
import { StyleFilteredGrid } from "@/components/StyleFilteredGrid";
import { countryName } from "@/lib/countries";
import { brandPage, brandSlugs } from "@/lib/site-data";
import { metres, mm, money, shortDate } from "@/lib/format";
import { EXHIBIT_URL, SITE_URL, jsonLd } from "@/lib/site";
import { brandThemeStyle } from "@/lib/theme";

type P = Promise<{ brand: string }>;

export async function generateStaticParams() {
  return (await brandSlugs()).map((brand) => ({ brand }));
}

export async function generateMetadata({ params }: { params: P }): Promise<Metadata> {
  const b = (await brandPage((await params).brand))?.brand;
  if (!b) return {};
  const where = [b.city, b.country ? countryName(b.country) : null].filter(Boolean).join(", ");
  return {
    title: `${b.name} watches`,
    description: b.story ?? `${b.name}${where ? `, ${where}` : ""}. Every model and spec, measured.`,
    alternates: { canonical: `/brands/${b.slug}` },
  };
}

function range(vals: (number | null)[], fmt: (v: number) => string | null) {
  const v = vals.filter((x): x is number => x != null);
  if (!v.length) return null;
  const lo = Math.min(...v), hi = Math.max(...v);
  return lo === hi ? fmt(lo) : `${fmt(lo)} – ${fmt(hi)}`;
}

// Cached (ISR). The ?style= chips filter in the browser, so the page never needs the query string.
export default async function BrandPage({ params }: { params: P }) {
  const { brand: slug } = await params;
  // This brand and its watch cards only.
  const data = await brandPage(slug);
  if (!data) notFound();
  const { brand, models, logo } = data;
  const t = await getTranslations();
  const styles = [...new Set(models.flatMap((m) => m.styles))].filter((s) => s !== "other");
  const place = [brand.city, brand.country ? countryName(brand.country) : brand.countryLabel].filter(Boolean).join(", ");
  // With watches listed, these are already the live lowest and highest variant prices.
  const { priceMin, priceMax } = brand;
  const site = brand.websiteUrl ? `${brand.websiteUrl}${brand.websiteUrl.includes("?") ? "&" : "?"}utm_source=lugworthy&utm_medium=directory` : null;

  const summary = models.length
    ? [
        [t("spec.caseDiameterMm"), range(models.map((m) => m.specs.caseDiameterMm), mm)],
        [t("spec.lugToLugMm"), range(models.map((m) => m.specs.lugToLugMm), mm)],
        [t("spec.waterResistanceM"), range(models.map((m) => m.specs.waterResistanceM), metres)],
        [t("facet.mov"), [...new Set(models.map((m) => m.specs.movementType).filter(Boolean))].map((x) => t(`enum.mov.${x}`)).join(", ") || null],
        [t("facet.cal"), [...new Set(models.map((m) => m.specs.caliber).filter(Boolean))].join(", ") || null],
      ].filter(([, v]) => v)
    : [];

  const f = brand.facts;
  const sizes = f?.caseSizeMm ? (f.caseSizeMm[0] === f.caseSizeMm[1] ? mm(f.caseSizeMm[0]) : `${mm(f.caseSizeMm[0])} – ${mm(f.caseSizeMm[1])}`) : null;
  const glance = [
    [t("brand.founded"), brand.founded ? String(brand.founded) : null],
    [t("brand.movement"), f?.movement ? f.movement.charAt(0).toUpperCase() + f.movement.slice(1) : null],
    [t("brand.caliberFamilies"), f?.caliberFamilies.length ? f.caliberFamilies.join(", ") : null],
    [t("brand.calibers"), f?.calibers.length ? f.calibers.join(", ") : null],
    [t("brand.caseSizes"), sizes],
    [t("brand.typicalPrice"), f?.typicalPriceUsd ? `≈ ${money(f.typicalPriceUsd)}` : null],
  ].filter(([, v]) => v);

  return (
    <div style={brandThemeStyle(brand)}>
      <script type="application/ld+json" dangerouslySetInnerHTML={jsonLd([
        { "@context": "https://schema.org", "@type": "Brand", name: brand.name, url: brand.websiteUrl ?? undefined, description: brand.story ?? undefined, sameAs: [brand.websiteUrl, brand.instagram].filter(Boolean) },
        { "@context": "https://schema.org", "@type": "BreadcrumbList", itemListElement: [
          { "@type": "ListItem", position: 1, name: "Brands", item: `${SITE_URL}/brands` },
          { "@type": "ListItem", position: 2, name: brand.name, item: `${SITE_URL}/brands/${brand.slug}` },
        ] },
      ])} />

      {/* BrandHero: neutral until the brand claims the page and licenses images (doc 08). */}
      <section className="border-b border-line" style={{ background: "var(--brand-primary)", color: "var(--brand-on-primary)" }}>
        <div className="mx-auto max-w-7xl px-4 py-10">
          <nav aria-label="Breadcrumb" className="mb-4 text-sm opacity-80">
            <Link className="link" href="/brands">{t("nav.brands")}</Link> <span aria-hidden>/</span> {brand.name}
          </nav>
          <div className="flex flex-wrap items-center gap-4">
            <BrandLogo name={brand.name} url={logo} size="lg" />
            <div>
              <h1 className="text-4xl md:text-5xl">{brand.name}</h1>
              <p className="mt-1 opacity-80">
                {[place || null, priceMin != null ? `${money(priceMin)}${priceMax && priceMax !== priceMin ? `–${money(priceMax)}` : ""}` : brand.priceBand ? t(`enum.band.${brand.priceBand}`) : null].filter(Boolean).join(" · ")}
              </p>
            </div>
            <div className="ml-auto flex flex-wrap gap-2">
              {brand.enPuntoExhibitor && <span className="chip font-semibold">Seen at En Punto</span>}
              {brand.claimStatus === "claimed" && <span className="chip font-semibold">Verified</span>}
              {site && <a className="btn" href={site} rel="noopener" target="_blank">{t("brand.visit", { brand: brand.name })}</a>}
            </div>
          </div>
        </div>
      </section>

      <div className="mx-auto grid max-w-7xl gap-10 px-4 py-8 lg:grid-cols-[1fr_300px]">
        <div className="min-w-0">
          {brand.story && (
            <section className="mb-8 max-w-prose">
              <h2 className="mb-2 text-3xl">{t("brand.story")}</h2>
              <p className="text-lg leading-relaxed">{brand.story}</p>
              {brand.styleTags.length > 0 && (
                <p className="mt-3 flex flex-wrap gap-1.5">
                  {brand.styleTags.map((tag) => <span key={tag} className="chip text-sm">{tag}</span>)}
                </p>
              )}
            </section>
          )}

          <section aria-labelledby="models-h">
            <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
              <h2 id="models-h" className="text-3xl">{t("brand.models")} <span className="tabular text-base font-normal text-muted">({models.length})</span></h2>
              {brand.lastSyncedAt && (
                <p className="text-xs text-muted">
                  {models.some((m) => m.origin === "site")
                    ? t("brand.fromSite", { date: shortDate(brand.lastSyncedAt), soldOut: models.filter((m) => !m.variants.some((v) => v.available)).length })
                    : t("brand.lastSync", { date: shortDate(brand.lastSyncedAt) })}
                </p>
              )}
            </div>
              <StyleFilteredGrid
                basePath={`/brands/${slug}`}
                allLabel={t("brand.filterAll")}
                styles={styles.map((s) => ({ value: s, label: t(`enum.style.${s}`) }))}
                items={models.map((m) => ({ key: m.slug, styles: m.styles, node: <ModelCard model={m} showBrand={false} /> }))}
                empty={<p className="card p-6 text-muted">{t("brand.noModels", { brand: brand.name })}</p>}
              />
          </section>

          <section className="mt-10" aria-labelledby="videos-h">
            <h2 id="videos-h" className="mb-2 text-3xl">{t("brand.videos")}</h2>
            <p className="text-muted">{t("brand.noVideos")}</p>
          </section>
        </div>

        <aside className="flex flex-col gap-4">
          {summary.length > 0 && (
            <section className="card p-4">
              <h2 className="mb-2 font-semibold">{t("brand.specSummary")}</h2>
              <dl className="tabular grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm">
                {summary.map(([k, v]) => (
                  <div key={k as string} className="contents"><dt className="text-muted">{k}</dt><dd>{v}</dd></div>
                ))}
              </dl>
            </section>
          )}
          {glance.length > 0 && (
            <section className="card p-4">
              <h2 className="mb-2 font-semibold">{t("brand.atAGlance")}</h2>
              <dl className="tabular grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm">
                {glance.map(([k, v]) => (
                  <div key={k as string} className="contents"><dt className="text-muted">{k}</dt><dd>{v}</dd></div>
                ))}
              </dl>
              {f && (
                <p className="mt-2 text-xs text-muted">
                  <a className="link" href={f.source} rel="noopener" target="_blank">
                    {f.checkedAt ? t("brand.factsSource", { source: "Coroa microbrand guide", date: f.checkedAt }) : t("brand.factsSourceNoDate", { source: "Coroa microbrand guide" })}
                  </a>
                </p>
              )}
            </section>
          )}
          <section className="card p-4">
            <h2 className="mb-1 font-semibold">{t("brand.whereToBuy")}</h2>
            <p className="text-sm text-muted">{t("brand.direct")}</p>
            {site && <a className="link mt-1 inline-block text-sm" href={site} rel="noopener" target="_blank">{brand.websiteUrl?.replace(/^https?:\/\/(www\.)?/, "").replace(/\/$/, "")} ↗</a>}
          </section>
          {brand.claimStatus !== "claimed" && (
            <section className="card p-4">
              <h2 className="mb-1 font-semibold">{t("brand.unclaimedTitle")}</h2>
              <p className="text-sm text-muted">{t("brand.unclaimedBody")}</p>
              <Link className="btn btn-sm mt-3" href={`/for-brands?brand=${brand.slug}`}>{t("brand.claim")}</Link>
            </section>
          )}
          <section className="card p-4">
            <p className="text-sm">{t("brand.exhibit")}</p>
            <a className="btn btn-sm mt-3" href={EXHIBIT_URL} rel="noopener" target="_blank" data-event="exhibit_cta_clicked">{t("brand.exhibitCta")} ↗</a>
          </section>
        </aside>
      </div>
    </div>
  );
}
