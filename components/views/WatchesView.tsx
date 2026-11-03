import Form from "next/form";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { FilterRail, type Bounds } from "@/components/FilterRail";
import { ModelGrid } from "@/components/ModelCard";
import { SortSelect } from "@/components/SortSelect";
import { MULTI_FACETS, PRICE_STOPS, activeCount, formatRangeValue, linearStops, parseFilters, rangeText, toSearchParams, type Filters } from "@/lib/filters";
import { facetLabels } from "@/lib/labels";
import { browseBounds, browseWatches } from "@/lib/site-data";

export type WatchesSearch = Record<string, string | string[] | undefined>;

/** Half-millimetre slider stops between the catalog's 0.5th and 99.5th percentiles. */
const mm = (range: [number | null, number | null]): Bounds => ({ stops: linearStops(range[0], range[1], 0.5), unit: "mm" });

/** The watch browser. /watches renders it unfiltered (cached); /browse/watches renders filtered views. */
export async function WatchesView({ search }: { search: WatchesSearch }) {
  const t = await getTranslations();
  const f = parseFilters(search);
  // One page of results plus counts, all worked out in the database.
  const [r, range] = await Promise.all([browseWatches(f), browseBounds()]);
  const labels = await facetLabels(r.counts);

  const b = { price: { stops: PRICE_STOPS, unit: "$" }, dia: mm(range.dia), l2l: mm(range.l2l), thk: mm(range.thk) };

  // Active chips with a link that removes each one.
  const chips: { label: string; href: string }[] = [];
  const without = (patch: Partial<Filters>) => `/watches?${toSearchParams({ ...f, ...patch, page: undefined })}`;
  if (f.q) chips.push({ label: `“${f.q}”`, href: without({ q: undefined }) });
  const rangeLabel = (k: "price" | "dia" | "l2l" | "thk", unit: string) => {
    const text = rangeText(f[k], (n) => formatRangeValue(n, unit));
    if (text) chips.push({ label: `${k === "price" ? t("browse.price") : t(`facet.${k}`)}: ${text}`, href: without({ [k]: undefined }) });
  };
  rangeLabel("price", "$");
  rangeLabel("dia", "mm");
  rangeLabel("l2l", "mm");
  rangeLabel("thk", "mm");
  if (f.wr) chips.push({ label: t("facet.wrAtLeast", { m: f.wr }), href: without({ wr: undefined }) });
  for (const k of MULTI_FACETS) {
    for (const v of (f[k as keyof Filters] as string[] | undefined) ?? []) {
      const rest = ((f[k as keyof Filters] as string[]) ?? []).filter((x) => x !== v);
      chips.push({ label: labels[k]?.[v] ?? v, href: without({ [k]: rest.length ? rest : undefined }) });
    }
  }

  const pageHref = (p: number) => `/watches?${toSearchParams({ ...f, page: p > 1 ? p : undefined })}`;
  const sort = f.sort ?? (f.q ? "relevance" : "newest");

  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      <header className="mb-6">
        <h1 className="text-4xl md:text-5xl">{t("browse.title")}</h1>
        <p className="tabular mt-1 text-muted" aria-live="polite">{t("browse.count", { count: r.total })}</p>
      </header>

      <div className="grid gap-6 lg:grid-cols-[260px_minmax(0,1fr)] lg:gap-10">
        <aside aria-label={t("browse.filters")} className="lg:sticky lg:top-24 lg:max-h-[calc(100dvh-7rem)] lg:self-start lg:overflow-y-auto lg:pr-3">
          <div className="mb-1 hidden h-9 items-center justify-between lg:flex">
            <h2 className="text-sm font-semibold uppercase tracking-wider">{t("browse.filters")}</h2>
            {activeCount(f) > 0 && <Link href="/watches" className="link text-sm">{t("browse.clearAll")}</Link>}
          </div>
          <FilterRail filters={f} counts={r.counts} wrCounts={r.wrCounts} bounds={b} labels={labels} total={r.total} />
        </aside>
        <div className="min-w-0">
          <div className="mb-4 flex flex-wrap items-center gap-3">
            <Form key={toSearchParams({ ...f, page: undefined }).toString()} action="/watches" role="search" className="flex min-w-0 flex-1 basis-64 gap-2">
              {Object.entries(Object.fromEntries(toSearchParams({ ...f, q: undefined, page: undefined }))).map(([k, v]) => (
                <input key={k} type="hidden" name={k} value={v} />
              ))}
              <label htmlFor="browse-q" className="sr-only">{t("browse.searchWithin")}</label>
              <input id="browse-q" name="q" type="search" defaultValue={f.q} className="input h-9 min-h-9 text-sm" placeholder={t("browse.searchWithin")} />
              <button className="btn h-9 min-h-9">{t("nav.search")}</button>
            </Form>
            <SortSelect value={sort} query={toSearchParams({ ...f, page: undefined }).toString()} />
          </div>
          {chips.length > 0 && (
            <ul className="mb-4 flex flex-wrap gap-2" aria-label="Active filters">
              {chips.map((c) => (
                <li key={c.href + c.label}>
                  <Link href={c.href} scroll={false} className="chip" aria-label={t("browse.remove", { label: c.label })}>
                    {c.label} <span aria-hidden>×</span>
                  </Link>
                </li>
              ))}
              {chips.length > 1 && (
                <li><Link href="/watches" className="chip text-muted">{t("browse.clearAll")}</Link></li>
              )}
            </ul>
          )}

          {r.total === 0 ? (
            <div className="card p-8 text-center">
              <h2 className="text-xl font-semibold">{t("browse.noMatches")}</h2>
              <p className="mt-1 text-muted">{t("browse.noMatchesBody")}</p>
              <ul className="mt-4 flex flex-wrap justify-center gap-2">
                {chips.slice(-3).reverse().map((c) => (
                  <li key={c.href}><Link className="chip" href={c.href}>{t("browse.remove", { label: c.label })}</Link></li>
                ))}
              </ul>
            </div>
          ) : (
            <ModelGrid models={r.items} />
          )}

          {r.pages > 1 && (
            <nav aria-label="Pagination" className="mt-8 flex items-center justify-center gap-3">
              {r.page > 1 && <Link className="btn" href={pageHref(r.page - 1)}>{t("browse.prev")}</Link>}
              <span className="tabular text-sm text-muted">{t("browse.page", { page: r.page, pages: r.pages })}</span>
              {r.page < r.pages && <Link className="btn" href={pageHref(r.page + 1)}>{t("browse.next")}</Link>}
            </nav>
          )}
          <p className="mt-8 text-sm text-muted">{t("browse.coverage", { models: range.models })}</p>
        </div>
      </div>
    </div>
  );
}
