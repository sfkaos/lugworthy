"use client";

import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useEffect, useId, useOptimistic, useState, useTransition } from "react";
import { startNavProgress } from "./NavProgress";
import type { FacetCounts, Filters, Range } from "@/lib/filters";
import { WR_STEPS, formatRange } from "@/lib/filters";

export interface Bounds { min: number; max: number; step: number; unit: string }

interface Props {
  filters: Filters;
  counts: FacetCounts;
  wrCounts: Record<number, number>;
  bounds: { price: Bounds; dia: Bounds; l2l: Bounds; thk: Bounds };
  labels: Record<string, Record<string, string>>; // facet -> value -> label
  total: number;
}

const P0_MULTI = ["mov", "style", "dial", "strap", "avail"] as const;
const P1_MULTI = ["cal", "crystal", "mat", "lug", "comp", "country"] as const;

const SWATCH: Record<string, string> = {
  black: "#111", white: "#fafafa", silver: "#c9cbd0", grey: "#8a8d93", blue: "#2856a6", green: "#2e6b45",
  red: "#a3212a", orange: "#e0712c", yellow: "#e8c33a", brown: "#7a5232", cream: "#efe4cb", salmon: "#f0a08a",
  purple: "#6d4c9c", pink: "#e9a3c0", teal: "#1f8a8a", multi: "conic-gradient(#2856a6,#e8c33a,#a3212a,#2e6b45,#2856a6)", skeleton: "repeating-linear-gradient(45deg,#888 0 2px,transparent 2px 5px)",
};

