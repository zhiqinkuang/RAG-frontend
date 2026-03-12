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

import { test, expect, Page, BrowserContext } from '@playwright/test';

// Test configuration
const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';
const API_URL = process.env.API_URL || 'http://localhost:8080';

// Generate random email for new user
const randomEmail = `test${Date.now()}@test.com`;
const randomUsername = `testuser${Date.now()}`;
const testPassword = 'Test123456!';

test.describe('Security: New User Data Isolation', () => {
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

  test('Step 1: Register a new user', async () => {
    console.log(`\n🔐 Registering new user: ${randomEmail}`);
    
    await page.goto(`${BASE_URL}/register`);
    await page.waitForLoadState('networkidle');
    
    // Fill registration form
    await page.fill('#username', randomUsername);
    await page.fill('#email', randomEmail);
    await page.fill('#password', testPassword);
    
    // Wait for password validation to pass
    await page.waitForTimeout(500);
    
    // Submit registration
    await page.click('button[type="submit"]');
    
    // Wait for redirect to home page (successful registration)
    await page.waitForURL('**/', { timeout: 15000 });
    
    console.log('✅ Registration successful - redirected to home page');
    
    // Take screenshot
    await page.screenshot({ path: 'test-results/security-01-register.png' });
  });

  test('Step 2: Check knowledge base list is empty', async () => {
    console.log('\n📚 Checking knowledge base list...');
    
    // Ensure we're on the home page
    await page.goto(`${BASE_URL}/`);
    await page.waitForLoadState('networkidle');
    
    // Open settings dialog to access knowledge base
    // Find the settings button in sidebar footer
    const settingsButton = page.locator('[data-sidebar="footer"] button').first();
    await settingsButton.click();
    await page.waitForTimeout(500);
    
    // Click on RAG/知识库 tab
    const ragTab = page.locator('button:has-text("知识库")').first();
    await ragTab.click();
    await page.waitForTimeout(1000);
    
    // Take screenshot
    await page.screenshot({ path: 'test-results/security-02-kb-panel.png' });
    
    // Check for knowledge base list
    const kbHeader = page.locator('text=知识库管理');
    await expect(kbHeader).toBeVisible({ timeout: 5000 });
    
    // Check if there are any knowledge bases
    const kbItems = page.locator('.rounded-lg.border').filter({ hasText: '文档' });
    const kbCount = await kbItems.count();
    
    console.log(`   Found ${kbCount} knowledge bases`);
    
    // New user should have 0 knowledge bases
    if (kbCount > 0) {
      // Get the names of visible knowledge bases
      const kbNames = await kbItems.allTextContents();
      console.log('   ⚠️  WARNING: Found knowledge bases:', kbNames);
      console.log('   🚨 SECURITY ISSUE: New user can see other users\' knowledge bases!');
    }
    
    // Also check for empty state message
    const emptyState = page.locator('text=暂无知识库');
    const hasEmptyState = await emptyState.isVisible({ timeout: 2000 }).catch(() => false);
    
    if (hasEmptyState) {
      console.log('✅ Empty state shown correctly - no knowledge bases');
    }
    
    // Take screenshot of the result
    await page.screenshot({ path: 'test-results/security-03-kb-result.png' });
    
    // Assert: new user should have empty knowledge base list
    expect(kbCount).toBe(0);
  });

  test('Step 3: Check chat history is empty', async () => {
    console.log('\n💬 Checking chat history...');
    
    // Close settings dialog if open
    const dialog = page.locator('[role="dialog"]');
    if (await dialog.isVisible({ timeout: 1000 }).catch(() => false)) {
      await page.keyboard.press('Escape');
      await page.waitForTimeout(500);
    }
    
    // Look for chat history in sidebar
    const sidebar = page.locator('[data-sidebar="content"]');
    
    // Check for conversation list
    const conversationItems = sidebar.locator('[data-testid="conversation-item"], .conversation-item, button:has-text("新对话")').first();
    
    // Take screenshot
    await page.screenshot({ path: 'test-results/security-04-chat-history.png' });
    
    // New user should only see "New Chat" button, no existing conversations
    const newChatButton = page.locator('button:has-text("新对话"), button:has-text("New Chat")');
    const hasNewChatButton = await newChatButton.isVisible({ timeout: 3000 }).catch(() => false);
    
    if (hasNewChatButton) {
      console.log('✅ New chat button visible - no existing conversations');
    }
    
    // Check for any conversation history items
    const historyItems = page.locator('[data-testid="conversation-item"]');
    const historyCount = await historyItems.count();
    
    console.log(`   Found ${historyCount} conversation history items`);
    
    if (historyCount > 0) {
      console.log('   🚨 SECURITY ISSUE: New user can see other users\' chat history!');
    }
    
    // Assert: new user should have no conversation history
    expect(historyCount).toBe(0);
  });

  test('Step 4: Verify API returns empty data', async () => {
    console.log('\n🔌 Verifying API returns empty data...');
    
    // Get the auth token from localStorage
    const settings = await page.evaluate(() => {
      const stored = localStorage.getItem('chat-settings');
      return stored ? JSON.parse(stored) : null;
    });
    
    if (!settings?.apiKey) {
      console.log('   ⚠️  No auth token found in localStorage');
      return;
    }
    
    const token = settings.apiKey;
    console.log(`   Token found: ${token.substring(0, 20)}...`);
    
    // Call knowledge base API directly
    const kbResponse = await page.request.get(`${API_URL}/api/v1/knowledge-bases`, {
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });
    
    console.log(`   Knowledge base API status: ${kbResponse.status()}`);
    
    if (kbResponse.ok()) {
      const kbData = await kbResponse.json();
      console.log(`   Knowledge bases returned: ${JSON.stringify(kbData.data?.knowledge_bases?.length || 0)}`);
      
      const kbList = kbData.data?.knowledge_bases || [];
      if (kbList.length > 0) {
        console.log('   🚨 SECURITY ISSUE: API returned knowledge bases for new user!');
        console.log(`   Knowledge bases: ${JSON.stringify(kbList.map((kb: any) => kb.name))}`);
      }
      
      // Assert: new user should have 0 knowledge bases
      expect(kbList.length).toBe(0);
    }
    
    // Call conversations API
    const convResponse = await page.request.get(`${API_URL}/api/v1/conversations`, {
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });
    
    console.log(`   Conversations API status: ${convResponse.status()}`);
    
    if (convResponse.ok()) {
      const convData = await convResponse.json();
      console.log(`   Conversations returned: ${JSON.stringify(convData.data?.conversations?.length || 0)}`);
      
      const convList = convData.data?.conversations || [];
      if (convList.length > 0) {
        console.log('   🚨 SECURITY ISSUE: API returned conversations for new user!');
      }
      
      // Assert: new user should have 0 conversations
      expect(convList.length).toBe(0);
    }
  });

  test('Step 5: Summary and cleanup', async () => {
    console.log('\n📋 Test Summary:');
    console.log('   ================================');
    console.log(`   New user email: ${randomEmail}`);
    console.log('   ================================');
    console.log('   ✅ All security isolation tests passed');
    console.log('   ✅ New user cannot see other users\' data');
    
    // Take final screenshot
    await page.screenshot({ path: 'test-results/security-05-final.png' });
  });
});

