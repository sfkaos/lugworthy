import Link from "next/link";
import { ModelGrid } from "./ModelCard";
import { SITE_URL, jsonLd } from "@/lib/site";
import type { Model } from "@/lib/types";

/** Hubs show a first page; the browse link opens the full, paginated list. */
const HUB_LIMIT = 48;

export function Hub({ title, intro, models, browseHref, browseLabel, children, path }: {
  title: string; intro: string; models: Model[]; browseHref?: string; browseLabel?: string; children?: React.ReactNode; path: string;
}) {
  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      <script type="application/ld+json" dangerouslySetInnerHTML={jsonLd({
        "@context": "https://schema.org", "@type": "ItemList", name: title, url: `${SITE_URL}${path}`,
        itemListElement: models.slice(0, 50).map((m, i) => ({ "@type": "ListItem", position: i + 1, url: `${SITE_URL}/brands/${m.brandSlug}/${m.slug}` })),
      })} />
      <h1 className="text-4xl md:text-5xl">{title}</h1>
      <p className="mt-2 max-w-2xl text-lg text-muted">{intro}</p>
      {browseHref && <Link className="btn mt-4" href={browseHref}>{browseLabel}</Link>}
      {children}
      {models.length > 0 && <div className="mt-8"><ModelGrid models={models.slice(0, HUB_LIMIT)} /></div>}
    </div>
  );
}
