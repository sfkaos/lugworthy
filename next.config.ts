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
  // PostHog goes through lugworthy.com/ingest so ad blockers don't drop events.
  // POSTHOG_REGION is "us" (default) or "eu", matching the PostHog project.
  async rewrites() {
    const region = process.env.POSTHOG_REGION === "eu" ? "eu" : "us";
    return [
      { source: "/ingest/static/:path*", destination: `https://${region}-assets.i.posthog.com/static/:path*` },
      { source: "/ingest/:path*", destination: `https://${region}.i.posthog.com/:path*` },
    ];
  },
  // PostHog's API paths end in a slash; keep them as sent.
  skipTrailingSlashRedirect: true,
};

export default withNextIntl(nextConfig);
