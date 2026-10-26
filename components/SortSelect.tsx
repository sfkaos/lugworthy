"use client";

import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useOptimistic, useTransition } from "react";
import { SORTS, type SortKey } from "@/lib/filters";
import { startNavProgress } from "./NavProgress";

/** `query` is the current filter query string, so this works on the cached /watches page too. */
export function SortSelect({ value, query }: { value: SortKey; query: string }) {
  const t = useTranslations();
  const router = useRouter();
  const [, start] = useTransition();
  // Show the new choice right away instead of snapping back until the server answers.
  const [shown, setShown] = useOptimistic(value);
  return (
    <label className="flex items-center gap-2 text-sm">
      <span className="text-muted">{t("browse.sort")}</span>
      <select
        className="input h-9 min-h-9 w-auto py-0 pr-8 text-sm"
        value={shown}
        onChange={(e) => {
          const next = new URLSearchParams(query);
          next.set("sort", e.target.value);
          next.delete("page");
          startNavProgress();
          start(() => {
            setShown(e.target.value as SortKey);
            router.push(`/watches?${next}`, { scroll: false });
          });
        }}
      >
        {SORTS.map((s) => (
          <option key={s} value={s}>{t(`sort.${s}`)}</option>
        ))}
      </select>
    </label>
  );
}
