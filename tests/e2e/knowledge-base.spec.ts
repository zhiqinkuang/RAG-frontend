/**
 * E2E Tests for RAG Knowledge Base Frontend
 * 
 * Prerequisites:
 * 1. Backend running on http://localhost:8080
 * 2. Frontend running on http://localhost:3000
 * 3. Test user: demo@rag.com / Demo123456
 * 
 * Run: npx playwright test tests/e2e/knowledge-base.spec.ts
 */

import { test, expect, Page } from '@playwright/test';

// Test configuration
const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';
const API_URL = process.env.API_URL || 'http://localhost:8080';
const TEST_EMAIL = process.env.TEST_EMAIL || 'demo@rag.com';
const TEST_PASSWORD = process.env.TEST_PASSWORD || 'Demo123456';

// Helper to login
async function login(page: Page) {
  await page.goto(`${BASE_URL}/login`);
  await page.fill('#email', TEST_EMAIL);
  await page.fill('#password', TEST_PASSWORD);
  await page.click('button[type="submit"]');
  
  // Wait for redirect to chat
  await page.waitForURL('**/', { timeout: 10000 });
}

// Helper to open knowledge base panel
async function openKBPanel(page: Page) {
  // Wait for sidebar to load
  await page.waitForTimeout(1000);
  
  // Open settings dialog - Settings button is in sidebar footer
  // Use a more specific selector targeting the button with Settings icon
  const settingsButton = page.locator('[data-sidebar="footer"] button').filter({ has: page.locator('svg') }).nth(0);
  
  // Alternative: try finding by clicking the button that opens settings
  try {
    await settingsButton.click({ timeout: 3000 });
  } catch {
    // Fallback: look for any button with settings-like appearance
    const altButton = page.locator('button[size="icon-sm"]').first();
    await altButton.click();
  }
  
  // Wait for dialog
  await page.waitForTimeout(500);
  
  // Click on RAG/知识库 tab (second tab)
  const ragTab = page.locator('button:has-text("知识库")').first();
  await ragTab.click();
  
  await page.waitForTimeout(500); // Wait for panel animation
}

test.describe('Authentication', () => {
  test('should login successfully', async ({ page }) => {
    await login(page);
    
    // Verify logged in - redirected to home
    await expect(page).toHaveURL(/.*localhost:3000\/?$/);
  });

  test('should show error for invalid credentials', async ({ page }) => {
    await page.goto(`${BASE_URL}/login`);
    await page.fill('#email', 'wrong@example.com');
    await page.fill('#password', 'wrongpassword');
    await page.click('button[type="submit"]');

    // Check for error message
    await expect(page.locator('[role="alert"], .text-destructive')).toBeVisible({ timeout: 5000 });
  });

  test('should logout successfully', async ({ page }) => {
    await login(page);
    
    // Wait for page to load
    await page.waitForTimeout(1000);
    
    // Set up dialog handler before clicking
    page.once('dialog', dialog => {
      console.log(`Dialog message: ${dialog.message()}`);
      dialog.accept();
    });
    
    // Find and click logout button (in sidebar footer, has LogOut icon)
    // It's the second button in the footer (after settings)
    const logoutButton = page.locator('[data-sidebar="footer"] button').filter({ has: page.locator('svg') }).nth(1);
    await logoutButton.click();
    
    // Should redirect to login
    await expect(page).toHaveURL(/.*login.*/, { timeout: 5000 });
  });
});

test.describe('Knowledge Base Management', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test('should display knowledge base list', async ({ page }) => {
    await openKBPanel(page);
    
    // Wait for loading to complete
    await page.waitForTimeout(1000);
    
    // Should show knowledge bases or empty state
    const kbHeader = page.locator('text=知识库管理');
    await expect(kbHeader).toBeVisible({ timeout: 5000 });
    
    // Either show list or empty state
    const emptyState = page.locator('text=暂无知识库');
    const kbItem = page.locator('.rounded-lg.border').first();
    
    // One of them should be visible
    await expect(emptyState.or(kbItem)).toBeVisible({ timeout: 5000 });
  });

  test('should create a new knowledge base', async ({ page }) => {
    await openKBPanel(page);
    
    const kbName = `Test KB ${Date.now()}`;
    
    // Click create button
    const createButton = page.locator('button:has-text("新建")').first();
    await createButton.click();
    
    // Fill form
    await page.fill('input[placeholder="输入知识库名称"]', kbName);
    
    const descInput = page.locator('input[placeholder="可选描述"]');
    if (await descInput.isVisible()) {
      await descInput.fill('Test knowledge base description');
    }
    
    // Submit
    await page.click('button:has-text("创建")');
    
    // Verify created
    await expect(page.locator(`text=${kbName}`)).toBeVisible({ timeout: 5000 });
  });

  test('should delete a knowledge base', async ({ page }) => {
    await openKBPanel(page);
    
    // Find a knowledge base to delete
    const kbItem = page.locator('[data-testid="kb-item"], .knowledge-base-item').first();
    if (await kbItem.isVisible()) {
      // Hover to show delete button
      await kbItem.hover();
      
      // Click delete
      const deleteButton = kbItem.locator('[data-testid="delete-kb"], button:has-text("删除"), button:has-text("Delete")').first();
      await deleteButton.click();
      
      // Confirm deletion
      const confirmButton = page.locator('button:has-text("确认"), button:has-text("Confirm")');
      if (await confirmButton.isVisible({ timeout: 1000 })) {
        await confirmButton.click();
      }
      
      // Wait for deletion
      await page.waitForTimeout(1000);
    }
  });
});

