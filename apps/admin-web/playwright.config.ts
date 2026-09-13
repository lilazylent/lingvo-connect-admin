import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  workers: 1,
  timeout: 30_000,
  use: {
    ...devices["Desktop Chrome"],
    channel: process.env.PLAYWRIGHT_CHANNEL || (process.platform === "win32" ? "msedge" : undefined),
    baseURL: "http://localhost:3011",
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
  },
  webServer: { command: "npm run dev -- --port 3011", env: { NEXT_DIST_DIR: ".next-qa", ...(process.env.STAGE2_LIVE ? { NEXT_PUBLIC_API_URL: "http://localhost:8012" } : {}) }, url: "http://localhost:3011/login", reuseExistingServer: !process.env.CI, timeout: 120_000 },
});
