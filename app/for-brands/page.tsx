import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { ClaimForm } from "@/components/ClaimForm";
import { getCatalog } from "@/lib/data";

export const metadata: Metadata = { title: "For brands", alternates: { canonical: "/for-brands" } };

export default async function ForBrands({ searchParams }: { searchParams: Promise<{ brand?: string }> }) {
  const catalog = await getCatalog();
  const t = await getTranslations("forBrands");
  const { brand } = await searchParams;
  const brands = catalog.publishedBrands().map((b) => ({ slug: b.slug, name: b.name }));
  return (
    <div className="mx-auto grid max-w-6xl gap-10 px-4 py-10 md:grid-cols-[1.3fr_1fr]">
      <div>
        <h1 className="font-serif text-4xl font-semibold tracking-tight">{t("title")}</h1>
        <p className="mt-3 text-lg text-muted">{t("intro")}</p>
        <h2 className="mt-8 text-xl font-semibold">{t("benefits")}</h2>
        <ul className="mt-2 list-disc space-y-1 pl-5">
          {["b1", "b2", "b3", "b4"].map((k) => <li key={k}>{t(k)}</li>)}
        </ul>
        <p className="card mt-6 p-4 text-sm">{t("imagePolicy")}</p>
        <h2 className="mt-8 text-xl font-semibold">{t("how")}</h2>
        <ol className="mt-2 list-decimal space-y-1 pl-5">
          {["h1", "h2", "h3"].map((k) => <li key={k}>{t(k)}</li>)}
        </ol>
      </div>
      <section className="card h-fit p-5" aria-labelledby="claim-h">
        <h2 id="claim-h" className="text-xl font-semibold">{t("formTitle")}</h2>
        <p className="mb-4 mt-1 text-sm text-muted">{t("formNote")}</p>
        <ClaimForm brands={brands} initial={brand} />
      </section>
    </div>
  );
}
