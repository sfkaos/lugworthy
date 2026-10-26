import type { Model } from "@/lib/types";
import { CaseOutline } from "./CaseOutline";

/** The watch's first photo from the brand's site, or a to-scale case outline when there's none. */
export function WatchPhoto({ model, className = "", eager = false }: { model: Model; className?: string; eager?: boolean }) {
  const img = model.images?.[0];
  const s = model.specs;
  if (!img) return <CaseOutline diameter={s.caseDiameterMm} lugToLug={s.lugToLugMm} lugWidth={s.lugWidthMm} className={`h-4/5 w-4/5 text-muted ${className}`} />;
  return (
    // Brand-hosted images: plain <img> so any brand CDN works without image-domain config.
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={img.url}
      alt={model.name}
      width={img.width ?? undefined}
      height={img.height ?? undefined}
      loading={eager ? "eager" : "lazy"}
      decoding="async"
      referrerPolicy="no-referrer"
      className={`h-full w-full object-contain ${className}`}
    />
  );
}
