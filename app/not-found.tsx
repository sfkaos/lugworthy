import Link from "next/link";
import { getTranslations } from "next-intl/server";

export default async function NotFound() {
  const t = await getTranslations("common");
  return (
    <div className="mx-auto max-w-xl px-4 py-20 text-center">
      <h1 className="text-4xl md:text-5xl">{t("notFound")}</h1>
      <p className="mt-2 text-muted">{t("notFoundBody")}</p>
      <div className="mt-6 flex justify-center gap-2">
        <Link className="btn btn-primary" href="/watches">Browse watches</Link>
        <Link className="btn" href="/">{t("goHome")}</Link>
      </div>
    </div>
  );
}
