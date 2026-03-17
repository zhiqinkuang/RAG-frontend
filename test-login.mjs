import { chromium } from "@playwright/test";

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  console.log("1. 访问登录页面...");
  await page.goto("http://localhost:3000/login");
  await page.waitForLoadState("networkidle");

  console.log("2. 填写登录信息...");
  await page.fill('input[type="email"]', "demo@rag.com");
  await page.fill('input[type="password"]', "Demo123456");

  console.log("3. 点击登录按钮...");
  await page.click('button[type="submit"]');

  console.log("4. 等待响应...");
  await page.waitForTimeout(3000);

  const url = page.url();
  console.log("当前URL:", url);

  if (url.includes("/login")) {
    console.log("❌ 登录失败 - 仍在登录页");
    // 尝试获取错误信息
    const errorEl = await page.$(
      '[role="alert"], .text-red-500, .text-destructive',
    );
    if (errorEl) {
      const errorText = await errorEl.textContent();
      console.log("错误信息:", errorText);
    }
  } else {
    console.log("✅ 登录成功 - 已跳转到:", url);
  }

  await browser.close();
})();
