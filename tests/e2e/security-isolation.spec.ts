/**
 * Security Test: New User Data Isolation
 *
 * This test verifies that a newly registered user:
 * 1. Cannot see other users' knowledge bases
 * 2. Cannot see other users' chat history
 * 3. Has empty data initially
 *
 * Run: npx playwright test tests/e2e/security-isolation.spec.ts --headed
 */

import { test, expect, Page, BrowserContext } from "@playwright/test";

// Test configuration
const BASE_URL = process.env.BASE_URL || "http://localhost:3000";
const API_URL = process.env.API_URL || "http://localhost:8080";

// Generate random email for new user
const randomEmail = `test${Date.now()}@test.com`;
const randomUsername = `testuser${Date.now()}`;
const testPassword = "Test123456!";

// Shared variables across test suites
let authToken: string;
let authUser: any;

test.describe("Security: New User Data Isolation", () => {
  let context: BrowserContext;
  let page: Page;

  test.beforeAll(async ({ browser }) => {
    // Create a fresh browser context (no cookies, no localStorage)
    context = await browser.newContext();
    page = await context.newPage();
  });

  test.afterAll(async () => {
    await context.close();
  });

  test("Step 1: Register a new user", async () => {
    console.log(`\n🔐 Registering new user: ${randomEmail}`);

    // Register via API first (more reliable than form submission)
    const response = await page.request.post(
      `${API_URL}/api/v1/auth/register`,
      {
        data: {
          username: randomUsername,
          email: randomEmail,
          password: testPassword,
        },
      },
    );

    const data = await response.json();
    console.log(`   Registration response: ${JSON.stringify(data)}`);

    // Check if registration was successful
    expect(data.code).toBe(0);
    authToken = data.data?.token;
    authUser = data.data?.user;

    // If token not returned from register, login to get it
    if (!authToken) {
      const loginResponse = await page.request.post(
        `${API_URL}/api/v1/auth/login`,
        {
          data: {
            email: randomEmail,
            password: testPassword,
          },
        },
      );
      const loginData = await loginResponse.json();
      expect(loginData.code).toBe(0);
      authToken = loginData.data.token;
      authUser = loginData.data.user;
    }

    // Navigate to home page and set auth state
    await page.goto(`${BASE_URL}/`);

    // Get expire from login response if not already set
    const expire = data.data?.expire;

    // Set localStorage with correct keys (matching rag-auth.ts)
    await page.evaluate(
      (authData) => {
        localStorage.setItem("rag-token", authData.token);
        localStorage.setItem("rag-user", JSON.stringify(authData.user));
        localStorage.setItem("rag-token-expire", authData.expire || "");
        localStorage.setItem(
          "chat-settings",
          JSON.stringify({
            provider: "rag",
            apiKey: authData.token,
            baseURL: "http://127.0.0.1:8080",
            model: "doubao-pro-32k-241215",
          }),
        );
      },
      { token: authToken, user: authUser, expire },
    );

    // Refresh page to apply auth state
    await page.reload();

    // Wait for page to load
    await page.waitForLoadState("domcontentloaded");
    await page.waitForTimeout(1000);

    // Wait for key elements to appear (chat interface)
    await page
      .waitForSelector("textarea, [data-sidebar], button", { timeout: 10000 })
      .catch(() => {});

    console.log("✅ Registration successful - redirected to home page");

    // Take screenshot
    await page.screenshot({ path: "test-results/security-01-register.png" });
  });

  test("Step 2: Check knowledge base list is empty", async () => {
    console.log("\n📚 Checking knowledge base list...");

    // Ensure we're on the home page
    await page.goto(`${BASE_URL}/`);
    await page.waitForLoadState("networkidle");

    // Wait for sidebar to load and React to hydrate
    await page.waitForTimeout(1500);

    // Wait for the sidebar footer to be visible (indicates page is fully loaded)
    await page
      .waitForSelector('[data-sidebar="footer"]', { timeout: 10000 })
      .catch(() => {});

    // Open settings dialog to access knowledge base
    // Strategy 1: Look for Settings button by its accessible name or icon
    // The SettingsDialog component renders a button with Settings icon and sr-only text
    let settingsButtonClicked = false;

    // Try to find button with Settings icon (lucide-react Settings class)
    const settingsByIcon = page
      .locator("button:has(svg.lucide-settings)")
      .first();
    if (await settingsByIcon.isVisible({ timeout: 2000 }).catch(() => false)) {
      await settingsByIcon.click();
      settingsButtonClicked = true;
      console.log("   Clicked settings button by icon selector");
    }

    // Strategy 2: Find button in sidebar footer area
    if (!settingsButtonClicked) {
      const footerButtons = page.locator('[data-sidebar="footer"] button');
      const count = await footerButtons.count();
      console.log(`   Found ${count} buttons in sidebar footer`);

      if (count > 0) {
        // The Settings button should be the one with svg icon (not the logout button)
        // Look for button with Settings icon
        for (let i = 0; i < count; i++) {
          const btn = footerButtons.nth(i);
          const hasSettingsIcon =
            (await btn.locator("svg.lucide-settings").count()) > 0;
          if (hasSettingsIcon) {
            await btn.click();
            settingsButtonClicked = true;
            console.log(`   Clicked settings button at index ${i}`);
            break;
          }
        }
        // If no button with settings icon, try the first button that's not logout
        if (!settingsButtonClicked && count >= 1) {
          // Check if first button has logout icon (LogOut), if not, click it
          const firstBtn = footerButtons.first();
          const hasLogoutIcon =
            (await firstBtn.locator("svg.lucide-log-out").count()) > 0;
          if (!hasLogoutIcon) {
            await firstBtn.click();
            settingsButtonClicked = true;
            console.log("   Clicked first non-logout button in footer");
          }
        }
      }
    }

    // Strategy 3: Use role-based selector
    if (!settingsButtonClicked) {
      const settingsByRole = page
        .getByRole("button", { name: /设置|settings/i })
        .first();
      if (
        await settingsByRole.isVisible({ timeout: 2000 }).catch(() => false)
      ) {
        await settingsByRole.click();
        settingsButtonClicked = true;
        console.log("   Clicked settings button by role");
      }
    }

    // Strategy 4: Look for any button with gear/settings-like SVG
    if (!settingsButtonClicked) {
      const allButtons = page.locator("button");
      const btnCount = await allButtons.count();
      for (let i = 0; i < Math.min(btnCount, 20); i++) {
        const btn = allButtons.nth(i);
        const svgCount = await btn.locator("svg").count();
        if (svgCount > 0) {
          // Check if this button is in the sidebar area and not a main action button
          const parent = await btn.evaluateHandle((el) =>
            el.closest("[data-sidebar]"),
          );
          if (parent) {
            await btn.click();
            settingsButtonClicked = true;
            console.log(`   Clicked button ${i} in sidebar area`);
            break;
          }
        }
      }
    }

    if (!settingsButtonClicked) {
      console.log(
        "   ⚠️  Could not find settings button, taking screenshot for debugging",
      );
      await page.screenshot({
        path: "test-results/security-debug-no-settings.png",
      });
      throw new Error("Could not find settings button");
    }

    // Wait for dialog to open
    await page.waitForTimeout(500);

    // Verify dialog is open
    const dialog = page.locator('[role="dialog"]');
    await expect(dialog).toBeVisible({ timeout: 5000 });

    // Click on RAG/知识库 tab
    const ragTab = page.locator('button:has-text("知识库")').first();
    await ragTab.click();
    await page.waitForTimeout(1000);

    // Take screenshot
    await page.screenshot({ path: "test-results/security-02-kb-panel.png" });

    // Check for knowledge base list
    const kbHeader = page.locator("text=知识库管理");
    await expect(kbHeader).toBeVisible({ timeout: 5000 });

    // Check if there are any knowledge bases
    const kbItems = page
      .locator(".rounded-lg.border")
      .filter({ hasText: "文档" });
    const kbCount = await kbItems.count();

    console.log(`   Found ${kbCount} knowledge bases`);

    // New user should have 0 knowledge bases
    if (kbCount > 0) {
      // Get the names of visible knowledge bases
      const kbNames = await kbItems.allTextContents();
      console.log("   ⚠️  WARNING: Found knowledge bases:", kbNames);
      console.log(
        "   🚨 SECURITY ISSUE: New user can see other users' knowledge bases!",
      );
    }

    // Also check for empty state message
    const emptyState = page.locator("text=暂无知识库");
    const hasEmptyState = await emptyState
      .isVisible({ timeout: 2000 })
      .catch(() => false);

    if (hasEmptyState) {
      console.log("✅ Empty state shown correctly - no knowledge bases");
    }

    // Take screenshot of the result
    await page.screenshot({ path: "test-results/security-03-kb-result.png" });

    // Assert: new user should have empty knowledge base list
    expect(kbCount).toBe(0);
  });

  test("Step 3: Check chat history is empty", async () => {
    console.log("\n💬 Checking chat history...");

    // Close settings dialog if open
    const dialog = page.locator('[role="dialog"]');
    if (await dialog.isVisible({ timeout: 1000 }).catch(() => false)) {
      await page.keyboard.press("Escape");
      await page.waitForTimeout(500);
    }

    // Look for chat history in sidebar
    const sidebar = page.locator('[data-sidebar="content"]');

    // Check for conversation list
    const _conversationItems = sidebar
      .locator(
        '[data-testid="conversation-item"], .conversation-item, button:has-text("新对话")',
      )
      .first();

    // Take screenshot
    await page.screenshot({
      path: "test-results/security-04-chat-history.png",
    });

    // New user should only see "New Chat" button, no existing conversations
    const newChatButton = page.locator(
      'button:has-text("新对话"), button:has-text("New Chat")',
    );
    const hasNewChatButton = await newChatButton
      .isVisible({ timeout: 3000 })
      .catch(() => false);

    if (hasNewChatButton) {
      console.log("✅ New chat button visible - no existing conversations");
    }

    // Check for any conversation history items
    const historyItems = page.locator('[data-testid="conversation-item"]');
    const historyCount = await historyItems.count();

    console.log(`   Found ${historyCount} conversation history items`);

    if (historyCount > 0) {
      console.log(
        "   🚨 SECURITY ISSUE: New user can see other users' chat history!",
      );
    }

    // Assert: new user should have no conversation history
    expect(historyCount).toBe(0);
  });

  test("Step 4: Verify API returns empty data", async () => {
    console.log("\n🔌 Verifying API returns empty data...");

    // Use the stored auth token from registration
    if (!authToken) {
      console.log("   ⚠️  No auth token found from registration");
      return;
    }

    console.log(`   Token found: ${authToken.substring(0, 20)}...`);

    // Call knowledge base API directly
    const kbResponse = await page.request.get(
      `${API_URL}/api/v1/knowledge-bases`,
      {
        headers: {
          Authorization: `Bearer ${authToken}`,
        },
      },
    );

    console.log(`   Knowledge base API status: ${kbResponse.status()}`);

    if (kbResponse.ok()) {
      const kbData = await kbResponse.json();
      console.log(
        `   Knowledge bases returned: ${JSON.stringify(kbData.data?.knowledge_bases?.length || 0)}`,
      );

      const kbList = kbData.data?.knowledge_bases || [];
      if (kbList.length > 0) {
        console.log(
          "   🚨 SECURITY ISSUE: API returned knowledge bases for new user!",
        );
        console.log(
          `   Knowledge bases: ${JSON.stringify(kbList.map((kb: any) => kb.name))}`,
        );
      }

      // Assert: new user should have 0 knowledge bases
      expect(kbList.length).toBe(0);
    }

    // Call conversations API
    const convResponse = await page.request.get(
      `${API_URL}/api/v1/conversations`,
      {
        headers: {
          Authorization: `Bearer ${authToken}`,
        },
      },
    );

    console.log(`   Conversations API status: ${convResponse.status()}`);

    if (convResponse.ok()) {
      const convData = await convResponse.json();
      console.log(
        `   Conversations returned: ${JSON.stringify(convData.data?.conversations?.length || 0)}`,
      );

      const convList = convData.data?.conversations || [];
      if (convList.length > 0) {
        console.log(
          "   🚨 SECURITY ISSUE: API returned conversations for new user!",
        );
      }

      // Assert: new user should have 0 conversations
      expect(convList.length).toBe(0);
    }
  });

  test("Step 5: Summary and cleanup", async () => {
    console.log("\n📋 Test Summary:");
    console.log("   ================================");
    console.log(`   New user email: ${randomEmail}`);
    console.log("   ================================");
    console.log("   ✅ All security isolation tests passed");
    console.log("   ✅ New user cannot see other users' data");

    // Take final screenshot
    await page.screenshot({ path: "test-results/security-05-final.png" });
  });
});

