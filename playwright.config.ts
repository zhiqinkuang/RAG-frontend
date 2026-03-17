/**
 * Playwright Configuration for RAG Frontend E2E Tests
 * Copy this file to your project root and customize as needed.
 */

import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  // Test directory
  testDir: "./tests/e2e",

  // Run tests in parallel
  fullyParallel: true,

  // Fail build on CI if test.only is left in source
  forbidOnly: !!process.env.CI,

  // Retry failed tests on CI
  retries: process.env.CI ? 2 : 0,

  // Parallel workers (1 on CI, unlimited locally)
  workers: process.env.CI ? 1 : undefined,

  // Reporter
  reporter: [["html", { open: "never" }], ["list"]],

  // Global test settings
  use: {
    // Base URL
    baseURL: process.env.BASE_URL || "http://localhost:3000",

    // Collect trace on retry
    trace: "on-first-retry",

    // Screenshot on failure
    screenshot: "only-on-failure",

    // Video on failure
    video: "retain-on-failure",

    // Default timeout
    actionTimeout: 10000,

    // Browser context options
    contextOptions: {
      // Ignore HTTPS errors (for local dev)
      ignoreHTTPSErrors: true,
    },
  },

  // Configure projects for different browsers
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
    // Uncomment to test on other browsers
    // {
    //   name: 'firefox',
    //   use: { ...devices['Desktop Firefox'] },
    // },
    // {
    //   name: 'webkit',
    //   use: { ...devices['Desktop Safari'] },
    // },
    // {
    //   name: 'Mobile Chrome',
    //   use: { ...devices['Pixel 5'] },
    // },
    // {
    //   name: 'Mobile Safari',
    //   use: { ...devices['iPhone 12'] },
    // },
  ],

  // Auto-start dev server
  webServer: {
    command: "pnpm run dev",
    url: "http://localhost:3000",
    reuseExistingServer: !process.env.CI,
    timeout: 120000,
  },

  // Global timeout
  timeout: 30000,

  // Expect timeout
  expect: {
    timeout: 5000,
  },
});
