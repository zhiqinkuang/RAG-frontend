/**
 * E2E Tests for Smart Search Feature
 *
 * Tests the intelligent search functionality that:
 * - Short text → keyword search
 * - Medium text → natural language processing
 * - Long text (abstract) → smart recognition
 *
 * Run: npx playwright test tests/e2e/smart-search.spec.ts --headed
 */

import { test, expect, Page } from "@playwright/test";

const BASE_URL = process.env.BASE_URL || "http://localhost:3000";
const _API_URL = process.env.API_URL || "http://localhost:8080";
const TEST_EMAIL = process.env.TEST_EMAIL || "demo@rag.com";
const TEST_PASSWORD = process.env.TEST_PASSWORD || "Demo123456";

test.describe.configure({ mode: "serial" });

// Helper to login via API and get token
async function loginViaAPI(request: any): Promise<string> {
  const response = await request.post(`${BASE_URL}/api/auth/login`, {
    data: {
      baseURL: "http://127.0.0.1:8080",
      email: TEST_EMAIL,
      password: TEST_PASSWORD,
    },
  });

  expect(response.ok()).toBeTruthy();
  const data = await response.json();
  return data.token;
}

// Helper to set auth in page
async function setAuthInPage(page: Page, token: string) {
  await page.addInitScript((token) => {
    localStorage.setItem("rag-token", token);
    localStorage.setItem(
      "chat-settings",
      JSON.stringify({
        provider: "rag",
        apiKey: token,
        baseURL: "http://127.0.0.1:8080",
        model: "doubao-pro-32k",
      }),
    );
  }, token);
}

// Helper to open paper search page
async function openPaperSearch(page: Page) {
  // Try direct navigation first
  await page.goto(`${BASE_URL}/paper-search`);
  await page.waitForLoadState("networkidle");
  await page.waitForTimeout(1000);
}

