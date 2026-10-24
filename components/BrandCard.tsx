import Link from "next/link";
import { useTranslations } from "next-intl";
import { countryName } from "@/lib/countries";
import type { Brand } from "@/lib/types";

export function BrandCard({ brand, modelCount }: { brand: Brand; modelCount: number }) {
  const t = useTranslations();
  return (
    <article className="card relative flex h-full flex-col gap-2 p-4">
      <div className="flex items-start gap-3">
        <span aria-hidden className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md border border-line bg-surface-2 font-serif text-lg">
          {brand.name.replace(/^the\s+/i, "").charAt(0).toUpperCase()}
        </span>
        <div className="min-w-0">
          <h3 className="font-semibold leading-snug">
            <Link href={`/brands/${brand.slug}`} className="after:absolute after:inset-0">
              {brand.name}
            </Link>
          </h3>
          <p className="text-sm text-muted">
            {[brand.city, brand.country ? countryName(brand.country) : brand.countryLabel].filter(Boolean).join(", ") || countryName(null)}
          </p>
        </div>
      </div>
      {brand.styleTags.length > 0 && <p className="line-clamp-1 text-sm text-muted">{brand.styleTags.slice(0, 3).join(" · ")}</p>}
      <div className="mt-auto flex items-center justify-between pt-1 text-sm">
        <span className="text-muted">{brand.priceBand ? t(`enum.band.${brand.priceBand}`) : " "}</span>
        {modelCount > 0 && <span className="font-semibold">{t("brand.modelsCount", { count: modelCount })}</span>}
      </div>
    </article>
  );
}