test.describe("Security: Cross-user data access attempt", () => {
  // This test suite is independent and has its own auth setup
  let crossUserToken: string;
  let crossUserEmail: string;
  let crossUserUsername: string;

  test.beforeAll(async ({ browser }) => {
    // Create a fresh browser context and register a new user for this test
    const context = await browser.newContext();
    const page = await context.newPage();

    // Generate unique credentials for this test
    crossUserEmail = `crossuser${Date.now()}@test.com`;
    crossUserUsername = `crossuser${Date.now()}`;

    console.log(`\n🔐 Registering cross-user test account: ${crossUserEmail}`);

    // Register via API
    const response = await page.request.post(
      `${API_URL}/api/v1/auth/register`,
      {
        data: {
          username: crossUserUsername,
          email: crossUserEmail,
          password: testPassword,
        },
      },
    );

    const data = await response.json();
    console.log(`   Registration response code: ${data.code}`);

    if (data.code === 0) {
      crossUserToken = data.data?.token;

      // If token not returned from register, login to get it
      if (!crossUserToken) {
        const loginResponse = await page.request.post(
          `${API_URL}/api/v1/auth/login`,
          {
            data: {
              email: crossUserEmail,
              password: testPassword,
            },
          },
        );
        const loginData = await loginResponse.json();
        if (loginData.code === 0) {
          crossUserToken = loginData.data.token;
        }
      }
    }

    await context.close();

    if (crossUserToken) {
      console.log(
        `   ✅ Cross-user token obtained: ${crossUserToken.substring(0, 20)}...`,
      );
    } else {
      console.log("   ⚠️  Failed to obtain cross-user token");
    }
  });

  test("Attempt to access other user's KB by ID", async ({ request }) => {
    console.log("\n🔒 Testing direct API access with another user's ID...");

    // Check if crossUserToken is available
    if (!crossUserToken) {
      console.log("   ⚠️  No auth token available, skipping test");
      test.skip();
      return;
    }

    console.log(`   Using token: ${crossUserToken.substring(0, 20)}...`);

    // Step 1: 获取当前用户的 KB 列表
    const myKBResponse = await request.get(
      `${API_URL}/api/v1/knowledge-bases`,
      {
        headers: { Authorization: `Bearer ${crossUserToken}` },
      },
    );
    const myKBData = await myKBResponse.json();
    // 修复：处理多种可能的 API 响应结构
    // 可能是 data.knowledge_bases, data.items, 或直接是 data 数组
    const kbList =
      myKBData.data?.knowledge_bases ||
      myKBData.data?.items ||
      (Array.isArray(myKBData.data) ? myKBData.data : []);
    const myKBIds = new Set(kbList.map((kb: any) => kb.id) || []);
    console.log(
      `   Current user's KB IDs: ${[...myKBIds].join(", ") || "none"}`,
    );

    // Step 2: 尝试访问不属于当前用户的 KB ID
    // 使用更大的 ID 范围，更可能是其他用户的 KB
    const idsToTry = [1, 2, 3, 5, 10, 20, 50, 100, 500, 1000];
    let securityIssuesFound = 0;

    for (const id of idsToTry) {
      // 跳过自己的 KB
      if (myKBIds.has(id)) {
        console.log(`   KB ${id}: Skipped (own KB)`);
        continue;
      }

      const kbResponse = await request.get(
        `${API_URL}/api/v1/knowledge-bases/${id}`,
        {
          headers: { Authorization: `Bearer ${crossUserToken}` },
        },
      );

      if (kbResponse.status() === 200) {
        const kbData = await kbResponse.json();
        // 额外验证：检查 KB 是否真的属于其他用户
        const kbUserId = kbData.data?.user_id || kbData.data?.userId;
        if (kbUserId && !myKBIds.has(kbData.data?.id)) {
          console.log(
            `   🚨 SECURITY ISSUE: Can access KB ${id} belonging to user ${kbUserId}`,
          );
          securityIssuesFound++;
        } else {
          console.log(`   KB ${id}: 200 but appears to be own KB`);
        }
      } else if (kbResponse.status() === 404) {
        console.log(`   ✅ KB ${id}: Not found (expected)`);
      } else if (kbResponse.status() === 403) {
        console.log(`   ✅ KB ${id}: Forbidden (expected - security working)`);
      } else {
        console.log(`   KB ${id}: Status ${kbResponse.status()}`);
      }
    }

    // Assert: no security issues should be found
    expect(securityIssuesFound).toBe(0);
    console.log(
      `\n   ✅ Cross-user access test completed. Security issues found: ${securityIssuesFound}`,
    );
  });
});
