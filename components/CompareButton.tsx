"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";
import { useCompare } from "./compare-store";

export function CompareButton({ id, variant = "card" }: { id: string; variant?: "card" | "page" }) {
  const t = useTranslations();
  const c = useCompare();
  const [warn, setWarn] = useState(false);
  const active = c.has(id);
  const onClick = () => {
    const ok = c.toggle(id);
    setWarn(!ok);
    if (!ok) setTimeout(() => setWarn(false), 2500);
  };
  const label =
    variant === "page" ? (active ? t("model.inCompare") : t("model.addCompare")) : active ? t("card.comparing") : t("card.compare");
  return (
    <span className="relative inline-flex">
      <button
        type="button"
        onClick={onClick}
        aria-pressed={active}
        className={variant === "page" ? "btn" : "btn btn-sm"}
        style={active ? { borderColor: "var(--text)" } : undefined}
      >
        {label}
      </button>
      {warn && (
        <span role="status" className="absolute top-full mt-1 right-0 z-10 w-48 rounded-md bg-ink px-2 py-1 text-xs text-bg">
          {t("compare.full")}
        </span>
      )}
    </span>
  );
}
