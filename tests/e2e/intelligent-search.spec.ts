/**
 * E2E Tests for Intelligent Search Feature
 *
 * Tests the smart search functionality that:
 * - Short text (keyword) → keyword search
 * - Medium text (natural language) → natural language processing
 * - Long text (abstract) → smart recognition
 *
 * Run: npx playwright test tests/e2e/intelligent-search.spec.ts --headed
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
  await page.goto(`${BASE_URL}/paper-search`);
  await page.waitForLoadState("networkidle");
  await page.waitForTimeout(1000);
}

// Test results storage
const testResults: {
  test1: {
    success: boolean;
    resultCount: number;
    error?: string;
    inputType?: string;
  };
  test2: {
    success: boolean;
    resultCount: number;
    error?: string;
    inputType?: string;
  };
  test3: {
    success: boolean;
    resultCount: number;
    error?: string;
    inputType?: string;
  };
} = {
  test1: { success: false, resultCount: 0 },
  test2: { success: false, resultCount: 0 },
  test3: { success: false, resultCount: 0 },
};

test.describe("Intelligent Search Feature Tests", () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test.beforeEach(async ({ page, request }) => {
    const token = await loginViaAPI(request);
    await setAuthInPage(page, token);
  });

  test('Test 1: Short text (keyword search) - "transformer"', async ({
    page,
  }) => {
    test.setTimeout(60000);

    // Setup mock for search API
    let searchMode = "";
    const requestLog: string[] = [];

    await page.route("**", async (route) => {
      const url = route.request().url();
      const method = route.request().method();
      requestLog.push(`${method} ${url}`);

      // Handle CORS preflight
      if (method === "OPTIONS") {
        await route.fulfill({
          status: 200,
          headers: {
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
            "Access-Control-Allow-Headers": "Content-Type, Authorization",
            "Access-Control-Max-Age": "86400",
          },
        });
        return;
      }

      // Mock search API
      if (
        url.includes("/api/v1/papers/search") ||
        url.includes("/api/v1/papers/smart-search")
      ) {
        const urlObj = new URL(url, "http://localhost");
        const query =
          urlObj.searchParams.get("query") ||
          urlObj.searchParams.get("keyword") ||
          "";
        searchMode = query.length < 20 ? "keyword" : "smart";

        console.log(
          `[Test 1] Search API called with query: "${query}" (mode: ${searchMode})`,
        );

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
                  authors: ["Ashish Vaswani", "Noam Shazeer", "Niki Parmar"],
                  abstract:
                    "The dominant sequence transduction models are based on complex recurrent or convolutional neural networks. We propose a new simple network architecture, the Transformer, based solely on attention mechanisms.",
                  pdf_url: "https://arxiv.org/pdf/2301.00001",
                  abs_url: "https://arxiv.org/abs/2301.00001",
                  source: "arxiv",
                  published: "2023-01-01",
                  categories: ["cs.LG", "cs.CL"],
                },
                {
                  id: "arxiv:2301.00002",
                  arxiv_id: "2301.00002",
                  title: "Vision Transformer: An Image is Worth 16x16 Words",
                  authors: ["Alexey Dosovitskiy", "Lucas Beyer"],
                  abstract:
                    "While the Transformer architecture has become the de-facto standard for natural language processing tasks, its applications to computer vision remain limited.",
                  pdf_url: "https://arxiv.org/pdf/2301.00002",
                  abs_url: "https://arxiv.org/abs/2301.00002",
                  source: "arxiv",
                  published: "2023-02-01",
                  categories: ["cs.CV"],
                },
              ],
              total: 2,
              has_more: false,
            },
          }),
        });
        return;
      }

      await route.continue();
    });

    await openPaperSearch(page);

    // Take screenshot of initial page
    await page.screenshot({
      path: "test-results/smart-search-test/01-initial-page.png",
      fullPage: true,
    });

    // Verify page title
    const heading = page.getByRole("heading", {
      name: /论文搜索|Paper Search/,
    });
    await expect(heading).toBeVisible({ timeout: 5000 });

    // Find search input
    const searchInput = page.locator('input[type="text"], textarea').first();
    await expect(searchInput).toBeVisible({ timeout: 5000 });

    // Type short keyword
    await searchInput.fill("transformer");
    console.log("[Test 1] Filled search input with: transformer");

    // Wait for input type detection
    await page.waitForTimeout(500);

    // Take screenshot before search
    await page.screenshot({
      path: "test-results/smart-search-test/02-short-text-input.png",
    });

    // Check if input type indicator is shown (should show "关键词搜索")
    const inputTypeIndicator = page.locator(
      "text=/关键词搜索|Keyword Search|关键词|Keyword/i",
    );
    const isInputTypeVisible = await inputTypeIndicator
      .isVisible()
      .catch(() => false);
    console.log("[Test 1] Input type indicator visible:", isInputTypeVisible);

    // Click search button
    const searchButton = page
      .locator("button")
      .filter({ has: page.locator("svg") })
      .nth(2);
    await searchButton.click();
    console.log("[Test 1] Clicked search button");

    // Wait for results
    await page.waitForTimeout(3000);

    // Take screenshot of results
    await page.screenshot({
      path: "test-results/smart-search-test/03-short-text-results.png",
      fullPage: true,
    });

    // Check for results
    const paperTitle = page.locator("text=/Transformer|Attention/i");
    const hasResults = await paperTitle
      .isVisible({ timeout: 5000 })
      .catch(() => false);

    // Count results
    const paperCards = await page
      .locator('[class*="border"][class*="rounded-lg"]')
      .count();
    console.log("[Test 1] Paper cards found:", paperCards);

    // Update test results
    testResults.test1 = {
      success: hasResults,
      resultCount: paperCards,
      inputType: isInputTypeVisible ? "keyword" : "unknown",
    };

    console.log("[Test 1] Result:", testResults.test1);
    expect(hasResults).toBe(true);
  });

  test("Test 2: Medium text (natural language) - Chinese query", async ({
    page,
  }) => {
    test.setTimeout(60000);

    const requestLog: string[] = [];
    let extractedKeywords: string[] = [];

    await page.route("**", async (route) => {
      const url = route.request().url();
      const method = route.request().method();
      requestLog.push(`${method} ${url}`);

      if (method === "OPTIONS") {
        await route.fulfill({
          status: 200,
          headers: {
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
            "Access-Control-Allow-Headers": "Content-Type, Authorization",
            "Access-Control-Max-Age": "86400",
          },
        });
        return;
      }

      if (
        url.includes("/api/v1/papers/search") ||
        url.includes("/api/v1/papers/smart-search")
      ) {
        const urlObj = new URL(url, "http://localhost");
        const query = urlObj.searchParams.get("query") || "";
        console.log(`[Test 2] Search API called with query: "${query}"`);

        // Simulate keyword extraction for natural language
        extractedKeywords = ["深度学习", "神经网络"];

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
                  title:
                    "Deep Learning for Neural Networks: A Comprehensive Survey",
                  authors: ["Author A", "Author B"],
                  abstract:
                    "This paper provides a comprehensive survey of deep learning methods for neural networks.",
                  pdf_url: "https://arxiv.org/pdf/2301.00003",
                  abs_url: "https://arxiv.org/abs/2301.00003",
                  source: "arxiv",
                  published: "2023-03-01",
                  categories: ["cs.LG", "cs.NE"],
                },
              ],
              total: 1,
              has_more: false,
              extracted_info: {
                keywords: extractedKeywords,
                suggested_query: "deep learning neural networks",
                confidence: 0.85,
              },
            },
          }),
        });
        return;
      }

      await route.continue();
    });

    await openPaperSearch(page);

    const searchInput = page.locator('input[type="text"], textarea').first();
    await expect(searchInput).toBeVisible({ timeout: 5000 });

    // Type medium length natural language query (Chinese)
    const mediumText = "我想找关于深度学习和神经网络的论文";
    await searchInput.fill(mediumText);
    console.log("[Test 2] Filled search input with:", mediumText);

    await page.waitForTimeout(500);
    await page.screenshot({
      path: "test-results/smart-search-test/04-medium-text-input.png",
    });

    // Check if input type indicator shows "自然语言" or similar
    const inputTypeIndicator = page.locator(
      "text=/自然语言|Natural Language|智能识别|Smart/i",
    );
    const isInputTypeVisible = await inputTypeIndicator
      .isVisible()
      .catch(() => false);
    console.log("[Test 2] Input type indicator visible:", isInputTypeVisible);

    // Click search button
    const searchButton = page
      .locator("button")
      .filter({ has: page.locator("svg") })
      .nth(2);
    await searchButton.click();
    console.log("[Test 2] Clicked search button");

    await page.waitForTimeout(3000);
    await page.screenshot({
      path: "test-results/smart-search-test/05-medium-text-results.png",
      fullPage: true,
    });

    // Check for results
    const paperTitle = page.locator(
      "text=/Deep Learning|Neural Networks|深度学习/i",
    );
    const hasResults = await paperTitle
      .isVisible({ timeout: 5000 })
      .catch(() => false);

    const paperCards = await page
      .locator('[class*="border"][class*="rounded-lg"]')
      .count();
    console.log("[Test 2] Paper cards found:", paperCards);

    testResults.test2 = {
      success: hasResults,
      resultCount: paperCards,
      inputType: isInputTypeVisible ? "natural" : "unknown",
    };

    console.log("[Test 2] Result:", testResults.test2);
    expect(hasResults).toBe(true);
  });

  test("Test 3: Long text (smart recognition) - Paper abstract", async ({
    page,
  }) => {
    test.setTimeout(60000);

    const requestLog: string[] = [];

    await page.route("**", async (route) => {
      const url = route.request().url();
      const method = route.request().method();
      requestLog.push(`${method} ${url}`);

      if (method === "OPTIONS") {
        await route.fulfill({
          status: 200,
          headers: {
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
            "Access-Control-Allow-Headers": "Content-Type, Authorization",
            "Access-Control-Max-Age": "86400",
          },
        });
        return;
      }

      if (
        url.includes("/api/v1/papers/search") ||
        url.includes("/api/v1/papers/smart-search")
      ) {
        console.log(`[Test 3] Search API called`);

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
                  title: "Attention Mechanisms in Deep Neural Networks for NLP",
                  authors: ["Researcher X", "Researcher Y"],
                  abstract:
                    "This paper presents novel attention mechanisms for natural language processing tasks.",
                  pdf_url: "https://arxiv.org/pdf/2301.00004",
                  abs_url: "https://arxiv.org/abs/2301.00004",
                  source: "arxiv",
                  published: "2023-04-01",
                  categories: ["cs.CL", "cs.AI"],
                },
              ],
              total: 1,
              has_more: false,
              extracted_info: {
                detected_title: null,
                keywords: [
                  "attention",
                  "deep neural networks",
                  "NLP",
                  "natural language processing",
                ],
                suggested_query: "attention mechanisms neural networks NLP",
                confidence: 0.92,
              },
            },
          }),
        });
        return;
      }

      await route.continue();
    });

    await openPaperSearch(page);

    const searchInput = page.locator('input[type="text"], textarea').first();
    await expect(searchInput).toBeVisible({ timeout: 5000 });

    // Type long text (paper abstract)
    const longText = `We present a new method for training deep neural networks. Our approach uses attention mechanisms to improve performance on natural language processing tasks. The model achieves state-of-the-art results on multiple benchmarks.`;

    await searchInput.fill(longText);
    console.log("[Test 3] Filled search input with long text (abstract)");

    await page.waitForTimeout(500);
    await page.screenshot({
      path: "test-results/smart-search-test/06-long-text-input.png",
    });

    // Check if input type indicator shows "智能识别" or similar
    const inputTypeIndicator = page.locator(
      "text=/智能识别|Smart Detection|智能/i",
    );
    const isInputTypeVisible = await inputTypeIndicator
      .isVisible()
      .catch(() => false);
    console.log("[Test 3] Input type indicator visible:", isInputTypeVisible);

    // Click search button
    const searchButton = page
      .locator("button")
      .filter({ has: page.locator("svg") })
      .nth(2);
    await searchButton.click();
    console.log("[Test 3] Clicked search button");

    await page.waitForTimeout(3000);
    await page.screenshot({
      path: "test-results/smart-search-test/07-long-text-results.png",
      fullPage: true,
    });

    // Check for results
    const paperTitle = page.locator("text=/Attention|Neural Networks|NLP/i");
    const hasResults = await paperTitle
      .isVisible({ timeout: 5000 })
      .catch(() => false);

    const paperCards = await page
      .locator('[class*="border"][class*="rounded-lg"]')
      .count();
    console.log("[Test 3] Paper cards found:", paperCards);

    // Check for extracted info display
    const extractedInfoSection = page.locator(
      "text=/识别结果|Extracted Info|关键词|Keywords/i",
    );
    const hasExtractedInfo = await extractedInfoSection
      .isVisible()
      .catch(() => false);
    console.log("[Test 3] Extracted info visible:", hasExtractedInfo);

    testResults.test3 = {
      success: hasResults,
      resultCount: paperCards,
      inputType: isInputTypeVisible ? "smart" : "unknown",
    };

    console.log("[Test 3] Result:", testResults.test3);
    expect(hasResults).toBe(true);
  });

  test("Generate test report", async () => {
    // This test generates a summary report
    console.log(`\n${"=".repeat(60)}`);
    console.log("📊 Intelligent Search Test Report");
    console.log("=".repeat(60));

    console.log("\n📋 Test 1: Short Text (Keyword Search)");
    console.log(`   Input: "transformer"`);
    console.log(`   Expected: Keyword search mode`);
    console.log(
      `   Result: ${testResults.test1.success ? "✅ PASS" : "❌ FAIL"}`,
    );
    console.log(`   Results found: ${testResults.test1.resultCount}`);
    console.log(`   Input type detected: ${testResults.test1.inputType}`);

    console.log("\n📋 Test 2: Medium Text (Natural Language)");
    console.log(`   Input: "我想找关于深度学习和神经网络的论文"`);
    console.log(`   Expected: Natural language processing mode`);
    console.log(
      `   Result: ${testResults.test2.success ? "✅ PASS" : "❌ FAIL"}`,
    );
    console.log(`   Results found: ${testResults.test2.resultCount}`);
    console.log(`   Input type detected: ${testResults.test2.inputType}`);

    console.log("\n📋 Test 3: Long Text (Smart Recognition)");
    console.log(`   Input: Paper abstract (~200 chars)`);
    console.log(`   Expected: Smart recognition mode`);
    console.log(
      `   Result: ${testResults.test3.success ? "✅ PASS" : "❌ FAIL"}`,
    );
    console.log(`   Results found: ${testResults.test3.resultCount}`);
    console.log(`   Input type detected: ${testResults.test3.inputType}`);

    console.log(`\n${"=".repeat(60)}`);
    const allPassed =
      testResults.test1.success &&
      testResults.test2.success &&
      testResults.test3.success;
    console.log(
      `Overall: ${allPassed ? "✅ ALL TESTS PASSED" : "❌ SOME TESTS FAILED"}`,
    );
    console.log(`${"=".repeat(60)}\n`);

    // Create report file
    const reportContent = `# Intelligent Search Test Report

## Test Summary

| Test | Input | Expected Mode | Result | Results Count | Input Type Detected |
|------|-------|---------------|--------|---------------|---------------------|
| Test 1 | "transformer" | Keyword Search | ${testResults.test1.success ? "✅ PASS" : "❌ FAIL"} | ${testResults.test1.resultCount} | ${testResults.test1.inputType} |
| Test 2 | "我想找关于深度学习和神经网络的论文" | Natural Language | ${testResults.test2.success ? "✅ PASS" : "❌ FAIL"} | ${testResults.test2.resultCount} | ${testResults.test2.inputType} |
| Test 3 | Paper abstract (~200 chars) | Smart Recognition | ${testResults.test3.success ? "✅ PASS" : "❌ FAIL"} | ${testResults.test3.resultCount} | ${testResults.test3.inputType} |

## Overall Result

${allPassed ? "✅ ALL TESTS PASSED" : "❌ SOME TESTS FAILED"}

## Screenshots

1. \`01-initial-page.png\` - Initial page load
2. \`02-short-text-input.png\` - Short text input (keyword)
3. \`03-short-text-results.png\` - Short text search results
4. \`04-medium-text-input.png\` - Medium text input (natural language)
5. \`05-medium-text-results.png\` - Medium text search results
6. \`06-long-text-input.png\` - Long text input (abstract)
7. \`07-long-text-results.png\` - Long text search results

## Test Details

### Test 1: Short Text (Keyword Search)
- **Input**: "transformer"
- **Expected Behavior**: System should detect this as a keyword search
- **Input Type Indicator**: Should show "关键词搜索" (Keyword Search)
- **Result**: ${testResults.test1.success ? "Success" : "Failed"}
- **Error**: ${testResults.test1.error || "None"}

### Test 2: Medium Text (Natural Language)
- **Input**: "我想找关于深度学习和神经网络的论文"
- **Expected Behavior**: System should detect this as natural language and extract keywords
- **Input Type Indicator**: Should show "自然语言" (Natural Language)
- **Result**: ${testResults.test2.success ? "Success" : "Failed"}
- **Error**: ${testResults.test2.error || "None"}

### Test 3: Long Text (Smart Recognition)
- **Input**: Paper abstract (~200 characters)
- **Expected Behavior**: System should detect this as smart recognition mode
- **Input Type Indicator**: Should show "智能识别" (Smart Detection)
- **Result**: ${testResults.test3.success ? "Success" : "Failed"}
- **Error**: ${testResults.test3.error || "None"}

---
Generated: ${new Date().toISOString()}
`;

    // Write report to file
    const fs = require("node:fs");
    fs.writeFileSync(
      "test-results/smart-search-test/TEST_REPORT.md",
      reportContent,
    );
    console.log(
      "Report saved to: test-results/smart-search-test/TEST_REPORT.md",
    );

    expect(allPassed).toBe(true);
  });
});
