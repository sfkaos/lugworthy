import Link from "next/link";
import { useTranslations } from "next-intl";
import { Logo } from "./Logo";

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
    <header className="border-b border-line bg-bg">
      <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-2 focus:z-50 focus:rounded focus:bg-surface focus:px-3 focus:py-2">
        {t("skip")}
      </a>
      <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3">
        <Link href="/" aria-label="Lugworthy home" className="shrink-0">
          <Logo />
        </Link>
        <nav aria-label="Main" className="order-3 -mx-1 flex w-full gap-1 overflow-x-auto md:order-none md:w-auto">
          {links.map(([href, label]) => (
            <Link key={href} href={href} className="whitespace-nowrap rounded-md px-2 py-1.5 text-sm font-medium text-muted hover:bg-surface-2 hover:text-ink">
              {label}
            </Link>
          ))}
        </nav>
        <form action="/search" role="search" className="ml-auto flex min-w-0 flex-1 md:max-w-xs">
          <label htmlFor="site-search" className="sr-only">{t("search")}</label>
          <input id="site-search" name="q" type="search" placeholder={t("searchPlaceholder")} className="input h-9 min-h-9 text-sm" />
        </form>
      </div>
    </header>
  );
}
