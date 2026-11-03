import type { Metadata } from "next";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { BrandCard } from "@/components/BrandCard";
import { ModelGrid } from "@/components/ModelCard";
import { searchSite } from "@/lib/site-data";

export const metadata: Metadata = { title: "Search", robots: { index: false, follow: true } };

export default async function SearchPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const t = await getTranslations();
  const q = ((await searchParams).q ?? "").trim();
  if (!q) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-10">
        <h1 className="text-4xl md:text-5xl">{t("search.title")}</h1>
        <p className="mt-2 text-muted">{t("search.prompt")}</p>
      </div>
    );
  }
  // Up to 12 brands and 60 watches, matched and ranked in the database.
  const { brands, models } = await searchSite(q);

  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      <h1 className="text-4xl md:text-5xl">{t("search.results", { q })}</h1>
      {!brands.length && !models.length && <p className="card mt-6 p-6 text-muted">{t("search.none", { q })}</p>}
      {brands.length > 0 && (
        <section className="mt-6">
          <h2 className="mb-3 text-3xl">{t("search.brands")}</h2>
          <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {brands.map((b) => <li key={b.brand.slug}><BrandCard brand={b.brand} modelCount={b.modelCount} logo={b.logo} /></li>)}
          </ul>
        </section>
      )}
      {models.length > 0 && (
        <section className="mt-10">
          <div className="mb-3 flex items-baseline justify-between">
            <h2 className="text-3xl">{t("search.watches")} <span className="tabular text-base font-normal text-muted">({models.length})</span></h2>
            <Link className="link text-sm" href={`/watches?q=${encodeURIComponent(q)}`}>{t("hub.browseAll")}</Link>
          </div>
          <ModelGrid models={models.slice(0, 24)} />
        </section>
      )}
    </div>
  );
}

