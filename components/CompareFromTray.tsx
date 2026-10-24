"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useEffect } from "react";
import { useCompare } from "./compare-store";

/** /compare with no ids: pick up the tray's contents, else show the empty state. */
export function CompareFromTray() {
  const t = useTranslations("compare");
  const c = useCompare();
  const router = useRouter();
  useEffect(() => {
    if (c.ids.length >= 2) router.replace(`/compare?ids=${c.ids.join(",")}`);
  }, [c.ids, router]);
  return (
    <div className="card p-8 text-center">
      <p className="text-muted">{t("empty")}</p>
      <Link className="btn btn-primary mt-4" href="/watches">{t("emptyCta")}</Link>
    </div>
  );
}

export function RemoveFromCompare({ id, ids }: { id: string; ids: string[] }) {
  const t = useTranslations("compare");
  const c = useCompare();
  const router = useRouter();
  return (
    <button
      type="button"
      className="link text-xs text-muted"
      onClick={() => {
        const next = ids.filter((x) => x !== id);
        c.set(next);
        router.replace(next.length ? `/compare?ids=${next.join(",")}` : "/compare");
      }}
    >
      {t("remove")}
    </button>
  );
}
