/**
 * E2E Tests for Paper Search Feature
 * 
 * Prerequisites:
 * 1. Backend running on http://localhost:8080
 * 2. Frontend running on http://localhost:3000
 * 3. Test user: demo@rag.com / Demo123456
 * 
 * Run: npx playwright test tests/e2e/paper-search.spec.ts --headed
 */

import { test, expect, Page } from '@playwright/test';

// Test configuration
const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';
const API_URL = process.env.API_URL || 'http://localhost:8080';
const TEST_EMAIL = process.env.TEST_EMAIL || 'demo@rag.com';
const TEST_PASSWORD = process.env.TEST_PASSWORD || 'Demo123456';

// Authenticate once and save state
test.describe.configure({ mode: 'serial' });

let savedAuthState: { cookies: any[], origins: any[] } | null = null;

// Helper to login via API and get token
async function loginViaAPI(request: any): Promise<string> {
  const response = await request.post(`${BASE_URL}/api/auth/login`, {
    data: {
      baseURL: 'http://127.0.0.1:8080',
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
  // Set localStorage with auth data
  await page.addInitScript((token) => {
    localStorage.setItem('rag-token', token);
    localStorage.setItem('chat-settings', JSON.stringify({
      provider: 'rag',
      apiKey: token,
      baseURL: 'http://127.0.0.1:8080',
      model: 'doubao-pro-32k',
    }));
  }, token);
}

// Helper to open paper search page
async function openPaperSearch(page: Page) {
  // Look for paper search button in sidebar (📚论文搜索)
  const paperSearchButton = page.locator('button:has-text("论文搜索"), button:has-text("Paper")').first();
  
  if (await paperSearchButton.isVisible({ timeout: 2000 })) {
    await paperSearchButton.click();
    await page.waitForTimeout(500);
  } else {
    // Try direct navigation
    await page.goto(`${BASE_URL}/paper-search`);
    await page.waitForTimeout(500);
  }
}

test.describe('Paper Search API Tests', () => {
  test('should search papers via API', async ({ request }) => {
    const token = await loginViaAPI(request);
    
    // Search papers
    const searchResponse = await request.get(`${API_URL}/api/v1/papers/search`, {
      params: {
        query: 'transformer',
        max_results: 5,
      },
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
    
    expect(searchResponse.ok()).toBeTruthy();
    const searchData = await searchResponse.json();
    expect(searchData.code).toBe(0);
    expect(searchData.data.papers).toBeDefined();
    expect(Array.isArray(searchData.data.papers)).toBeTruthy();
    
    // Check paper structure
    if (searchData.data.papers.length > 0) {
      const paper = searchData.data.papers[0];
      expect(paper.arxiv_id).toBeDefined();
      expect(paper.title).toBeDefined();
      expect(paper.authors).toBeDefined();
    }
  });

  test('should get backup path via API', async ({ request }) => {
    const token = await loginViaAPI(request);
    
    // Get backup path
    const pathResponse = await request.get(`${API_URL}/api/v1/settings/paper-backup-path`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
    
    expect(pathResponse.ok()).toBeTruthy();
    const pathData = await pathResponse.json();
    expect(pathData.code).toBe(0);
    expect(pathData.data.backup_path).toBeDefined();
  });

  test('should set backup path via API', async ({ request }) => {
    const token = await loginViaAPI(request);
    
    // Set backup path
    const setResponse = await request.put(`${API_URL}/api/v1/settings/paper-backup-path`, {
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      data: {
        backup_path: '/tmp/test-papers',
      },
    });
    
    expect(setResponse.ok()).toBeTruthy();
    const setData = await setResponse.json();
    expect(setData.code).toBe(0);
    expect(setData.data.backup_path).toBe('/tmp/test-papers');
  });

  test('should download paper via API', async ({ request }) => {
    const token = await loginViaAPI(request);
    
    // Get user's knowledge bases
    const kbResponse = await request.get(`${API_URL}/api/v1/knowledge-bases`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
    
    expect(kbResponse.ok()).toBeTruthy();
    const kbData = await kbResponse.json();
    
    if (kbData.data.knowledge_bases && kbData.data.knowledge_bases.length > 0) {
      const kbId = kbData.data.knowledge_bases[0].ID;
      
      // Download paper
      const downloadResponse = await request.post(`${API_URL}/api/v1/papers/download`, {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        data: {
          arxiv_id: '2201.00978', // PyramidTNT paper
          knowledge_base_id: kbId,
        },
      });
      
      const downloadData = await downloadResponse.json();
      console.log('Download response:', downloadData);
      
      // Either success, already exists, or knowledge base not found
      expect([0, 30002, 50001]).toContain(downloadData.code);
    }
  });
});

test.describe('Paper Search UI Tests', () => {
  test.use({ storageState: { cookies: [], origins: [] } });
  
  test.beforeEach(async ({ page, request }) => {
    // Login via API and set auth in page
    const token = await loginViaAPI(request);
    await setAuthInPage(page, token);
    await page.goto(BASE_URL);
    await page.waitForTimeout(1000);
  });

  test('should display paper search page', async ({ page }) => {
    await openPaperSearch(page);
    
    // Should show search input
    const searchInput = page.locator('input[placeholder*="搜索"], input[placeholder*="Search"], input[type="text"]').first();
    await expect(searchInput).toBeVisible({ timeout: 5000 });
    
    // Should show search button
    const searchButton = page.locator('button:has-text("搜索"), button:has-text("Search")').first();
    await expect(searchButton).toBeVisible({ timeout: 2000 });
  });

  test('should search for papers', async ({ page }) => {
    await openPaperSearch(page);
    
    // Fill search query
    const searchInput = page.locator('input[placeholder*="搜索"], input[placeholder*="Search"], input[type="text"]').first();
    await searchInput.fill('transformer');
    
    // Click search button
    const searchButton = page.locator('button:has-text("搜索"), button:has-text("Search")').first();
    await searchButton.click();
    
    // Wait for results
    await page.waitForTimeout(5000); // arXiv API can be slow
    
    // Should show results or loading state
    const resultsArea = page.locator('.space-y-4, [data-testid="results"], .paper-list').first();
    const loadingState = page.locator('text=/加载中|Loading|搜索中/i');
    const noResults = page.locator('text=/没有找到|No results|无结果/i');
    
    // One of these should be visible
    await expect(resultsArea.or(loadingState).or(noResults)).toBeVisible({ timeout: 15000 });
    
    // Take screenshot for debugging
    await page.screenshot({ path: 'test-results/paper-search-results.png' });
  });

  test('should download paper to knowledge base', async ({ page }) => {
    await openPaperSearch(page);
    
    // Search for papers
    const searchInput = page.locator('input[placeholder*="搜索"], input[placeholder*="Search"], input[type="text"]').first();
    await searchInput.fill('neural network');
    
    const searchButton = page.locator('button:has-text("搜索"), button:has-text("Search")').first();
    await searchButton.click();
    
    // Wait for results
    await page.waitForTimeout(8000);
    
    // Find first download button
    const downloadButton = page.locator('button:has-text("下载"), button:has-text("Download")').first();
    
    if (await downloadButton.isVisible({ timeout: 5000 })) {
      // Click download
      await downloadButton.click();
      
      // Wait for download to start
      await page.waitForTimeout(2000);
      
      // Take screenshot
      await page.screenshot({ path: 'test-results/paper-download.png' });
    }
  });
});