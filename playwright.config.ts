import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    baseURL: "http://localhost:5173",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"], viewport: { width: 1400, height: 800 } },
    },
  ],
  webServer: {
    command: "npm run dev",
    url: "http://localhost:5173/",
    timeout: 30000,
    reuseExistingServer: !process.env.CI,
  },
});
