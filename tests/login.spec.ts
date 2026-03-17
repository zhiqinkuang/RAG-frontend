import { test, expect } from '@playwright/test';

test('登录测试', async ({ page }) => {
  await page.goto('http://localhost:3000/login');
  await page.fill('input[type="email"]', 'demo@rag.com');
  await page.fill('input[type="password"]', 'Demo123456');
  await page.click('button[type="submit"]');
  await page.waitForTimeout(3000);
  
  const url = page.url();
  console.log('当前URL:', url);
  
  if (url.includes('/login')) {
    const errorEl = await page.$('[role="alert"], .text-red-500, .text-destructive');
    if (errorEl) {
      const errorText = await errorEl.textContent();
      console.log('错误信息:', errorText);
    }
    throw new Error('登录失败');
  }
  
  console.log('登录成功');
});