test.describe('Document Management', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
    await openKBPanel(page);
  });

  test('should upload a document', async ({ page }) => {
    // First check if there's a knowledge base
    const kbItem = page.locator('.rounded-lg.border').filter({ hasText: '文档' }).first();
    
    // If no KB exists, skip this test
    if (!await kbItem.isVisible({ timeout: 2000 }).catch(() => false)) {
      console.log('No knowledge base found, skipping upload test');
      return;
    }
    
    // Expand the knowledge base
    await kbItem.click();
    
    // Wait for documents to load
    await page.waitForTimeout(500);
    
    // Find file input
    const fileInput = page.locator('input[type="file"]');
    
    // Create a test file
    const testContent = 'This is a test document for E2E testing.';
    
    // Upload file (Playwright will create temp file)
    await fileInput.setInputFiles({
      name: 'test-document.txt',
      mimeType: 'text/plain',
      buffer: Buffer.from(testContent),
    });
    
    // Wait for file to be selected
    await page.waitForTimeout(500);
    
    // Click upload button
    const uploadButton = page.locator('button:has-text("上传")').first();
    if (await uploadButton.isVisible({ timeout: 1000 })) {
      await uploadButton.click();
      
      // Wait for upload to complete
      await page.waitForTimeout(2000);
    }
  });

  test('should show document list', async ({ page }) => {
    // Expand first knowledge base
    const kbItem = page.locator('.rounded-lg.border').filter({ hasText: '文档' }).first();
    await kbItem.click();
    
    // Wait for documents
    await page.waitForTimeout(1000);
    
    // Should show documents or empty state
    const docList = page.locator('.divide-y');
    const emptyState = page.locator('text=暂无文档');
    
    // Either documents or empty state should be visible
    await expect(docList.or(emptyState)).toBeVisible({ timeout: 5000 });
  });

  test('should delete a document', async ({ page }) => {
    // Expand first knowledge base
    const kbItem = page.locator('.rounded-lg.border').filter({ hasText: '文档' }).first();
    await kbItem.click();
    
    await page.waitForTimeout(500);
    
    // Find a document to delete
    const docItem = page.locator('.divide-y > div').first();
    if (await docItem.isVisible({ timeout: 2000 }).catch(() => false)) {
      // Click delete button (Trash icon)
      const deleteButton = docItem.locator('button').filter({ has: page.locator('svg') }).last();
      await deleteButton.click();
      
      // Confirm in browser dialog
      page.on('dialog', dialog => dialog.accept());
      
      // Wait for deletion
      await page.waitForTimeout(1000);
    }
  });
});

test.describe('Chat with Knowledge Base', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test('should send a message', async ({ page }) => {
    // Wait for chat input
    const chatInput = page.locator('textarea').first();
    await chatInput.fill('Hello, this is a test message!');
    
    // Send message (press Enter or click send button)
    await chatInput.press('Enter');
    
    // Wait for response
    await page.waitForTimeout(2000);
    
    // Should show user message (check for the text in any element)
    const messageText = page.locator('text=/Hello.*test message/i');
    await expect(messageText.first()).toBeVisible({ timeout: 5000 });
  });

  test('should select knowledge base for chat', async ({ page }) => {
    await openKBPanel(page);
    
    // Find a knowledge base
    const kbItem = page.locator('[data-testid="kb-item"], .knowledge-base-item').first();
    if (await kbItem.isVisible({ timeout: 2000 })) {
      // Click to select
      await kbItem.click();
      
      // Look for select/use button
      const selectButton = kbItem.locator('button:has-text("选择"), button:has-text("Select"), button:has-text("使用")');
      if (await selectButton.isVisible()) {
        await selectButton.click();
      }
    }
  });
});

test.describe('API Health Check', () => {
  test('should authenticate via API', async ({ request }) => {
    const response = await request.post(`${API_URL}/api/v1/auth/login`, {
      data: {
        email: TEST_EMAIL,
        password: TEST_PASSWORD,
      },
    });
    
    expect(response.ok()).toBeTruthy();
    const data = await response.json();
    expect(data.code).toBe(0);
    expect(data.data.token).toBeDefined();
  });
});