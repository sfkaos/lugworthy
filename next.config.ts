import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./i18n/request.ts");

const nextConfig: NextConfig = {
  poweredByHeader: false,
  // The crawler's per-brand catalog files are read from disk at request time.
  outputFileTracingIncludes: { "/api/v1/**": ["./data/catalog/**/*.json"], "/brands/**": ["./data/catalog/**/*.json"], "/**": ["./data/catalog/index.json"] },
};

export default withNextIntl(nextConfig);
