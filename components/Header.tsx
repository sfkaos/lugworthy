import Form from "next/form";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { Logo } from "./Logo";
import { NavLinks } from "./NavLinks";

export function Header() {
  const t = useTranslations("nav");
  const links = [
    ["/watches", t("watches")],
    ["/brands", t("brands")],
    ["/videos", t("videos")],
    ["/editorial", t("editorial")],
    ["/en-punto", t("enPunto")],
    ["/for-brands", t("forBrands")],
  ] as const;
  return (
    <header className="border-b border-line bg-bg md:sticky md:top-0 md:z-40 md:bg-bg/95 md:backdrop-blur-sm">
      <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-2 focus:z-50 focus:rounded focus:bg-surface focus:px-3 focus:py-2">
        {t("skip")}
      </a>
      <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-x-6 gap-y-1 px-4 pt-3 md:py-2">
        <Link href="/" aria-label="Lugworthy home" className="shrink-0">
          <Logo />
        </Link>
        <nav aria-label="Main" className="order-3 -mx-2.5 flex w-[calc(100%+20px)] overflow-x-auto md:order-none md:mx-0 md:w-auto">
          <NavLinks links={links} />
        </nav>
        <Form action="/search" role="search" className="relative ml-auto flex min-w-0 flex-1 md:max-w-xs">
          <label htmlFor="site-search" className="sr-only">{t("search")}</label>
          <svg aria-hidden viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted">
            <circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" />
          </svg>
          <input id="site-search" name="q" type="search" placeholder={t("searchPlaceholder")} className="input h-10 min-h-10 pl-9 text-sm" />
        </Form>
      </div>
    </header>
  );
}
