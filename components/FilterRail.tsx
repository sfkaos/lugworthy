"use client";

import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useEffect, useId, useOptimistic, useState, useTransition } from "react";
import { startNavProgress } from "./NavProgress";
import type { FacetCounts, Filters, Range } from "@/lib/filters";
import { WR_STEPS, formatRange, formatRangeValue, rangeText } from "@/lib/filters";

/** Slider positions in order; the first and last mean "no limit". unit is "$" or "mm". */
export interface Bounds { stops: number[]; unit: string }

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
      <RangeFacet title={t("facet.price")} bounds={bounds.price} value={filters.price} onCommit={(r) => push({ ...filters, price: r })} />
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

function Section({ title, aside, children }: { title: string; aside?: React.ReactNode; children: React.ReactNode }) {
  return (
    <fieldset className="border-t border-line py-3 first:border-t-0">
      <legend className="float-left mb-2 flex w-full items-baseline justify-between gap-2 text-sm font-semibold">
        <span>{title}</span>
        {aside}
      </legend>
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
  // Most common first; "Other" is a catch-all, so it goes last even when it is the largest.
  const entries = Object.entries(counts ?? {}).sort(
    (a, b) => Number(a[0] === "other") - Number(b[0] === "other") || b[1] - a[1] || (labels?.[a[0]] ?? a[0]).localeCompare(labels?.[b[0]] ?? b[0]),
  );
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

function RangeFacet({ title, bounds, value, onCommit }: { title: string; bounds: Bounds; value?: Range; onCommit: (r: Range | undefined) => void }) {
  const t = useTranslations();
  const id = useId();
  const { stops, unit } = bounds;
  const last = stops.length - 1;
  // undefined = open end ("no minimum" / "no maximum").
  const [lo, setLo] = useState<number | undefined>(value?.min);
  const [hi, setHi] = useState<number | undefined>(value?.max);
  useEffect(() => {
    setLo(value?.min);
    setHi(value?.max);
  }, [value?.min, value?.max]);
  if (last < 1) return null;

  // Slider position for a typed value: the nearest stop at or below a minimum, at or above a maximum.
  const loIdx = lo == null ? 0 : Math.max(0, stops.findLastIndex((s) => s <= lo));
  const hiIdx = hi == null ? last : (() => { const i = stops.findIndex((s) => s >= hi); return i < 0 ? last : i; })();

  const commit = (a: number | undefined, b: number | undefined) => {
    if (a != null && b != null && a > b) [a, b] = [b, a];
    if (a === value?.min && b === value?.max) return;
    const r: Range = {};
    if (a != null) r.min = a;
    if (b != null) r.max = b;
    onCommit(r.min == null && r.max == null ? undefined : r);
  };
  const keys = ["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Home", "End", "PageUp", "PageDown"];
  const fmt = (v: number) => formatRangeValue(v, unit);
  const pct = (i: number) => (i / last) * 100;
  const summary = rangeText({ min: lo, max: hi }, fmt) ?? t("browse.any");

  return (
    <Section title={title} aside={<span className="tabular text-xs font-normal text-muted">{summary}</span>}>
      <div className="range-dual" style={{ ["--lo" as string]: pct(loIdx), ["--hi" as string]: pct(hiIdx) }}>
        <div className="track" />
        <div className="fill" />
        <input
          type="range" className={loIdx === last ? "z-[3]" : undefined} aria-label={`${title} ${t("browse.min").toLowerCase()}`} min={0} max={last} step={1} value={loIdx}
          aria-valuetext={lo == null ? t("browse.any") : fmt(lo)}
          onChange={(e) => { const i = Math.min(Number(e.target.value), hiIdx); setLo(i === 0 ? undefined : stops[i]); }}
          onPointerUp={() => commit(lo, hi)} onKeyUp={(e) => keys.includes(e.key) && commit(lo, hi)}
        />
        <input
          type="range" aria-label={`${title} ${t("browse.max").toLowerCase()}`} min={0} max={last} step={1} value={hiIdx}
          aria-valuetext={hi == null ? t("browse.any") : fmt(hi)}
          onChange={(e) => { const i = Math.max(Number(e.target.value), loIdx); setHi(i === last ? undefined : stops[i]); }}
          onPointerUp={() => commit(lo, hi)} onKeyUp={(e) => keys.includes(e.key) && commit(lo, hi)}
        />
      </div>
      <div className="mt-2 flex items-center gap-2 text-sm">
        <RangeBox id={`${id}-lo`} label={`${title} ${t("browse.min").toLowerCase()}`} placeholder={t("browse.min")} unit={unit} value={lo} onChange={setLo} onCommit={(v) => commit(v, hi)} />
        <span aria-hidden className="text-muted">–</span>
        <RangeBox id={`${id}-hi`} label={`${title} ${t("browse.max").toLowerCase()}`} placeholder={t("browse.max")} unit={unit} value={hi} onChange={setHi} onCommit={(v) => commit(lo, v)} />
      </div>
    </Section>
  );
}

/** A typed minimum or maximum. Keeps the raw text while editing so "40." or an empty box work. */
function RangeBox({ id, label, placeholder, unit, value, onChange, onCommit }: {
  id: string; label: string; placeholder: string; unit: string; value?: number;
  onChange: (v: number | undefined) => void; onCommit: (v: number | undefined) => void;
}) {
  const [text, setText] = useState(value == null ? "" : String(value));
  const [editing, setEditing] = useState(false);
  useEffect(() => {
    if (!editing) setText(value == null ? "" : String(value));
  }, [value, editing]);
  const parse = (s: string) => {
    const n = Number(s.replace(/[^0-9.]/g, ""));
    return s.trim() === "" || !Number.isFinite(n) ? undefined : n;
  };
  return (
    <div className="range-box">
      <label className="sr-only" htmlFor={id}>{label}</label>
      {unit === "$" && <span aria-hidden className="text-muted">$</span>}
      <input
        id={id} className="tabular" inputMode="decimal" autoComplete="off" placeholder={placeholder} value={text}
        onFocus={() => setEditing(true)}
        onChange={(e) => { setText(e.target.value); onChange(parse(e.target.value)); }}
        onBlur={() => { setEditing(false); onCommit(parse(text)); }}
        onKeyDown={(e) => e.key === "Enter" && onCommit(parse(text))}
      />
      {unit !== "$" && <span aria-hidden className="text-muted">{unit}</span>}
    </div>
  );
}
