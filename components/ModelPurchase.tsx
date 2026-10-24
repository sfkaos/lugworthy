"use client";

import { useTranslations } from "next-intl";
import { useEffect, useMemo, useState } from "react";
import { money } from "@/lib/format";
import type { Variant } from "@/lib/types";
import { CompareButton } from "./CompareButton";

interface Props {
  variants: Variant[];
  initialIndex: number;
  brandName: string;
  compareId: string;
  status: string;
}

/** Variant picker + price + stock + buy (FR-4). Updates ?v= with replaceState, no reload. */
export function ModelPurchase({ variants, initialIndex, brandName, compareId, status }: Props) {
  const t = useTranslations();
  const [idx, setIdx] = useState(initialIndex);
  const v = variants[idx] ?? variants[0];

  useEffect(() => {
    const url = new URL(window.location.href);
    if (idx === 0) url.searchParams.delete("v");
    else url.searchParams.set("v", String(idx));
    window.history.replaceState(window.history.state, "", url);
  }, [idx]);

  const stock = status === "preorder" ? t("model.preorder") : v.available ? t("model.inStock") : t("model.soldOut");
  const approx = v.currency !== "USD";
  const groups = useMemo(() => variants.length > 1, [variants]);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-baseline gap-3">
        <span
          className="tabular text-3xl font-semibold"
          title={approx ? t("model.approx", { currency: v.currency, original: money(v.price, v.currency) }) : undefined}
        >
          {approx ? "≈ " : ""}
          {money(v.priceUsd)}
        </span>
        {v.compareAtPrice && v.compareAtPrice > v.price && (
          <s className="tabular text-muted">{money(v.compareAtPrice, v.currency)}</s>
        )}
        <span
          className="rounded-full px-2 py-0.5 text-sm font-semibold"
          style={{ background: "var(--surface-2)", color: v.available || status === "preorder" ? "var(--success)" : "var(--text-muted)" }}
        >
          {stock}
        </span>
      </div>
      {approx && <p className="-mt-3 text-xs text-muted">{t("model.approx", { currency: v.currency, original: money(v.price, v.currency) })}</p>}

      {groups && (
        <fieldset>
          <legend className="mb-2 text-sm font-semibold">{t("model.variants")}</legend>
          <div className="flex flex-col gap-1.5" role="radiogroup">
            {variants.map((x, i) => (
              <label
                key={x.id}
                className="flex cursor-pointer items-center justify-between gap-3 rounded-md border px-3 py-2 text-sm"
                style={{ borderColor: i === idx ? "var(--text)" : "var(--border)" }}
              >
                <span className="flex items-center gap-2">
                  <input type="radio" name="variant" className="accent-[var(--text)]" checked={i === idx} onChange={() => setIdx(i)} />
                  <span className={x.available ? "" : "text-muted"}>{x.title}</span>
                </span>
                <span className="tabular text-muted">{money(x.priceUsd)}</span>
              </label>
            ))}
          </div>
        </fieldset>
      )}
      {v.sku && <p className="tabular text-xs text-muted">{t("model.sku", { sku: v.sku })}</p>}

      <div className="flex flex-wrap gap-2">
        <a className="btn btn-brand h-11 px-5" href={`/out/${encodeURIComponent(v.id)}?from=model`} rel="sponsored noopener" target="_blank">
          {t("model.buy", { brand: brandName })}
        </a>
        <CompareButton id={compareId} variant="page" />
      </div>
    </div>
  );
}
