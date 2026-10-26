import Form from "next/form";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { BrandCard } from "@/components/BrandCard";
import { countryName } from "@/lib/countries";
import { brandDirectory, type BrandsSearch } from "@/lib/site-data";

export type { BrandsSearch };
const PER_PAGE = 60;
const BANDS = ["budget", "affordable", "mid", "upper_mid", "high"] as const;

/** The brand directory. /brands renders it unfiltered (cached); /browse/brands renders filtered views. */
export async function BrandsView({ search: sp }: { search: BrandsSearch }) {
  const t = await getTranslations();
  // Only this page's 60 brands, plus the filter options, come from the database.
  const d = await brandDirectory(sp, PER_PAGE);
  const { letters, tags, page, pages, shown } = d;
  const countries = [...d.countries].sort((a, b) => countryName(a).localeCompare(countryName(b)));
  const qs = (patch: Record<string, string | undefined>) => {
    const next = new URLSearchParams(Object.entries({ ...sp, page: undefined, ...patch }).filter(([, v]) => v) as [string, string][]);
    const s = next.toString();
    return s ? `/brands?${s}` : "/brands";
  };

  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      <h1 className="text-3xl font-semibold">{t("brands.title")}</h1>
      <p className="mt-1 text-muted">{t("brands.intro", { count: d.brandCount })}</p>

      <nav aria-label="A–Z" className="mt-5 flex flex-wrap gap-1">
        <Link href={qs({ letter: undefined })} className="chip h-8 min-h-8 px-2.5 text-sm" aria-current={!sp.letter ? "page" : undefined}>{t("brands.all")}</Link>
        {letters.map((l) => (
          <Link key={l} href={qs({ letter: l })} className="chip h-8 min-h-8 w-8 justify-center px-0 text-sm" aria-current={sp.letter === l ? "page" : undefined}>{l}</Link>
        ))}
      </nav>

      <Form className="mt-4 flex flex-wrap items-end gap-3" action="/brands">
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
      </Form>

      <div>
      <p className="tabular mt-6 text-sm text-muted" aria-live="polite">{t("brands.count", { count: d.total })}</p>
      {shown.length ? (
        <ul className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {shown.map((b) => <li key={b.brand.slug}><BrandCard brand={b.brand} modelCount={b.modelCount} logo={b.logo} /></li>)}
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
    </div>
  );
}