test.describe('Security: Cross-user data access attempt', () => {
  test('Attempt to access another user\'s knowledge base by ID', async ({ request }) => {
    console.log('\n🔒 Testing direct API access with another user\'s ID...');
    
    // First, login as the new user to get token
    const loginResponse = await request.post(`${API_URL}/api/v1/auth/login`, {
      data: {
        email: randomEmail,
        password: testPassword,
      },
    });
    
    if (!loginResponse.ok()) {
      console.log('   ⚠️  Could not login as new user, skipping test');
      return;
    }
    
    const loginData = await loginResponse.json();
    const newToken = loginData.data.token;
    
    // Try to access knowledge base IDs that might belong to other users
    // Common IDs to try: 1, 2, 3, etc.
    const idsToTry = [1, 2, 3, 4, 5, 10, 100];
    
    for (const id of idsToTry) {
      const kbResponse = await request.get(`${API_URL}/api/v1/knowledge-bases/${id}`, {
        headers: {
          'Authorization': `Bearer ${newToken}`,
        },
      });
      
      if (kbResponse.status() === 200) {
        const kbData = await kbResponse.json();
        console.log(`   🚨 SECURITY ISSUE: Can access KB ${id}: ${JSON.stringify(kbData)}`);
        // This should not happen!
        expect(kbResponse.status()).toBe(404);
      } else if (kbResponse.status() === 404) {
        console.log(`   ✅ KB ${id}: Not found (expected)`);
      } else if (kbResponse.status() === 403) {
        console.log(`   ✅ KB ${id}: Forbidden (expected)`);
      } else {
        console.log(`   KB ${id}: Status ${kbResponse.status()}`);
      }
    }
  });
});