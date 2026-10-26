import type { Metadata } from "next";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { BrandCard } from "@/components/BrandCard";
import { ModelGrid } from "@/components/ModelCard";
import { getCatalog } from "@/lib/data";
import { textScore, tokenize } from "@/lib/filters";

export const metadata: Metadata = { title: "Search", robots: { index: false, follow: true } };

export default async function SearchPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const catalog = await getCatalog();
  const t = await getTranslations();
  const q = ((await searchParams).q ?? "").trim();
  if (!q) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-10">
        <h1 className="text-3xl font-semibold">{t("search.title")}</h1>
        <p className="mt-2 text-muted">{t("search.prompt")}</p>
      </div>
    );
  }
  const tokens = tokenize(q);
  const brands = catalog.publishedBrands()
    .map((b) => {
      const hay = tokenize(`${b.name} ${b.city ?? ""} ${b.styleTags.join(" ")}`);
      const name = b.name.toLowerCase();
      let score = 0;
      if (name === q.toLowerCase()) score += 10;
      if (name.includes(q.toLowerCase())) score += 5;
      score += tokens.filter((tk) => hay.some((w) => w.startsWith(tk))).length * 2;
      return { b, score: tokens.every((tk) => hay.some((w) => w.startsWith(tk) || (tk.length >= 5 && w.length >= 4 && levenshtein1(w, tk)))) ? score : 0 };
    })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 12)
    .map((x) => x.b);
  const models = catalog.publishedModels()
    .map((m) => ({ m, s: textScore(m, q) }))
    .filter((x) => x.s > 0)
    .sort((a, b) => b.s - a.s)
    .map((x) => x.m);

  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      <h1 className="text-3xl font-semibold">{t("search.results", { q })}</h1>
      {!brands.length && !models.length && <p className="card mt-6 p-6 text-muted">{t("search.none", { q })}</p>}
      {brands.length > 0 && (
        <section className="mt-6">
          <h2 className="mb-3 text-xl font-semibold">{t("search.brands")}</h2>
          <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {brands.map((b) => <li key={b.slug}><BrandCard brand={b} modelCount={catalog.modelsForBrand(b.slug).length} logo={catalog.logoFor(b)} /></li>)}
          </ul>
        </section>
      )}
      {models.length > 0 && (
        <section className="mt-10">
          <div className="mb-3 flex items-baseline justify-between">
            <h2 className="text-xl font-semibold">{t("search.watches")} <span className="tabular text-base font-normal text-muted">({models.length})</span></h2>
            <Link className="link text-sm" href={`/watches?q=${encodeURIComponent(q)}`}>{t("hub.browseAll")}</Link>
          </div>
          <ModelGrid models={models.slice(0, 24)} />
        </section>
      )}
    </div>
  );
}

function levenshtein1(a: string, b: string) {
  if (Math.abs(a.length - b.length) > 1) return false;
  let i = 0, j = 0, e = 0;
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) { i++; j++; continue; }
    if (++e > 1) return false;
    if (a.length > b.length) i++; else if (b.length > a.length) j++; else { i++; j++; }
  }
  return e + (a.length - i) + (b.length - j) <= 1;
}
