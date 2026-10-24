import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { CaseOutline } from "@/components/CaseOutline";
import { ModelGrid } from "@/components/ModelCard";
import { ModelPurchase } from "@/components/ModelPurchase";
import { SpecTable, specRows } from "@/components/SpecTable";
import { getBrand, getModel, modelId, modelsForBrand, publishedModels, similarModels } from "@/lib/data";
import { mm, shortDate, wristFit } from "@/lib/format";
import { SITE_URL, jsonLd } from "@/lib/site";
import { brandThemeStyle } from "@/lib/theme";

type P = Promise<{ brand: string; model: string }>;

export function generateStaticParams() {
  return publishedModels().map((m) => ({ brand: m.brandSlug, model: m.slug }));
}
export const dynamicParams = false;

export async function generateMetadata({ params }: { params: P }): Promise<Metadata> {
  const { brand, model } = await params;
  const m = getModel(brand, model);
  const b = getBrand(brand);
  if (!m || !b) return {};
  const s = m.specs;
  const bits = [mm(s.caseDiameterMm), s.caliber, s.waterResistanceM ? `${s.waterResistanceM} m` : null].filter(Boolean).join(", ");
  return {
    title: `${b.name} ${m.name}`,
    description: `${b.name} ${m.name}${bits ? `: ${bits}` : ""}. Full specs, variants and prices.`,
    // Variant URLs (?v=) canonicalize to the model (doc 11).
    alternates: { canonical: `/brands/${b.slug}/${m.slug}` },
  };
}

export default async function ModelPage({ params, searchParams }: { params: P; searchParams: Promise<{ v?: string }> }) {
  const { brand: bSlug, model: mSlug } = await params;
  const { v } = await searchParams;
  const model = getModel(bSlug, mSlug);
  const brand = getBrand(bSlug);
  if (!model || !brand) notFound();
  const t = await getTranslations();
  const s = model.specs;
  const initial = Math.min(Math.max(Number(v ?? 0) || 0, 0), model.variants.length - 1);
  const more = modelsForBrand(brand.slug).filter((m) => m.slug !== model.slug).slice(0, 4);
  const similar = similarModels(model);
  const fit = wristFit(s.lugToLugMm);
  const url = `${SITE_URL}/brands/${brand.slug}/${model.slug}`;

  const props = specRows(model, t).flatMap((g) => g.rows).filter((r) => r.value).map((r) => ({ "@type": "PropertyValue", name: t(`spec.${r.key}`), value: r.value }));
  const prices = model.variants.map((x) => x.priceUsd / 100);

  return (
    <div style={brandThemeStyle(brand)}>
      <script type="application/ld+json" dangerouslySetInnerHTML={jsonLd([
        {
          "@context": "https://schema.org", "@type": "Product", name: `${brand.name} ${model.name}`, url,
          brand: { "@type": "Brand", name: brand.name }, sku: model.variants[0]?.sku ?? undefined,
          additionalProperty: props,
          offers: {
            "@type": "AggregateOffer", priceCurrency: "USD", lowPrice: Math.min(...prices), highPrice: Math.max(...prices), offerCount: model.variants.length,
            availability: model.variants.some((x) => x.available) ? "https://schema.org/InStock" : "https://schema.org/OutOfStock",
            url: model.sourceUrl ?? url,
          },
        },
        { "@context": "https://schema.org", "@type": "BreadcrumbList", itemListElement: [
          { "@type": "ListItem", position: 1, name: "Brands", item: `${SITE_URL}/brands` },
          { "@type": "ListItem", position: 2, name: brand.name, item: `${SITE_URL}/brands/${brand.slug}` },
          { "@type": "ListItem", position: 3, name: model.name, item: url },
        ] },
      ])} />

      <div className="mx-auto max-w-7xl px-4 py-6">
        <nav aria-label="Breadcrumb" className="mb-4 text-sm text-muted">
          <Link className="link" href="/brands">{t("nav.brands")}</Link> <span aria-hidden>/</span>{" "}
          <Link className="link" href={`/brands/${brand.slug}`}>{brand.name}</Link> <span aria-hidden>/</span> {model.name}
        </nav>

        <div className="grid gap-8 lg:grid-cols-[1.1fr_1fr]">
          {/* Gallery placeholder: no brand images until the brand grants a license (doc 08). */}
          <figure className="card flex flex-col items-center justify-center gap-3 bg-surface-2 p-6 text-muted">
            <CaseOutline diameter={s.caseDiameterMm} lugToLug={s.lugToLugMm} lugWidth={s.lugWidthMm} className="aspect-square w-full max-w-md" />
            <figcaption className="text-center text-sm">
              {[mm(s.caseDiameterMm), s.lugToLugMm ? `${mm(s.lugToLugMm)} lug-to-lug` : null].filter(Boolean).join(" · ")}
              <br />
              <span className="text-xs">{t("card.noImage", { brand: brand.name })}</span>
            </figcaption>
          </figure>

          <div className="flex flex-col gap-5">
            <div>
              <p className="eyebrow"><Link href={`/brands/${brand.slug}`}>{brand.name}</Link></p>
              <h1 className="mt-1 font-serif text-3xl font-semibold tracking-tight md:text-4xl">{model.name}</h1>
              <p className="mt-2 flex flex-wrap gap-1.5">
                {model.styles.filter((x) => x !== "other").map((x) => (
                  <Link key={x} href={`/styles/${x}`} className="chip text-sm">{t(`enum.style.${x}`)}</Link>
                ))}
                {model.limitedEdition && <span className="chip text-sm font-semibold">{t("model.limited")}</span>}
              </p>
              {fit && <p className="mt-2 text-sm text-muted">{t("model.fits", fit)}</p>}
            </div>
            <ModelPurchase variants={model.variants} initialIndex={initial} brandName={brand.name} compareId={modelId(model)} status={model.status} />
          </div>
        </div>

        <section className="mt-12" aria-labelledby="specs-h">
          <h2 id="specs-h" className="mb-1 text-2xl font-semibold">{t("model.specs")}</h2>
          {!model.reviewed && (
            <p className="mb-4 max-w-3xl text-sm text-muted">{t("model.importedNote", { brand: brand.name, date: shortDate(model.importedAt) })}</p>
          )}
          <SpecTable model={model} />
        </section>

        <section className="mt-12" aria-labelledby="vid-h">
          <h2 id="vid-h" className="mb-2 text-2xl font-semibold">{t("model.videos")}</h2>
          <p className="text-muted">{t("model.noVideos")}</p>
        </section>

        {more.length > 0 && (
          <section className="mt-12">
            <h2 className="mb-4 text-2xl font-semibold">{t("model.moreFrom", { brand: brand.name })}</h2>
            <ModelGrid models={more} showBrand={false} />
          </section>
        )}
        {similar.length > 0 && (
          <section className="mt-12">
            <h2 className="mb-4 text-2xl font-semibold">{t("model.similar")}</h2>
            <ModelGrid models={similar} />
          </section>
        )}
      </div>
    </div>
  );
}
