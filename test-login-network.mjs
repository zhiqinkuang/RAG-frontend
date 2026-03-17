import { chromium } from '@playwright/test';

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  
  // 监听网络请求
  const requests = [];
  page.on('request', request => {
    if (request.url().includes('/api/') || request.url().includes('login') || request.url().includes('auth')) {
      requests.push({
        type: 'REQUEST',
        method: request.method(),
        url: request.url(),
        postData: request.postData()
      });
    }
  });
  
  page.on('response', async response => {
    if (response.url().includes('/api/') || response.url().includes('login') || response.url().includes('auth')) {
      let body = '';
      try {
        body = await response.text();
      } catch (e) {
        body = 'Unable to read body';
      }
      requests.push({
        type: 'RESPONSE',
        status: response.status(),
        url: response.url(),
        body: body.substring(0, 500)
      });
    }
  });
  
  // 监听控制台
  page.on('console', msg => {
    console.log('[浏览器控制台]', msg.type(), msg.text());
  });
  
  // 监听页面错误
  page.on('pageerror', error => {
    console.log('[页面错误]', error.message);
  });
  
  console.log('1. 访问登录页面...');
  await page.goto('http://localhost:3000/login');
  await page.waitForLoadState('networkidle');
  
  console.log('2. 填写登录信息...');
  await page.fill('input[type="email"]', 'demo@rag.com');
  await page.fill('input[type="password"]', 'Demo123456');
  
  console.log('3. 点击登录按钮...');
  await page.click('button[type="submit"]');
  
  console.log('4. 等待响应...');
  await page.waitForTimeout(5000);
  
  const url = page.url();
  console.log('\n当前URL:', url);
  
  console.log('\n--- 网络请求日志 ---');
  for (const req of requests) {
    if (req.type === 'REQUEST') {
      console.log(`REQUEST: ${req.method} ${req.url}`);
      if (req.postData) {
        console.log(`  PostData: ${req.postData.substring(0, 200)}`);
      }
    } else {
      console.log(`RESPONSE: ${req.status} ${req.url}`);
      console.log(`  Body: ${req.body.substring(0, 200)}`);
    }
  }
  
  // 获取页面标题
  const title = await page.title();
  console.log('\n页面标题:', title);
  
  // 检查是否有任何可见的文本内容
  const bodyText = await page.locator('body').textContent();
  console.log('\n页面主要内容预览:', bodyText.substring(0, 300).replace(/\s+/g, ' '));
  
  if (url.includes('/login')) {
    console.log('\n❌ 登录失败 - 仍在登录页');
  } else {
    console.log('\n✅ 登录成功 - 已跳转到:', url);
  }
  
  await browser.close();
})();
