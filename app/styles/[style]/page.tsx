import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { Hub } from "@/components/Hub";
import { styleHub } from "@/lib/site-data";

const STYLES = ["diver", "field", "pilot", "gmt", "chronograph", "dress", "racing", "skin_diver", "integrated_bracelet", "tool"];
type P = Promise<{ style: string }>;

export function generateStaticParams() { return STYLES.map((style) => ({ style })); }
export const dynamicParams = false;

export async function generateMetadata({ params }: { params: P }): Promise<Metadata> {
  const t = await getTranslations();
  const { style } = await params;
  return { title: t("hub.styleTitle", { style: t(`enum.style.${style}`) }), alternates: { canonical: `/styles/${style}` } };
}

export default async function StyleHub({ params }: { params: P }) {
  const { style } = await params;
  if (!STYLES.includes(style)) notFound();
  const t = await getTranslations();
  const label = t(`enum.style.${style}`);
  const models = await styleHub(style);
  return <Hub path={`/styles/${style}`} title={t("hub.styleTitle", { style: label })} intro={t("hub.styleIntro", { style: label.toLowerCase() })} models={models} browseHref={`/watches?style=${style}`} browseLabel={t("hub.browseAll")} />;
}
