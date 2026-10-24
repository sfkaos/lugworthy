import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { StaticPage } from "@/components/StaticPage";

export const metadata: Metadata = { title: "Editorial" };

export default async function Editorial() {
  const t = await getTranslations("editorial");
  return (
    <StaticPage title={t("title")}>
      <p>{t("intro")}</p>
      <p className="text-muted">{t("empty")}</p>
    </StaticPage>
  );
}
