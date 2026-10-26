import type { Metadata } from "next";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { outlinePath } from "@/components/CaseOutline";
import { CompareFromTray, RemoveFromCompare } from "@/components/CompareFromTray";
import { specRows } from "@/components/SpecTable";
import { getCatalog, minPriceUsd, modelId } from "@/lib/data";
import { money } from "@/lib/format";
import type { Model } from "@/lib/types";

export const metadata: Metadata = { title: "Compare", robots: { index: false, follow: true } };

const COLORS = ["var(--text)", "var(--accent)", "var(--danger)", "var(--warning)"];

function Overlay({ models }: { models: Model[] }) {
  const size = 64;
  return (
    <svg viewBox={`${-size / 2} ${-size / 2} ${size} ${size}`} className="h-64 w-64" role="img" aria-label="Case outlines overlaid to scale">
      {models.map((m, i) => {
        const d = m.specs.caseDiameterMm ?? 40;
        const l2l = m.specs.lugToLugMm ?? d * 1.18;
        const lw = m.specs.lugWidthMm ?? d / 2;
        const { r, lugs } = outlinePath(d, l2l, lw);
        const guess = !m.specs.caseDiameterMm || !m.specs.lugToLugMm;
        return (
          <g key={modelId(m)} fill="none" stroke={COLORS[i]} strokeWidth={0.45} strokeDasharray={guess ? "1.2 0.8" : undefined}>
            <path d={lugs} />
            <circle r={r} />
          </g>
        );
      })}
    </svg>
  );
}

export default async function ComparePage({ searchParams }: { searchParams: Promise<{ ids?: string; diff?: string }> }) {
  const catalog = await getCatalog();
  const t = await getTranslations();
  const sp = await searchParams;
  const ids = (sp.ids ?? "").split(",").filter(Boolean).slice(0, 4);
  const models = ids.map((id) => catalog.getModelById(id)).filter((m): m is Model => !!m);
  const onlyDiff = sp.diff === "1";

  if (models.length === 0) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-10">
        <h1 className="mb-4 text-3xl font-semibold">{t("compare.title")}</h1>
        <CompareFromTray />
      </div>
    );
  }

  const rowsPer = models.map((m) => specRows(m, t));
  const groups = rowsPer[0].map((g, gi) => ({
    group: g.group,
    rows: g.rows.map((r, ri) => ({ key: r.key, values: rowsPer.map((mr) => mr[gi].rows[ri].value) })),
  }));
  const extra = [
    { key: "brand", values: models.map((m) => catalog.brandOf(m).name) },
    { key: "price", values: models.map((m) => money(minPriceUsd(m))) },
    { key: "styles", values: models.map((m) => m.styles.filter((s) => s !== "other").map((s) => t(`enum.style.${s}`)).join(", ") || null) },
  ];
  const same = (vals: (string | null)[]) => vals.every((v) => v === vals[0]);
  const keepIds = models.map(modelId);
  const toggleHref = `/compare?ids=${keepIds.join(",")}${onlyDiff ? "" : "&diff=1"}`;

  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-3xl font-semibold">{t("compare.title")}</h1>
        <Link href={toggleHref} className="chip" role="switch" aria-checked={onlyDiff} style={onlyDiff ? { borderColor: "var(--text)", fontWeight: 600 } : undefined}>
          <span aria-hidden className="inline-block h-3 w-3 rounded-sm border border-ink" style={{ background: onlyDiff ? "var(--text)" : "transparent" }} />
          {t("compare.onlyDiff")}
        </Link>
      </div>

      <div className="overflow-x-auto">
        <table className="tabular w-full min-w-[640px] border-collapse text-sm">
          <thead className="sticky top-0 z-10 bg-bg">
            <tr>
              <th className="w-40 border-b border-line p-2 text-left align-bottom" scope="col"><span className="sr-only">Spec</span></th>
              {models.map((m, i) => {
                const b = catalog.brandOf(m);
                return (
                  <th key={modelId(m)} scope="col" className="border-b border-line p-2 text-left align-bottom font-normal">
                    <span aria-hidden className="mb-1 block h-1 w-8 rounded" style={{ background: COLORS[i] }} />
                    <span className="eyebrow block">{b.name}</span>
                    <Link href={`/brands/${b.slug}/${m.slug}`} className="block font-semibold hover:underline">{m.name}</Link>
                    <span className="block">{money(minPriceUsd(m))}</span>
                    <span className="mt-1 flex items-center gap-3">
                      <a className="link text-xs" href={`/out/${encodeURIComponent(m.variants[0].id)}?from=compare`} target="_blank" rel="sponsored noopener">Buy ↗</a>
                      <RemoveFromCompare id={modelId(m)} ids={keepIds} />
                    </span>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {[{ group: "overview", rows: extra }, ...groups].map((g) => {
              const rows = onlyDiff ? g.rows.filter((r) => !same(r.values)) : g.rows.filter((r) => r.values.some(Boolean));
              if (!rows.length) return null;
              return (
                <RowsGroup key={g.group} title={g.group === "overview" ? "Overview" : t(`spec.group.${g.group}`)} cols={models.length}>
                  {rows.map((r) => (
                    <tr key={r.key} className="border-b border-line">
                      <th scope="row" className="p-2 text-left font-normal text-muted">{t(`spec.${r.key}`)}</th>
                      {r.values.map((v, i) => <td key={i} className={`p-2 ${v ? "" : "text-muted"}`}>{v ?? "—"}</td>)}
                    </tr>
                  ))}
                </RowsGroup>
              );
            })}
          </tbody>
        </table>
      </div>

      <section className="mt-10 flex flex-col items-center gap-2 text-center">
        <h2 className="text-xl font-semibold">{t("compare.outline")}</h2>
        <Overlay models={models} />
        <ul className="flex flex-wrap justify-center gap-3 text-sm">
          {models.map((m, i) => (
            <li key={modelId(m)} className="flex items-center gap-1.5"><span aria-hidden className="h-1 w-4 rounded" style={{ background: COLORS[i] }} />{m.name}</li>
          ))}
        </ul>
        <p className="max-w-md text-xs text-muted">{t("compare.outlineNote")}</p>
      </section>
    </div>
  );
}

function RowsGroup({ title, cols, children }: { title: string; cols: number; children: React.ReactNode }) {
  return (
    <>
      <tr>
        <th colSpan={cols + 1} scope="colgroup" className="bg-surface-2 p-2 text-left text-xs font-semibold uppercase tracking-wider text-muted">{title}</th>
      </tr>
      {children}
    </>
  );
}
