import Link from "next/link";
import { useTranslations } from "next-intl";
import { Logo } from "./Logo";
import { NewsletterForm } from "./NewsletterForm";

export function Footer() {
  const t = useTranslations("footer");
  return (
    <footer className="mt-24 border-t border-line bg-surface pb-24">
      <div className="mx-auto grid max-w-7xl gap-10 px-4 py-12 md:grid-cols-[1.3fr_1fr]">
        <div className="flex max-w-md flex-col gap-3">
          <Logo />
          <p className="font-serif text-2xl font-semibold leading-tight">{t("newsletterTitle")}</p>
          <NewsletterForm />
        </div>
        <nav aria-label="Footer" className="grid grid-cols-2 content-start gap-x-6 gap-y-3 text-sm sm:grid-cols-3">
          <Link className="link" href="/about">{t("about")}</Link>
          <Link className="link" href="/image-policy">{t("imagePolicy")}</Link>
          <Link className="link" href="/takedown">{t("takedown")}</Link>
          <Link className="link" href="/privacy">{t("privacy")}</Link>
          <Link className="link" href="/for-brands">For brands</Link>
          <Link className="link" href="/en-punto">En Punto</Link>
        </nav>
        <div className="border-t border-line pt-6 text-xs text-muted md:col-span-2">
          <p>{t("affiliate")}</p>
          <p className="mt-1">© {new Date().getFullYear()} Lugworthy · {t("rights")}</p>
        </div>
      </div>
    </footer>
  );
}
