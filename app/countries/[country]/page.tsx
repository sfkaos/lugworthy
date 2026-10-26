import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { BrandCard } from "@/components/BrandCard";
import { Hub } from "@/components/Hub";
import { countryName } from "@/lib/countries";
import { countryCodes, countryHub } from "@/lib/site-data";

type P = Promise<{ country: string }>;

export async function generateStaticParams() {
  return (await countryCodes()).map((c) => ({ country: c.toLowerCase() }));
}

export async function generateMetadata({ params }: { params: P }): Promise<Metadata> {
  const t = await getTranslations();
  const iso = (await params).country.toUpperCase();
  return { title: t("hub.countryTitle", { country: countryName(iso) }), alternates: { canonical: `/countries/${iso.toLowerCase()}` } };
}

export default async function CountryHub({ params }: { params: P }) {
  const iso = (await params).country.toUpperCase();
  const { brands, models } = await countryHub(iso);
  if (!brands.length) notFound();
  const t = await getTranslations();
  const name = countryName(iso);
  return (
    <Hub path={`/countries/${iso.toLowerCase()}`} title={t("hub.countryTitle", { country: name })} intro={t("hub.countryIntro", { country: name })} models={models} browseHref={models.length ? `/watches?country=${iso}` : undefined} browseLabel={t("hub.browseAll")}>
      <ul className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {brands.map((b) => <li key={b.brand.slug}><BrandCard brand={b.brand} modelCount={b.modelCount} logo={b.logo} /></li>)}
      </ul>
    </Hub>
  );
}
