import type { Metadata } from "next";
import { StaticPage } from "@/components/StaticPage";
import { siteStats } from "@/lib/site-data";

export const metadata: Metadata = { title: "About" };

export default async function About() {
  const s = await siteStats();
  return (
    <StaticPage title="About Lugworthy">
      <p>Lugworthy is a directory of independent and microbrand watches. The name is a nod to lug-to-lug, the number that decides whether a watch actually fits your wrist.</p>
      <p>We list {s.brands} brands from {s.countries} countries and pull specs from brand stores so you can filter by what matters. Every spec shows where it came from: imported, confirmed by the brand, or checked by an editor.</p>
      <p>We don’t sell watches. Buy buttons go to the brand.</p>
    </StaticPage>
  );
}
