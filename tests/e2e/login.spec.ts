import { test, expect } from '@playwright/test';

test('登录测试', async ({ page }) => {
  await page.goto('http://localhost:3000/login');
  await page.waitForLoadState('networkidle');
  
  await page.fill('input[type="email"]', 'demo@rag.com');
  await page.fill('input[type="password"]', 'Demo123456');
  await page.click('button[type="submit"]');
  
  // 等待跳转
  await page.waitForURL('http://localhost:3000/', { timeout: 10000 });
  
  console.log('✅ 登录成功，当前URL:', page.url());
});
