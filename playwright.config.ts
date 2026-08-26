import { defineConfig } from "@playwright/test";

/**
 * One UI smoke test only (CLAUDE.md). Builds the web bundle, starts the real
 * `logscope serve` against a small fixture folder, and drives the served app.
 */
export default defineConfig({
  testDir: "web/e2e",
  timeout: 30_000,
  fullyParallel: false,
  use: { baseURL: "http://127.0.0.1:4599" },
  webServer: {
    command:
      "npm run build:web && node --experimental-strip-types src/cli/index.ts serve web/e2e/logs --port 4599 --no-open",
    url: "http://127.0.0.1:4599/api/summary",
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
