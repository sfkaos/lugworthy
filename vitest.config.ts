import { defineConfig } from "vitest/config";
import path from "node:path";
export default defineConfig({
  test: {
    include: ["tests/**/*.test.ts"],
    // Tests read a small slice of data/catalog (see tests/catalog-subset.ts).
    globalSetup: ["tests/catalog-subset.ts"],
    env: { LUGWORTHY_CATALOG_DIR: path.resolve(__dirname, "node_modules/.cache/lugworthy-test-catalog") },
  },
  resolve: { alias: { "@": path.resolve(__dirname) } },
});