export function FilterRail({ filters: current, counts, wrCounts, bounds, labels, total }: Props) {
  const t = useTranslations();
  const router = useRouter();
  const [pending, start] = useTransition();
  // Ticks and chips change on click; the counts and results follow when the server answers.
  const [filters, setFilters] = useOptimistic(current);
  const [open, setOpen] = useState(false);

  function push(next: Filters) {
    const sp = new URLSearchParams();
    const merged = { ...next, page: undefined };
    for (const [k, v] of Object.entries(merged)) {
      if (v == null || (Array.isArray(v) && !v.length)) continue;
      if (typeof v === "object" && !Array.isArray(v)) {
        const r = formatRange(v as Range);
        if (r) sp.set(k, r);
      } else sp.set(k, Array.isArray(v) ? v.join(",") : String(v));
    }
    const qs = sp.toString();
    startNavProgress();
    start(() => {
      setFilters(next);
      router.push(qs ? `/watches?${qs}` : "/watches", { scroll: false });
    });
  }

  const toggle = (facet: keyof Filters, value: string) => {
    const cur = (filters[facet] as string[] | undefined) ?? [];
    const next = cur.includes(value) ? cur.filter((v) => v !== value) : [...cur, value];
    push({ ...filters, [facet]: next });
  };

  const body = (
    <div className="flex flex-col gap-1" aria-busy={pending}>
      <RangeFacet title={t("facet.price")} bounds={bounds.price} value={filters.price} onCommit={(r) => push({ ...filters, price: r })} prefix="$" />
      <RangeFacet title={t("facet.dia")} bounds={bounds.dia} value={filters.dia} onCommit={(r) => push({ ...filters, dia: r })} />
      <RangeFacet title={t("facet.l2l")} bounds={bounds.l2l} value={filters.l2l} onCommit={(r) => push({ ...filters, l2l: r })} />
      <RangeFacet title={t("facet.thk")} bounds={bounds.thk} value={filters.thk} onCommit={(r) => push({ ...filters, thk: r })} />
      {P0_MULTI.slice(0, 1).map((f) => (
        <MultiFacet key={f} facet={f} title={t(`facet.${f}`)} counts={counts[f]} selected={filters[f]} labels={labels[f]} onToggle={(v) => toggle(f, v)} />
      ))}
      <Section title={t("facet.wr")}>
        <div role="radiogroup" aria-label={t("facet.wr")} className="flex flex-wrap gap-1.5">
          {[0, ...WR_STEPS].map((step) => {
            const active = (filters.wr ?? 0) === step;
            const n = step ? wrCounts[step] : undefined;
            return (
              <button
                key={step}
                type="button"
                role="radio"
                aria-checked={active}
                disabled={step > 0 && n === 0 && !active}
                onClick={() => push({ ...filters, wr: step || undefined })}
                className="chip tabular text-sm"
              >
                {step ? t("facet.wrAtLeast", { m: step }) : t("browse.any")}
                {n != null && <span className="text-muted">{n}</span>}
              </button>
            );
          })}
        </div>
      </Section>
      {P0_MULTI.slice(1).map((f) => (
        <MultiFacet key={f} facet={f} title={t(`facet.${f}`)} counts={counts[f]} selected={filters[f]} labels={labels[f]} onToggle={(v) => toggle(f, v)} swatches={f === "dial"} />
      ))}
      <details className="border-t border-line pt-2" open={P1_MULTI.some((f) => filters[f]?.length)}>
        <summary className="cursor-pointer py-2 text-sm font-semibold">{t("browse.more")}</summary>
        {P1_MULTI.map((f) => (
          <MultiFacet key={f} facet={f} title={t(`facet.${f}`)} counts={counts[f]} selected={filters[f]} labels={labels[f]} onToggle={(v) => toggle(f, v)} />
        ))}
      </details>
    </div>
  );

  return (
    <>
      <button type="button" className="btn w-full lg:hidden" onClick={() => setOpen(true)} aria-expanded={open} aria-controls="filter-sheet">
        {t("browse.filters")}
      </button>
      <div className="hidden lg:block">{body}</div>
      {open && (
        <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true" aria-label={t("browse.filters")} id="filter-sheet">
          <button type="button" className="absolute inset-0 bg-black/40" aria-label="Close" onClick={() => setOpen(false)} />
          <div className="absolute inset-x-0 bottom-0 max-h-[85dvh] overflow-y-auto rounded-t-2xl bg-bg p-4 pb-24">
            <div className="mb-2 flex items-center justify-between">
              <h2 className="text-lg font-semibold">{t("browse.filters")}</h2>
              <button type="button" className="btn btn-sm" onClick={() => setOpen(false)}>✕</button>
            </div>
            {body}
            <div className="fixed inset-x-0 bottom-0 border-t border-line bg-bg p-3">
              <button type="button" className="btn btn-primary w-full" onClick={() => setOpen(false)}>
                {t("browse.showResults", { count: total })}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <fieldset className="border-t border-line py-3 first:border-t-0">
      <legend className="float-left mb-2 w-full text-sm font-semibold">{title}</legend>
      <div className="clear-both">{children}</div>
    </fieldset>
  );
}

function MultiFacet({
  facet, title, counts, selected, labels, onToggle, swatches,
}: {
  facet: string; title: string; counts: Record<string, number> | undefined; selected?: string[];
  labels?: Record<string, string>; onToggle: (v: string) => void; swatches?: boolean;
}) {
  const entries = Object.entries(counts ?? {}).sort((a, b) => b[1] - a[1] || (labels?.[a[0]] ?? a[0]).localeCompare(labels?.[b[0]] ?? b[0]));
  const [showAll, setShowAll] = useState(false);
  if (!entries.length) return null;
  const visible = showAll ? entries : entries.slice(0, 8);
  return (
    <Section title={title}>
      <ul className={swatches ? "flex flex-wrap gap-2" : "flex flex-col gap-0.5"}>
        {visible.map(([value, n]) => {
          const checked = selected?.includes(value) ?? false;
          const label = labels?.[value] ?? value;
          const disabled = n === 0 && !checked;
          const id = `f-${facet}-${value}`;
          if (swatches)
            return (
              <li key={value}>
                <input id={id} type="checkbox" className="peer sr-only" checked={checked} disabled={disabled} onChange={() => onToggle(value)} />
                <label
                  htmlFor={id}
                  title={`${label} (${n})`}
                  className="flex cursor-pointer items-center gap-1.5 rounded-full border border-line py-1 pl-1 pr-2 text-xs peer-checked:border-ink peer-checked:font-semibold peer-disabled:cursor-not-allowed peer-disabled:opacity-40 peer-focus-visible:outline-2 peer-focus-visible:outline-[var(--focus)]"
                >
                  <span aria-hidden className="h-4 w-4 rounded-full border border-line-strong" style={{ background: SWATCH[value] ?? "#999" }} />
                  {label} <span className="tabular text-muted">{n}</span>
                </label>
              </li>
            );
          return (
            <li key={value}>
              <label className={`flex cursor-pointer items-center gap-2 rounded px-1 py-1 text-sm hover:bg-surface-2 ${disabled ? "cursor-not-allowed opacity-40" : ""}`}>
                <input type="checkbox" checked={checked} disabled={disabled} onChange={() => onToggle(value)} className="h-4 w-4 accent-[var(--text)]" />
                <span className="flex-1">{label}</span>
                <span className="tabular text-xs text-muted">{n}</span>
              </label>
            </li>
          );
        })}
      </ul>
      {entries.length > 8 && (
        <button type="button" className="link mt-1 text-sm" onClick={() => setShowAll((s) => !s)}>
          {showAll ? "Show fewer" : `Show all ${entries.length}`}
        </button>
      )}
    </Section>
  );
}

function RangeFacet({ title, bounds, value, onCommit, prefix = "" }: { title: string; bounds: Bounds; value?: Range; onCommit: (r: Range | undefined) => void; prefix?: string }) {
  const id = useId();
  const [lo, setLo] = useState(value?.min ?? bounds.min);
  const [hi, setHi] = useState(value?.max ?? bounds.max);
  useEffect(() => {
    setLo(value?.min ?? bounds.min);
    setHi(value?.max ?? bounds.max);
  }, [value?.min, value?.max, bounds.min, bounds.max]);
  const commit = (a = lo, b = hi) => {
    const r: Range = {};
    if (a > bounds.min) r.min = a;
    if (b < bounds.max) r.max = b;
    onCommit(r.min == null && r.max == null ? undefined : r);
  };
  const span = bounds.max - bounds.min || 1;
  const left = ((lo - bounds.min) / span) * 100;
  const right = ((hi - bounds.min) / span) * 100;
  const fmt = (v: number) => `${prefix}${v.toLocaleString("en-US")}${bounds.unit ? ` ${bounds.unit}` : ""}`;
  return (
    <Section title={title}>
      <div className="range-dual" onPointerUp={() => commit()} onKeyUp={(e) => ["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Home", "End", "PageUp", "PageDown"].includes(e.key) && commit()}>
        <div className="track" />
        <div className="fill" style={{ left: `${left}%`, width: `${Math.max(right - left, 0)}%` }} />
        <input
          type="range" aria-label={`${title} minimum`} min={bounds.min} max={bounds.max} step={bounds.step} value={lo}
          aria-valuetext={fmt(lo)}
          onChange={(e) => setLo(Math.min(Number(e.target.value), hi))}
        />
        <input
          type="range" aria-label={`${title} maximum`} min={bounds.min} max={bounds.max} step={bounds.step} value={hi}
          aria-valuetext={fmt(hi)}
          onChange={(e) => setHi(Math.max(Number(e.target.value), lo))}
        />
      </div>
      <div className="mt-1 flex items-center justify-between gap-2 text-sm">
        <label className="sr-only" htmlFor={`${id}-lo`}>{title} minimum</label>
        <input id={`${id}-lo`} className="input tabular h-8 min-h-8 w-24 px-2 text-sm" inputMode="decimal" value={lo}
          onChange={(e) => setLo(Number(e.target.value) || bounds.min)} onBlur={() => commit()} onKeyDown={(e) => e.key === "Enter" && commit()} />
        <span className="text-muted">–</span>
        <label className="sr-only" htmlFor={`${id}-hi`}>{title} maximum</label>
        <input id={`${id}-hi`} className="input tabular h-8 min-h-8 w-24 px-2 text-right text-sm" inputMode="decimal" value={hi}
          onChange={(e) => setHi(Number(e.target.value) || bounds.max)} onBlur={() => commit()} onKeyDown={(e) => e.key === "Enter" && commit()} />
      </div>
      <p className="tabular mt-1 text-xs text-muted">{fmt(lo)} – {fmt(hi)}</p>
    </Section>
  );
}
