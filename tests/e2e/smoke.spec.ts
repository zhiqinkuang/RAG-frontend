/**
 * Smoke Test for CI
 * Only tests frontend page loading, no backend dependency
 */

import { test, expect } from "@playwright/test";

const BASE_URL = process.env.BASE_URL || "http://localhost:3000";

test.describe("Smoke Tests (No Backend)", () => {
  test("homepage should load", async ({ page }) => {
    await page.goto(BASE_URL);
    // 页面标题可能是 "assistant-ui Starter App" 或自定义标题
    const title = await page.title();
    expect(title).toBeTruthy();
    expect(title.length).toBeGreaterThan(0);
  });

  test("login page should load", async ({ page }) => {
    await page.goto(`${BASE_URL}/login`);
    await expect(page.locator('input[type="email"]')).toBeVisible();
    await expect(page.locator('input[type="password"]')).toBeVisible();
  });

  test("register page should load", async ({ page }) => {
    await page.goto(`${BASE_URL}/register`);
    await expect(page.locator('input[type="email"]')).toBeVisible();
  });
});
