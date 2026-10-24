import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { Hub } from "@/components/Hub";
import { publishedModels } from "@/lib/data";
import { caliberFacet } from "@/lib/filters";
import { CALIBERS, caliberKey, caliberSlug } from "@/lib/ingest/normalize";
import { hours } from "@/lib/format";

type P = Promise<{ caliber: string }>;

function calibersInUse() {
  const map = new Map<string, string>();
  for (const m of publishedModels()) if (m.specs.caliber) map.set(caliberSlug(m.specs.caliber), m.specs.caliber);
  return map;
}

export function generateStaticParams() { return [...calibersInUse().keys()].map((caliber) => ({ caliber })); }
export const dynamicParams = false;

export async function generateMetadata({ params }: { params: P }): Promise<Metadata> {
  const t = await getTranslations();
  const slug = (await params).caliber;
  const name = calibersInUse().get(slug) ?? slug;
  return { title: t("hub.caliberTitle", { caliber: name }), alternates: { canonical: `/calibers/${slug}` } };
}

export default async function CaliberHub({ params }: { params: P }) {
  const slug = (await params).caliber;
  const name = calibersInUse().get(slug);
  if (!name) notFound();
  const t = await getTranslations();
  const models = publishedModels().filter((m) => m.specs.caliber === name);
  const info = CALIBERS[caliberKey(name) ?? ""];
  const facts = info
    ? [["Maker", info.maker], ["Type", t(`enum.mov.${info.type}`)], ["Power reserve", hours(info.powerReserveH ?? null)], ["Beat rate", info.frequencyBph ? `${info.frequencyBph.toLocaleString("en-US")} bph` : null], ["Hacking", info.hacking == null ? null : info.hacking ? "Yes" : "No"], ["Hand-winding", info.handWinding == null ? null : info.handWinding ? "Yes" : "No"]].filter(([, v]) => v)
    : [];
  return (
    <Hub path={`/calibers/${slug}`} title={t("hub.caliberTitle", { caliber: name })} intro={t("hub.caliberIntro", { caliber: name })} models={models} browseHref={`/watches?cal=${caliberFacet(models[0])}`} browseLabel={t("hub.browseAll")}>
      {facts.length > 0 && (
        <section className="card mt-6 max-w-md p-4">
          <h2 className="mb-2 font-semibold">{t("hub.caliberFacts")}</h2>
          <dl className="tabular grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
            {facts.map(([k, v]) => <div key={k} className="contents"><dt className="text-muted">{k}</dt><dd>{v}</dd></div>)}
          </dl>
        </section>
      )}
    </Hub>
  );
}
