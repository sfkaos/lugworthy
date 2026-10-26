import Form from "next/form";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { FilterRail, type Bounds } from "@/components/FilterRail";
import { ModelGrid } from "@/components/ModelCard";
import { SortSelect } from "@/components/SortSelect";
import { getCatalog, minPriceUsd } from "@/lib/data";
import { browse, MULTI_FACETS, parseFilters, toSearchParams, type Filters } from "@/lib/filters";
import { facetLabels } from "@/lib/labels";

export type WatchesSearch = Record<string, string | string[] | undefined>;

function bounds(values: number[], step: number, unit: string, pad = 0): Bounds {
  const v = values.filter((x) => Number.isFinite(x));
  if (!v.length) return { min: 0, max: 1, step, unit };
  return { min: Math.floor(Math.min(...v) / step) * step - pad, max: Math.ceil(Math.max(...v) / step) * step + pad, step, unit };
}

/** The watch browser. /watches renders it unfiltered (cached); /browse/watches renders filtered views. */
export async function WatchesView({ search }: { search: WatchesSearch }) {
  const catalog = await getCatalog();
  const t = await getTranslations();
  const f = parseFilters(search);
  const all = catalog.publishedModels();
  const r = browse(all, f);
  const labels = await facetLabels(r.counts);

  const b = {
    price: bounds(all.map((m) => minPriceUsd(m) / 100), 50, ""),
    dia: bounds(all.map((m) => m.specs.caseDiameterMm ?? NaN), 0.5, "mm"),
    l2l: bounds(all.map((m) => m.specs.lugToLugMm ?? NaN), 0.5, "mm"),
    thk: bounds(all.map((m) => m.specs.thicknessMm ?? m.specs.thicknessInclCrystalMm ?? NaN), 0.5, "mm"),
  };

  // Active chips with a link that removes each one.
  const chips: { label: string; href: string }[] = [];
  const without = (patch: Partial<Filters>) => `/watches?${toSearchParams({ ...f, ...patch, page: undefined })}`;
  if (f.q) chips.push({ label: `“${f.q}”`, href: without({ q: undefined }) });
  const rangeLabel = (k: "price" | "dia" | "l2l" | "thk", unit: string) => {
    const v = f[k];
    if (!v) return;
    const lo = v.min != null ? `${unit === "$" ? "$" : ""}${v.min}` : "";
    const hi = v.max != null ? `${unit === "$" ? "$" : ""}${v.max}` : "";
    chips.push({ label: `${t(`facet.${k}`)}: ${lo || "…"}–${hi || "…"}${unit !== "$" ? ` ${unit}` : ""}`, href: without({ [k]: undefined }) });
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
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-semibold">{t("browse.title")}</h1>
          <p className="tabular mt-1 text-muted" aria-live="polite">{t("browse.count", { count: r.total })}</p>
        </div>
        <Form action="/watches" role="search" className="flex w-full max-w-md gap-2">
          {Object.entries(Object.fromEntries(toSearchParams({ ...f, q: undefined, page: undefined }))).map(([k, v]) => (
            <input key={k} type="hidden" name={k} value={v} />
          ))}
          <label htmlFor="browse-q" className="sr-only">{t("nav.search")}</label>
          <input id="browse-q" name="q" type="search" defaultValue={f.q} className="input" placeholder={t("nav.searchPlaceholder")} />
          <button className="btn">{t("nav.search")}</button>
        </Form>
      </div>

      <div className="grid gap-6 lg:grid-cols-[260px_1fr]">
        <aside aria-label={t("browse.filters")}>
          <FilterRail filters={f} counts={r.counts} wrCounts={r.wrCounts} bounds={b} labels={labels} total={r.total} />
        </aside>
        <div className="min-w-0">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <ul className="flex flex-wrap gap-2" aria-label="Active filters">
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
            <SortSelect value={sort} query={toSearchParams({ ...f, page: undefined }).toString()} />
          </div>

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
          <p className="mt-8 text-sm text-muted">{t("browse.coverage", { models: all.length })}</p>
        </div>
      </div>
    </div>
  );
}
