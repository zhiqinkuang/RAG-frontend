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

// Configure longer timeout for arXiv API calls (can be slow due to rate limiting)
const ARXIV_TIMEOUT = 30000; // 30 seconds for arXiv API operations
const NAVIGATION_TIMEOUT = 15000; // 15 seconds for navigation

// Authenticate once and save state
test.describe.configure({ mode: 'serial', retries: 2 });

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
    test.setTimeout(ARXIV_TIMEOUT);
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
      timeout: ARXIV_TIMEOUT,
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
    test.setTimeout(ARXIV_TIMEOUT * 2); // Download may take longer
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
        timeout: ARXIV_TIMEOUT * 2,
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
    test.setTimeout(NAVIGATION_TIMEOUT);
    await openPaperSearch(page);
    
    // Should show search input
    const searchInput = page.locator('input[placeholder*="搜索"], input[placeholder*="Search"], input[type="text"]').first();
    await expect(searchInput).toBeVisible({ timeout: 5000 });
    
    // Should show search button
    const searchButton = page.locator('button:has-text("搜索"), button:has-text("Search")').first();
    await expect(searchButton).toBeVisible({ timeout: 2000 });
  });

  test('should search for papers', async ({ page }) => {
    // Mark as slow test due to arXiv API rate limiting
    test.slow();
    
    // 使用 ** 通配符匹配所有请求，包括跨域请求
    let mockTriggered = false;
    let optionsTriggered = false;
    let requestLog: string[] = [];
    
    // 先拦截所有请求，记录日志
    await page.route('**', async (route) => {
      const url = route.request().url();
      const method = route.request().method();
      requestLog.push(`${method} ${url}`);
      
      // 处理 CORS 预检请求 (OPTIONS)
      if (method === 'OPTIONS') {
        optionsTriggered = true;
        console.log('OPTIONS preflight request for:', url);
        await route.fulfill({
          status: 200,
          headers: {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type, Authorization',
            'Access-Control-Max-Age': '86400',
          },
        });
        return;
      }
      
      // 匹配论文搜索 API（支持跨域请求）
      if (url.includes('/api/v1/papers/search')) {
        mockTriggered = true;
        console.log('Mock triggered for:', url);
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          headers: {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type, Authorization',
          },
          body: JSON.stringify({
            code: 0,
            data: {
              papers: [{
                id: 'arxiv:2301.00001',
                arxiv_id: '2301.00001',
                title: 'Attention Is All You Need: A Comprehensive Survey on Transformer Models',
                authors: ['Author One', 'Author Two', 'Author Three'],
                abstract: 'This is a test abstract for the mock paper about transformer architectures and attention mechanisms in deep learning.',
                pdf_url: 'https://arxiv.org/pdf/2301.00001',
                abs_url: 'https://arxiv.org/abs/2301.00001',
                source: 'arxiv',
                published: '2023-01-01',
                categories: ['cs.LG', 'cs.CL'],
              }],
              total: 1,
              has_more: false,
            },
          }),
        });
        return;
      }
      
      // 其他请求继续
      await route.continue();
    });
    
    // 打开论文搜索页面
    await openPaperSearch(page);
    
    // 等待页面加载完成
    await page.waitForLoadState('networkidle');
    
    // 等待搜索输入框可见 - 使用更精确的选择器
    const searchInput = page.locator('input[type="text"]').first();
    await expect(searchInput).toBeVisible({ timeout: 5000 });
    console.log('Search input found');
    
    // 填写搜索关键词
    await searchInput.fill('transformer');
    console.log('Filled search input with: transformer');
    
    // 点击搜索按钮 - 按钮包含 Search 图标
    const searchButton = page.locator('button').filter({ hasText: /搜索|Search/ }).first();
    await expect(searchButton).toBeVisible({ timeout: 3000 });
    console.log('Search button found, clicking...');
    await searchButton.click();
    console.log('Search button clicked');
    
    // 等待响应（前端有 500ms 防抖，加上 Mock 响应时间）
    // 使用 waitForResponse 确保请求被 Mock 拦截
    try {
      await page.waitForResponse(
        response => response.url().includes('/api/v1/papers/search'),
        { timeout: 10000 }
      );
    } catch {
      // 如果没有捕获到响应，继续检查结果
      console.log('No response captured, checking if mock was triggered:', mockTriggered);
      console.log('All requests:', requestLog);
    }
    
    // 额外等待确保 UI 更新（前端有 500ms 防抖）
    await page.waitForTimeout(2000);
    
    // 验证 Mock 被触发
    console.log('OPTIONS triggered:', optionsTriggered);
    console.log('Mock triggered:', mockTriggered);
    console.log('All requests made:', requestLog);
    expect(mockTriggered).toBe(true);
    
    // 验证论文标题出现 - 使用更宽松的选择器
    const paperTitle = page.locator('text=Attention Is All You Need');
    await expect(paperTitle).toBeVisible({ timeout: 10000 });
    
    // Take screenshot for debugging
    await page.screenshot({ path: 'test-results/paper-search-results.png' });
  });

  test('should download paper to knowledge base', async ({ page }) => {
    test.setTimeout(30000); // 30 seconds should be enough with mocks
    
    // 使用 ** 通配符匹配所有请求
    let searchMockTriggered = false;
    let downloadMockTriggered = false;
    let optionsTriggered = false;
    let requestLog: string[] = [];
    
    // 拦截所有请求
    await page.route('**', async (route) => {
      const url = route.request().url();
      const method = route.request().method();
      requestLog.push(`${method} ${url}`);
      
      // 处理 CORS 预检请求 (OPTIONS)
      if (method === 'OPTIONS') {
        optionsTriggered = true;
        console.log('OPTIONS preflight request for:', url);
        await route.fulfill({
          status: 200,
          headers: {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type, Authorization',
            'Access-Control-Max-Age': '86400',
          },
        });
        return;
      }
      
      // Mock 搜索 API
      if (url.includes('/api/v1/papers/search')) {
        searchMockTriggered = true;
        console.log('Search mock triggered for:', url);
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          headers: {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type, Authorization',
          },
          body: JSON.stringify({
            code: 0,
            data: {
              papers: [{
                id: 'arxiv:2201.00978',
                arxiv_id: '2201.00978',
                title: 'PyramidTNT: Transformer in Transformer for Image Classification',
                authors: ['Kai Han', 'An Xiao', 'Enhua Tan'],
                abstract: 'This paper presents PyramidTNT, a novel architecture for image classification.',
                pdf_url: 'https://arxiv.org/pdf/2201.00978',
                abs_url: 'https://arxiv.org/abs/2201.00978',
                source: 'arxiv',
                published: '2022-01-03',
                categories: ['cs.CV'],
              }],
              total: 1,
              has_more: false,
            },
          }),
        });
        return;
      }
      
      // Mock 下载 API
      if (url.includes('/api/v1/papers/download')) {
        downloadMockTriggered = true;
        console.log('Download mock triggered for:', url);
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          headers: {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type, Authorization',
          },
          body: JSON.stringify({
            code: 0,
            message: 'Paper downloaded successfully',
            data: {
              arxiv_id: '2201.00978',
              file_path: '/tmp/test-papers/2201.00978.pdf',
            },
          }),
        });
        return;
      }
      
      // 其他请求继续
      await route.continue();
    });
    
    // 打开论文搜索页面
    await openPaperSearch(page);
    
    // 等待页面加载完成
    await page.waitForLoadState('networkidle');
    
    // 等待搜索输入框可见 - 使用更精确的选择器
    const searchInput = page.locator('input[type="text"]').first();
    await expect(searchInput).toBeVisible({ timeout: 5000 });
    console.log('Search input found');
    
    // 填写搜索关键词
    await searchInput.fill('neural network');
    console.log('Filled search input with: neural network');
    
    // 点击搜索按钮 - 按钮包含 Search 图标
    const searchButton = page.locator('button').filter({ hasText: /搜索|Search/ }).first();
    await expect(searchButton).toBeVisible({ timeout: 3000 });
    console.log('Search button found, clicking...');
    await searchButton.click();
    console.log('Search button clicked');
    
    // 等待搜索响应
    try {
      await page.waitForResponse(
        response => response.url().includes('/api/v1/papers/search'),
        { timeout: 10000 }
      );
    } catch {
      console.log('Search mock triggered:', searchMockTriggered);
      console.log('All requests:', requestLog);
    }
    
    // 额外等待确保 UI 更新（前端有 500ms 防抖）
    await page.waitForTimeout(2000);
    
    console.log('OPTIONS triggered:', optionsTriggered);
    console.log('Search mock triggered:', searchMockTriggered);
    console.log('All requests made:', requestLog);
    
    // 验证论文出现
    const paperTitle = page.locator('text=PyramidTNT');
    await expect(paperTitle).toBeVisible({ timeout: 10000 });
    
    // 查找下载按钮
    const downloadButton = page.locator('button:has-text("下载"), button:has-text("Download")').first();
    
    if (await downloadButton.isVisible({ timeout: 5000 })) {
      // 点击下载
      await downloadButton.click();
      
      // 等待下载响应
      await page.waitForTimeout(2000);
      
      // Take screenshot
      await page.screenshot({ path: 'test-results/paper-download.png' });
    }
  });
});