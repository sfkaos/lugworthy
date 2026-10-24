"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { SORTS, type SortKey } from "@/lib/filters";

export function SortSelect({ value }: { value: SortKey }) {
  const t = useTranslations();
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  return (
    <label className="flex items-center gap-2 text-sm">
      <span className="text-muted">{t("browse.sort")}</span>
      <select
        className="input h-9 min-h-9 w-auto py-0 pr-8 text-sm"
        value={value}
        onChange={(e) => {
          const next = new URLSearchParams(sp.toString());
          next.set("sort", e.target.value);
          next.delete("page");
          router.push(`${pathname}?${next}`, { scroll: false });
        }}
      >
        {SORTS.map((s) => (
          <option key={s} value={s}>{t(`sort.${s}`)}</option>
        ))}
      </select>
    </label>
  );
}
