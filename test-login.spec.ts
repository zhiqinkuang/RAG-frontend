import { test } from "@playwright/test";

test("登录测试", async ({ page }) => {
  // 访问登录页
  await page.goto("http://localhost:3000/login");

  // 填写表单
  await page.fill('input[type="email"]', "demo@rag.com");
  await page.fill('input[type="password"]', "Demo123456");

  // 点击登录
  await page.click('button[type="submit"]');

  // 等待响应
  await page.waitForTimeout(3000);

  // 检查结果
  const url = page.url();
  console.log("当前URL:", url);

  if (url.includes("/login")) {
    // 检查错误提示
    const errorEl = await page.$(
      '[role="alert"], .text-red-500, .text-destructive',
    );
    if (errorEl) {
      const errorText = await errorEl.textContent();
      console.log("错误信息:", errorText);
    }
    throw new Error("登录失败 - 仍在登录页");
  }

  console.log("登录成功 - 已跳转到:", url);
});
