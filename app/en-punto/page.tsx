import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { StaticPage } from "@/components/StaticPage";
import { EN_PUNTO_URL, EXHIBIT_URL } from "@/lib/site";

export const metadata: Metadata = { title: "En Punto" };

export default async function EnPunto() {
  const t = await getTranslations("enPunto");
  return (
    <StaticPage title={t("title")}>
      <p>{t("body")}</p>
      <p className="flex flex-wrap gap-2">
        <a className="btn btn-primary" href={EN_PUNTO_URL} rel="noopener" target="_blank">{t("cta")} ↗</a>
        <a className="btn" href={EXHIBIT_URL} rel="noopener" target="_blank">{t("exhibit")} ↗</a>
      </p>
    </StaticPage>
  );
}
