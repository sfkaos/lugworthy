import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./i18n/request.ts");

const nextConfig: NextConfig = {
  poweredByHeader: false,
  // The sync job imports the crawler's catalog files into the database, so ship them with it.
  outputFileTracingIncludes: {
    "/api/cron/sync": ["./data/catalog/**/*.json"],
    // Without DATABASE_URL (preview deploys) pages run on an in-memory database built from these.
    "/**": ["./db/migrations/**/*", "./data/catalog/**/*.json"],
  },
  serverExternalPackages: ["@electric-sql/pglite"],
};

export default withNextIntl(nextConfig);
