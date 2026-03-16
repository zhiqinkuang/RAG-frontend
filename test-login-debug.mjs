import { chromium } from '@playwright/test';

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  
  console.log('1. 访问登录页面...');
  await page.goto('http://localhost:3000/login');
  await page.waitForLoadState('networkidle');
  
  // 截图保存初始状态
  await page.screenshot({ path: 'login-page.png' });
  console.log('截图已保存: login-page.png');
  
  console.log('2. 填写登录信息...');
  await page.fill('input[type="email"]', 'demo@rag.com');
  await page.fill('input[type="password"]', 'Demo123456');
  
  console.log('3. 点击登录按钮...');
  await page.click('button[type="submit"]');
  
  console.log('4. 等待响应...');
  await page.waitForTimeout(3000);
  
  // 截图保存登录后状态
  await page.screenshot({ path: 'after-login.png' });
  console.log('截图已保存: after-login.png');
  
  const url = page.url();
  console.log('当前URL:', url);
  
  // 获取页面上所有可能的错误信息
  const pageContent = await page.content();
  
  // 查找各种可能的错误元素
  const errorSelectors = [
    '[role="alert"]',
    '.text-red-500',
    '.text-destructive',
    '.error',
    '.alert-error',
    '[class*="error"]',
    '[class*="Error"]',
    'p.text-sm.text-destructive',
    '.text-sm.text-red-500'
  ];
  
  console.log('\n--- 查找错误信息 ---');
  for (const selector of errorSelectors) {
    const elements = await page.$$(selector);
    if (elements.length > 0) {
      for (const el of elements) {
        const text = await el.textContent();
        if (text && text.trim()) {
          console.log(`找到错误 (${selector}):`, text.trim());
        }
      }
    }
  }
  
  // 检查是否有 toast 或通知
  console.log('\n--- 检查 Toast 通知 ---');
  const toastSelectors = ['[data-sonner-toast]', '[data-toast]', '.toast', '[role="status"]'];
  for (const selector of toastSelectors) {
    const elements = await page.$$(selector);
    if (elements.length > 0) {
      for (const el of elements) {
        const text = await el.textContent();
        if (text && text.trim()) {
          console.log(`找到 Toast (${selector}):`, text.trim());
        }
      }
    }
  }
  
  // 检查控制台错误
  page.on('console', msg => {
    if (msg.type() === 'error') {
      console.log('浏览器控制台错误:', msg.text());
    }
  });
  
  if (url.includes('/login')) {
    console.log('\n❌ 登录失败 - 仍在登录页');
  } else {
    console.log('\n✅ 登录成功 - 已跳转到:', url);
  }
  
  await browser.close();
})();
