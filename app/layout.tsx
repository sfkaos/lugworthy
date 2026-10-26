import type { Metadata, Viewport } from "next";
import { NextIntlClientProvider } from "next-intl";
import { getMessages, getTranslations } from "next-intl/server";
import { CompareTray } from "@/components/CompareTray";
import { Footer } from "@/components/Footer";
import { Header } from "@/components/Header";
import { NavProgress } from "@/components/NavProgress";
import { Suspense } from "react";
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

// Brand data comes from the database; pages re-render at most every 10 minutes.
// The sync job (/api/cron/sync) revalidates everything right after it runs.
export const revalidate = 600;

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#fbfaf8" },
    { media: "(prefers-color-scheme: dark)", color: "#111113" },
  ],
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const messages = await getMessages();
  return (
    <html lang="en">
      <body>
        <NextIntlClientProvider messages={messages} locale="en">
          <Suspense fallback={null}>
            <NavProgress />
          </Suspense>
          <Header />
          <main id="main">{children}</main>
          <Footer />
          <CompareTray />
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
