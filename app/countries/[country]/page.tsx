import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { BrandCard } from "@/components/BrandCard";
import { Hub } from "@/components/Hub";
import { countryName } from "@/lib/countries";
import { getCatalog } from "@/lib/data";

type P = Promise<{ country: string }>;

export async function generateStaticParams() {
  const catalog = await getCatalog();
  return [...new Set(catalog.publishedBrands().map((b) => b.country).filter(Boolean))].map((c) => ({ country: c!.toLowerCase() }));
}

export async function generateMetadata({ params }: { params: P }): Promise<Metadata> {
  const t = await getTranslations();
  const iso = (await params).country.toUpperCase();
  return { title: t("hub.countryTitle", { country: countryName(iso) }), alternates: { canonical: `/countries/${iso.toLowerCase()}` } };
}

export default async function CountryHub({ params }: { params: P }) {
  const catalog = await getCatalog();
  const iso = (await params).country.toUpperCase();
  const brands = catalog.publishedBrands().filter((b) => b.country === iso);
  if (!brands.length) notFound();
  const t = await getTranslations();
  const slugs = new Set(brands.map((b) => b.slug));
  const models = catalog.publishedModels().filter((m) => slugs.has(m.brandSlug));
  const name = countryName(iso);
  return (
    <Hub path={`/countries/${iso.toLowerCase()}`} title={t("hub.countryTitle", { country: name })} intro={t("hub.countryIntro", { country: name })} models={models} browseHref={models.length ? `/watches?country=${iso}` : undefined} browseLabel={t("hub.browseAll")}>
      <ul className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {brands.map((b) => <li key={b.slug}><BrandCard brand={b} modelCount={catalog.modelsForBrand(b.slug).length} logo={catalog.logoFor(b)} /></li>)}
      </ul>
    </Hub>
  );
}
