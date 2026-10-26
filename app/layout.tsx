import type { Metadata, Viewport } from "next";
import { NextIntlClientProvider } from "next-intl";
import { getMessages, getTranslations } from "next-intl/server";
import { CompareTray, type TrayItem } from "@/components/CompareTray";
import { Footer } from "@/components/Footer";
import { Header } from "@/components/Header";
import { getCatalog, modelId } from "@/lib/data";
import { SITE_URL } from "@/lib/site";
import "./globals.css";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("site");
  return {
    metadataBase: new URL(SITE_URL),
    title: { default: `Lugworthy · ${t("tagline")}`, template: "%s · Lugworthy" },
    description: t("description"),
    openGraph: { siteName: "Lugworthy", type: "website" },
  };
}

// Brand data comes live from the master sheet; pages re-render at most every 10 minutes.
// Keep in step with BRANDS_REVALIDATE_SECONDS. /api/v1/brands/refresh forces it sooner.
export const revalidate = 600;

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#fbfaf8" },
    { media: "(prefers-color-scheme: dark)", color: "#111113" },
  ],
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const catalog = await getCatalog();
  const messages = await getMessages();
  // Small lookup so the compare tray can name what's in it without a fetch.
  const index: Record<string, TrayItem> = {};
  for (const m of catalog.publishedModels()) index[modelId(m)] = { id: modelId(m), name: m.name, brand: catalog.brandOf(m).name };
  return (
    <html lang="en">
      <body>
        <NextIntlClientProvider messages={messages} locale="en">
          <Header />
          <main id="main">{children}</main>
          <Footer />
          <CompareTray index={index} />
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
