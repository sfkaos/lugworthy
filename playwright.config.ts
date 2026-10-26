import { defineConfig, devices } from "@playwright/test";

// Browser tests for lugworthy.com. They only read: no form is submitted and nothing is written.
//   npm run test:e2e                                 # against https://lugworthy.com
//   BASE_URL=http://localhost:3000 npm run test:e2e  # against a local server
//   BRANDS_API_TOKEN=... npm run test:e2e            # also runs the signed-in API tests
export default defineConfig({
  testDir: "tests/e2e",
  timeout: 60_000,
  expect: { timeout: 10_000 },
  fullyParallel: true,
  workers: process.env.CI ? 2 : 4,
  retries: process.env.CI ? 1 : 0,
  reporter: [["list"], ["html", { open: "never", outputFolder: "test-results/html" }], ["json", { outputFile: "test-results/e2e.json" }]],
  use: {
    baseURL: process.env.BASE_URL ?? "https://lugworthy.com",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"] }, grepInvert: /@mobile/ },
    { name: "mobile", use: { ...devices["Pixel 7"] }, grep: /@mobile/ },
  ],
});