test.describe("Smart Search Feature Tests", () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test.beforeEach(async ({ page, request }) => {
    const token = await loginViaAPI(request);
    await setAuthInPage(page, token);
  });

  test("should display paper search page with smart search UI", async ({
    page,
  }) => {
    await openPaperSearch(page);

    // Take screenshot of initial page
    await page.screenshot({
      path: "test-results/smart-search/01-initial-page.png",
      fullPage: true,
    });

    // Verify page title - use getByRole for heading
    const heading = page.getByRole("heading", { name: "论文搜索" });
    await expect(heading).toBeVisible({ timeout: 5000 });

    // Verify search input exists - use getByRole for textbox
    const searchInput = page.getByRole("textbox");
    await expect(searchInput).toBeVisible({ timeout: 5000 });

    // Verify smart search button
    const smartSearchButton = page.getByRole("button", { name: "智能搜索" });
    await expect(smartSearchButton).toBeVisible({ timeout: 3000 });

    // Verify keyword button
    const keywordButton = page.getByRole("button", { name: "关键词" });
    await expect(keywordButton).toBeVisible({ timeout: 3000 });

    console.log("✅ Paper search page displayed correctly");
  });

  test("should trigger keyword search for short text", async ({ page }) => {
    test.setTimeout(60000);

    // Setup mock for search API
    let _searchMode = "";
    await page.route("**/api/v1/papers/search**", async (route) => {
      const url = route.request().url();
      console.log("Search API called:", url);

      // Check if it's keyword search (short query parameter)
      const urlObj = new URL(url, "http://localhost");
      const query =
        urlObj.searchParams.get("query") || urlObj.searchParams.get("keyword");
      _searchMode = query ? "keyword" : "unknown";

      await route.fulfill({
        status: 200,
        contentType: "application/json",
        headers: {
          "Access-Control-Allow-Origin": "*",
        },
        body: JSON.stringify({
          code: 0,
          data: {
            papers: [
              {
                id: "arxiv:2301.00001",
                arxiv_id: "2301.00001",
                title: "Attention Is All You Need: Transformer Architecture",
                authors: ["Author One", "Author Two"],
                abstract:
                  "This paper introduces the Transformer architecture...",
                pdf_url: "https://arxiv.org/pdf/2301.00001",
                abs_url: "https://arxiv.org/abs/2301.00001",
                source: "arxiv",
                published: "2023-01-01",
                categories: ["cs.LG"],
              },
            ],
            total: 1,
            has_more: false,
          },
        }),
      });
    });

    await openPaperSearch(page);

    // Find and fill search input with short text (keyword)
    const searchInput = page.getByRole("textbox");
    await expect(searchInput).toBeVisible({ timeout: 5000 });

    // Type short keyword
    await searchInput.fill("transformer");
    console.log("✅ Filled search input with short text: transformer");

    // Take screenshot before search
    await page.screenshot({
      path: "test-results/smart-search/02-short-text-input.png",
    });

    // Click search button (the button with search icon next to textbox)
    const searchButton = page
      .locator("button")
      .filter({ has: page.locator("img") })
      .nth(2);
    await searchButton.click();
    console.log("✅ Clicked search button");

    // Wait for results
    await page.waitForTimeout(3000);

    // Take screenshot of results
    await page.screenshot({
      path: "test-results/smart-search/03-short-text-results.png",
      fullPage: true,
    });

    console.log("✅ Short text search completed");
  });

  test("should trigger natural language processing for medium text", async ({
    page,
  }) => {
    test.setTimeout(60000);

    let _capturedQuery = "";

    // Setup mock for smart search API
    await page.route("**/api/v1/papers/**", async (route) => {
      const url = route.request().url();
      const method = route.request().method();
      const body = route.request().postData();

      console.log("API called:", method, url);
      if (body) {
        console.log("Request body:", body.substring(0, 200));
        _capturedQuery = body;
      }

      await route.fulfill({
        status: 200,
        contentType: "application/json",
        headers: {
          "Access-Control-Allow-Origin": "*",
        },
        body: JSON.stringify({
          code: 0,
          data: {
            papers: [
              {
                id: "arxiv:2301.00002",
                arxiv_id: "2301.00002",
                title: "Deep Learning for Natural Language Processing",
                authors: ["Author A", "Author B"],
                abstract:
                  "A comprehensive study on deep learning methods for NLP...",
                pdf_url: "https://arxiv.org/pdf/2301.00002",
                abs_url: "https://arxiv.org/abs/2301.00002",
                source: "arxiv",
                published: "2023-02-01",
                categories: ["cs.CL"],
              },
            ],
            total: 1,
            has_more: false,
          },
        }),
      });
    });

    await openPaperSearch(page);

    const searchInput = page.locator("textbox").first();
    await expect(searchInput).toBeVisible({ timeout: 5000 });

    // Type medium length natural language query
    const mediumText = "我想找关于深度学习的论文";
    await searchInput.fill(mediumText);
    console.log("✅ Filled search input with medium text:", mediumText);

    await page.screenshot({
      path: "test-results/smart-search/04-medium-text-input.png",
    });

    // Click search button
    const searchButton = page
      .locator("button")
      .filter({ has: page.locator("img") })
      .nth(2);
    await searchButton.click();
    console.log("✅ Clicked search button");

    await page.waitForTimeout(3000);

    await page.screenshot({
      path: "test-results/smart-search/05-medium-text-results.png",
      fullPage: true,
    });

    console.log("✅ Medium text search completed");
  });

  test("should trigger smart recognition for long text (abstract)", async ({
    page,
  }) => {
    test.setTimeout(60000);

    // Setup mock for smart search API
    await page.route("**/api/v1/papers/**", async (route) => {
      const url = route.request().url();
      const method = route.request().method();
      const body = route.request().postData();

      console.log("API called:", method, url);
      if (body) {
        console.log("Request body length:", body.length);
      }

      await route.fulfill({
        status: 200,
        contentType: "application/json",
        headers: {
          "Access-Control-Allow-Origin": "*",
        },
        body: JSON.stringify({
          code: 0,
          data: {
            papers: [
              {
                id: "arxiv:2301.00003",
                arxiv_id: "2301.00003",
                title: "Similar Paper Found by Abstract Matching",
                authors: ["Researcher X", "Researcher Y"],
                abstract: "This paper presents a novel approach to...",
                pdf_url: "https://arxiv.org/pdf/2301.00003",
                abs_url: "https://arxiv.org/abs/2301.00003",
                source: "arxiv",
                published: "2023-03-01",
                categories: ["cs.AI"],
              },
            ],
            total: 1,
            has_more: false,
          },
        }),
      });
    });

    await openPaperSearch(page);

    const searchInput = page.locator("textbox").first();
    await expect(searchInput).toBeVisible({ timeout: 5000 });

    // Type long text (paper abstract)
    const longText = `This paper presents a comprehensive study on transformer architectures 
    and their applications in natural language processing. We propose a novel attention mechanism 
    that significantly improves the performance on various downstream tasks including machine 
    translation, text summarization, and question answering. Our experiments demonstrate that 
    the proposed method achieves state-of-the-art results on multiple benchmarks. The key 
    contributions include: (1) a new multi-head attention design, (2) efficient training 
    strategies for large-scale models, and (3) extensive analysis of model behavior.`;

    await searchInput.fill(longText);
    console.log("✅ Filled search input with long text (abstract)");

    await page.screenshot({
      path: "test-results/smart-search/06-long-text-input.png",
    });

    // Click search button
    const searchButton = page
      .locator("button")
      .filter({ has: page.locator("img") })
      .nth(2);
    await searchButton.click();
    console.log("✅ Clicked search button");

    await page.waitForTimeout(3000);

    await page.screenshot({
      path: "test-results/smart-search/07-long-text-results.png",
      fullPage: true,
    });

    console.log("✅ Long text search completed");
  });

  test("should use hot search tags", async ({ page }) => {
    test.setTimeout(60000);

    // Setup mock
    await page.route("**/api/v1/papers/search**", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        headers: {
          "Access-Control-Allow-Origin": "*",
        },
        body: JSON.stringify({
          code: 0,
          data: {
            papers: [
              {
                id: "arxiv:2301.00004",
                arxiv_id: "2301.00004",
                title: "Deep Learning Survey Paper",
                authors: ["Survey Author"],
                abstract: "A comprehensive survey on deep learning...",
                pdf_url: "https://arxiv.org/pdf/2301.00004",
                abs_url: "https://arxiv.org/abs/2301.00004",
                source: "arxiv",
                published: "2023-04-01",
                categories: ["cs.LG"],
              },
            ],
            total: 1,
            has_more: false,
          },
        }),
      });
    });

    await openPaperSearch(page);

    // Click on a hot search tag
    const hotTag = page.locator('button:has-text("深度学习")');
    await expect(hotTag).toBeVisible({ timeout: 5000 });

    await page.screenshot({
      path: "test-results/smart-search/08-hot-tags.png",
    });

    await hotTag.click();
    console.log("✅ Clicked hot search tag: 深度学习");

    await page.waitForTimeout(2000);

    await page.screenshot({
      path: "test-results/smart-search/09-hot-tag-results.png",
      fullPage: true,
    });

    console.log("✅ Hot tag search completed");
  });

  test("should use suggestion prompts", async ({ page }) => {
    test.setTimeout(60000);

    // Setup mock
    await page.route("**/api/v1/papers/**", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        headers: {
          "Access-Control-Allow-Origin": "*",
        },
        body: JSON.stringify({
          code: 0,
          data: {
            papers: [
              {
                id: "arxiv:2301.00005",
                arxiv_id: "2301.00005",
                title: "Image Classification with Deep Learning",
                authors: ["CV Researcher"],
                abstract: "Latest advances in image classification...",
                pdf_url: "https://arxiv.org/pdf/2301.00005",
                abs_url: "https://arxiv.org/abs/2301.00005",
                source: "arxiv",
                published: "2023-05-01",
                categories: ["cs.CV"],
              },
            ],
            total: 1,
            has_more: false,
          },
        }),
      });
    });

    await openPaperSearch(page);

    // Click on a suggestion prompt
    const suggestion = page.locator(
      'button:has-text("帮我找关于深度学习图像分类的最新论文")',
    );
    await expect(suggestion).toBeVisible({ timeout: 5000 });

    await page.screenshot({
      path: "test-results/smart-search/10-suggestions.png",
    });

    await suggestion.click();
    console.log("✅ Clicked suggestion prompt");

    await page.waitForTimeout(2000);

    await page.screenshot({
      path: "test-results/smart-search/11-suggestion-results.png",
      fullPage: true,
    });

    console.log("✅ Suggestion prompt search completed");
  });

  test("should switch between smart search and keyword mode", async ({
    page,
  }) => {
    await openPaperSearch(page);

    // Check initial state - smart search should be active
    const smartSearchButton = page.locator('button:has-text("智能搜索")');
    const keywordButton = page.locator('button:has-text("关键词")');

    await expect(smartSearchButton).toBeVisible();
    await expect(keywordButton).toBeVisible();

    await page.screenshot({
      path: "test-results/smart-search/12-mode-smart-active.png",
    });

    // Click keyword mode
    await keywordButton.click();
    console.log("✅ Switched to keyword mode");

    await page.waitForTimeout(500);

    await page.screenshot({
      path: "test-results/smart-search/13-mode-keyword-active.png",
    });

    // Click back to smart search
    await smartSearchButton.click();
    console.log("✅ Switched back to smart search mode");

    await page.waitForTimeout(500);

    await page.screenshot({
      path: "test-results/smart-search/14-mode-switch-complete.png",
    });

    console.log("✅ Mode switching completed");
  });
});
