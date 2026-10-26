"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { compareLabel, useCompare } from "./compare-store";

export interface TrayItem { id: string; name: string; brand: string }

/** Sticky tray. Names were saved when each watch was added; older entries fall back to the id. */
export function CompareTray() {
  const t = useTranslations("compare");
  const c = useCompare();
  const items: TrayItem[] = c.ids.map((id) => {
    const l = compareLabel(id);
    const [brand = "", model = id] = id.split("~");
    return { id, name: l?.name ?? model.replace(/-/g, " "), brand: l?.brand ?? brand.replace(/-/g, " ") };
  });
  if (!items.length) return null;
  return (
    <div className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-surface/95 backdrop-blur" role="region" aria-label={t("title")}>
      <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-2 px-4 py-3">
        <span className="text-sm font-semibold">{t("tray", { count: items.length })}</span>
        <ul className="flex min-w-0 flex-1 flex-wrap gap-2">
          {items.map((it) => (
            <li key={it.id} className="chip max-w-[14rem]">
              <span className="truncate">
                <span className="text-muted">{it.brand}</span> {it.name}
              </span>
              <button type="button" onClick={() => c.remove(it.id)} aria-label={`${t("remove")} ${it.name}`} className="text-muted hover:text-ink">
                ×
              </button>
            </li>
          ))}
        </ul>
        <button type="button" className="btn btn-sm" onClick={c.clear}>
          {t("clear")}
        </button>
        <Link className="btn btn-sm btn-primary" href={`/compare?ids=${items.map((i) => i.id).join(",")}`} aria-disabled={items.length < 2}>
          {t("open")}
        </Link>
      </div>
    </div>
  );
}
