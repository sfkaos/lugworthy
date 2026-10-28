import Link from "next/link";
import { useTranslations } from "next-intl";
import { brandInfo, isAvailable, minPriceUsd, modelId } from "@/lib/model-utils";
import { metres, mm, money } from "@/lib/format";
import type { Model } from "@/lib/types";
import { WatchPhoto } from "./WatchPhoto";
import { CompareButton } from "./CompareButton";

export function ModelCard({ model, showBrand = true }: { model: Model; showBrand?: boolean }) {
  const t = useTranslations();
  const href = `/brands/${model.brandSlug}/${model.slug}`;
  const s = model.specs;
  const facts = [mm(s.caseDiameterMm), s.lugToLugMm ? `${mm(s.lugToLugMm)} L2L` : null, metres(s.waterResistanceM), s.caliber ?? (s.movementType ? t(`enum.mov.${s.movementType}`) : null)].filter(Boolean);
  const available = isAvailable(model);
  return (
    <article className="card card-link group relative flex w-full flex-col overflow-hidden">
      <div className={`relative flex aspect-square min-h-0 items-center justify-center overflow-hidden text-muted ${model.images?.length ? "bg-photo p-3" : "bg-surface-2"}`}>
        <WatchPhoto model={model} className="transition-transform duration-300 ease-out group-hover:scale-[1.03]" />
        <div className="absolute left-2 top-2 flex flex-wrap gap-1">
          {model.status === "preorder" && <span className="rounded-[var(--radius-sm)] border border-line bg-surface px-1.5 py-0.5 text-[11px] font-semibold uppercase tracking-wider">{t("enum.status.preorder")}</span>}
          {model.limitedEdition && <span className="rounded-[var(--radius-sm)] border border-line bg-surface px-1.5 py-0.5 text-[11px] font-semibold uppercase tracking-wider">{t("model.limited")}</span>}
          {!available && model.status !== "preorder" && <span className="rounded-[var(--radius-sm)] border border-line bg-surface px-1.5 py-0.5 text-[11px] font-semibold uppercase tracking-wider text-muted">{t("card.soldOut")}</span>}
        </div>
      </div>
      <div className="flex flex-1 flex-col gap-1 border-t border-line p-3 sm:p-4">
        {showBrand && <p className="eyebrow">{brandInfo(model).name}</p>}
        <h3 className="font-semibold leading-snug">
          <Link href={href} className="after:absolute after:inset-0">
            {model.name}
          </Link>
        </h3>
        <p className="tabular text-sm text-muted">{facts.join(" · ")}</p>
        <div className="mt-auto flex flex-wrap items-center justify-between gap-2 pt-3">
          <span className="tabular text-[15px] font-semibold">{t("card.from", { price: money(minPriceUsd(model)) })}</span>
          <span className="relative z-10">
            <CompareButton id={modelId(model)} label={{ name: model.name, brand: brandInfo(model).name }} />
          </span>
        </div>
      </div>
    </article>
  );
}

export function ModelGrid({ models, showBrand = true }: { models: Model[]; showBrand?: boolean }) {
  return (
    <ul className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3 xl:grid-cols-4">
      {models.map((m) => (
        <li key={`${m.brandSlug}/${m.slug}`} className="flex">
          <div className="flex w-full">
            <ModelCard model={m} showBrand={showBrand} />
          </div>
        </li>
      ))}
    </ul>
  );
}
