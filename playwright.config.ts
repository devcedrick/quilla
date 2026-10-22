import { defineConfig, devices } from "@playwright/test";
import { loadEnvConfig } from "@next/env";

loadEnvConfig(process.cwd());

const hostname = "localhost";
const port = Number(process.env.PLAYWRIGHT_PORT ?? 3100);
const baseURL = `http://${hostname}:${port}`;

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI ? "github" : "list",
  use: {
    baseURL,
    trace: "on-first-retry",
  },
  projects: [
    {
      name: "auth-setup",
      testMatch: /auth\.setup\.ts/,
      use: { trace: "off", screenshot: "off", video: "off" },
    },
    {
      name: "chromium",
      testIgnore: /auth\.(spec|setup)\.ts/,
      use: { ...devices["Desktop Chrome"] },
    },
    {
      name: "auth",
      testMatch: /auth\.spec\.ts/,
      dependencies: ["auth-setup"],
      workers: 1,
      use: {
        ...devices["Desktop Chrome"],
        trace: "off",
        screenshot: "off",
        video: "off",
      },
    },
  ],
  webServer: {
    command: `npm run build && npm run start -- --hostname ${hostname} --port ${port}`,
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
