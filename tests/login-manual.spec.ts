import { test, expect } from "@playwright/test";

test("登录测试 - demo@rag.com", async ({ page }) => {
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

  // 检查错误提示
  const bodyText = await page.textContent("body").catch(() => "");
  console.log("页面内容片段:", bodyText.substring(0, 500));

  if (url.includes("/login")) {
    console.log("❌ 登录失败 - 仍在登录页");
  } else {
    console.log("✅ 登录成功 - 已跳转");
  }

  // 断言检查
  expect(url).not.toContain("/login");
});
