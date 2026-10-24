import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { StaticPage } from "@/components/StaticPage";

export const metadata: Metadata = { title: "Videos" };
const SERIES = ["Fair walkthroughs", "Brand visits", "Wrist checks", "Shorts"];

export default async function Videos() {
  const t = await getTranslations("videos");
  return (
    <StaticPage title={t("title")}>
      <p>{t("intro")}</p>
      {SERIES.map((s) => (
        <section key={s} className="mt-6">
          <h2>{s}</h2>
          <p className="text-base text-muted">{t("empty")}</p>
        </section>
      ))}
    </StaticPage>
  );
}
