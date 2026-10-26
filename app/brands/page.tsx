import type { Metadata } from "next";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { BrandCard } from "@/components/BrandCard";
import { countryName } from "@/lib/countries";
import { getCatalog } from "@/lib/data";
import type { Brand } from "@/lib/types";

type SP = Promise<{ letter?: string; country?: string; band?: string; tag?: string; specs?: string; page?: string }>;
const PER_PAGE = 60;
const BANDS = ["budget", "affordable", "mid", "upper_mid", "high"] as const;

export async function generateMetadata({ searchParams }: { searchParams: SP }): Promise<Metadata> {
  const sp = await searchParams;
  const filtered = Object.values(sp).some(Boolean);
  return { title: "Watch brands A–Z", alternates: { canonical: "/brands" }, robots: filtered ? { index: false, follow: true } : undefined };
}

const letterOf = (b: Brand) => {
  const c = b.name.normalize("NFKD").replace(/[̀-ͯ]/g, "").charAt(0).toUpperCase();
  return /[A-Z]/.test(c) ? c : "#";
};

export default async function BrandsPage({ searchParams }: { searchParams: SP }) {
  const catalog = await getCatalog();
  const t = await getTranslations();
  const sp = await searchParams;
  const all = catalog.publishedBrands();
  const counts = new Map(all.map((b) => [b.slug, catalog.modelsForBrand(b.slug).length]));
  const countries = [...new Set(all.map((b) => b.country).filter((c): c is string => !!c))].sort((a, b) => countryName(a).localeCompare(countryName(b)));
  const tagCounts = new Map<string, number>();
  for (const b of all) for (const tag of b.styleTags) tagCounts.set(tag, (tagCounts.get(tag) ?? 0) + 1);
  const tags = [...tagCounts.entries()].filter(([, n]) => n >= 4).sort((a, b) => b[1] - a[1]).map(([tag]) => tag);

  let list = all;
  if (sp.letter) list = list.filter((b) => letterOf(b) === sp.letter);
  if (sp.country) list = list.filter((b) => b.country === sp.country!.toUpperCase());
  if (sp.band) list = list.filter((b) => b.priceBand === sp.band);
  if (sp.tag) list = list.filter((b) => b.styleTags.includes(sp.tag!));
  if (sp.specs) list = list.filter((b) => (counts.get(b.slug) ?? 0) > 0);
  // Brands with synced specs first, then A–Z.
  list = [...list].sort((a, b) => Number((counts.get(b.slug) ?? 0) > 0) - Number((counts.get(a.slug) ?? 0) > 0) || a.name.localeCompare(b.name, "en", { sensitivity: "base" }));

  const pages = Math.max(1, Math.ceil(list.length / PER_PAGE));
  const page = Math.min(Math.max(Number(sp.page ?? 1) || 1, 1), pages);
  const shown = list.slice((page - 1) * PER_PAGE, page * PER_PAGE);
  const letters = [...new Set(all.map(letterOf))].sort();
  const qs = (patch: Record<string, string | undefined>) => {
    const next = new URLSearchParams(Object.entries({ ...sp, page: undefined, ...patch }).filter(([, v]) => v) as [string, string][]);
    const s = next.toString();
    return s ? `/brands?${s}` : "/brands";
  };

  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      <h1 className="text-3xl font-semibold">{t("brands.title")}</h1>
      <p className="mt-1 text-muted">{t("brands.intro", { count: all.length })}</p>

      <nav aria-label="A–Z" className="mt-5 flex flex-wrap gap-1">
        <Link href={qs({ letter: undefined })} className="chip h-8 min-h-8 px-2.5 text-sm" style={!sp.letter ? { borderColor: "var(--text)", fontWeight: 600 } : undefined}>{t("brands.all")}</Link>
        {letters.map((l) => (
          <Link key={l} href={qs({ letter: l })} className="chip h-8 min-h-8 w-8 justify-center px-0 text-sm" aria-current={sp.letter === l ? "page" : undefined} style={sp.letter === l ? { borderColor: "var(--text)", fontWeight: 600 } : undefined}>{l}</Link>
        ))}
      </nav>

      <form className="mt-4 flex flex-wrap items-end gap-3" action="/brands">
        {sp.letter && <input type="hidden" name="letter" value={sp.letter} />}
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-semibold">{t("brands.country")}</span>
          <select name="country" defaultValue={sp.country ?? ""} className="input h-9 min-h-9 w-48 text-sm">
            <option value="">{t("brands.all")}</option>
            {countries.map((c) => <option key={c} value={c}>{countryName(c)}</option>)}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-semibold">{t("brands.band")}</span>
          <select name="band" defaultValue={sp.band ?? ""} className="input h-9 min-h-9 w-40 text-sm">
            <option value="">{t("brands.all")}</option>
            {BANDS.map((b) => <option key={b} value={b}>{t(`enum.band.${b}`)}</option>)}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-semibold">{t("brands.tag")}</span>
          <select name="tag" defaultValue={sp.tag ?? ""} className="input h-9 min-h-9 w-48 text-sm">
            <option value="">{t("brands.all")}</option>
            {tags.map((tag) => <option key={tag} value={tag}>{tag}</option>)}
          </select>
        </label>
        <label className="flex h-9 items-center gap-2 text-sm">
          <input type="checkbox" name="specs" value="1" defaultChecked={!!sp.specs} className="h-4 w-4 accent-[var(--text)]" />
          {t("brands.withModels")}
        </label>
        <button className="btn btn-sm h-9">{t("browse.apply")}</button>
        {Object.values(sp).some(Boolean) && <Link className="link text-sm" href="/brands">{t("browse.clearAll")}</Link>}
      </form>

      <p className="tabular mt-6 text-sm text-muted" aria-live="polite">{t("brands.count", { count: list.length })}</p>
      {shown.length ? (
        <ul className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {shown.map((b) => <li key={b.slug}><BrandCard brand={b} modelCount={counts.get(b.slug) ?? 0} /></li>)}
        </ul>
      ) : (
        <p className="card mt-3 p-6 text-muted">{t("brands.empty")}</p>
      )}
      {pages > 1 && (
        <nav aria-label="Pagination" className="mt-8 flex items-center justify-center gap-3">
          {page > 1 && <Link className="btn" href={qs({ page: String(page - 1) })}>{t("browse.prev")}</Link>}
          <span className="tabular text-sm text-muted">{t("browse.page", { page, pages })}</span>
          {page < pages && <Link className="btn" href={qs({ page: String(page + 1) })}>{t("browse.next")}</Link>}
        </nav>
      )}
    </div>
  );
}
