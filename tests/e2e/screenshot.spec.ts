import { test } from "@playwright/test";

test("登录并截图设置页面", async ({ page }) => {
  // 访问登录页
  await page.goto("http://localhost:3000/login");
  await page.waitForLoadState("networkidle");

  // 截图登录页
  await page.screenshot({ path: "screenshot-login.png", fullPage: true });
  console.log("截图已保存: screenshot-login.png");

  // 填写登录表单
  await page.fill(
    'input[type="email"], input[name="email"], input[placeholder*="邮箱"]',
    "demo@rag.com",
  );
  await page.fill(
    'input[type="password"], input[name="password"], input[placeholder*="密码"]',
    "Demo123456",
  );

  // 点击登录按钮
  await page.click('button[type="submit"], button:has-text("登录")');

  // 等待跳转（首页或聊天页面）
  await page.waitForURL("**/", { timeout: 10000 });
  await page.waitForLoadState("networkidle");

  // 截图主页面
  await page.screenshot({ path: "screenshot-home.png", fullPage: true });
  console.log("截图已保存: screenshot-home.png");

  // 点击设置按钮
  const settingsButton = page
    .locator(
      'button:has-text("设置"), [data-testid="settings-button"], button[aria-label*="设置"]',
    )
    .first();
  await settingsButton.click();
  await page.waitForTimeout(1000);

  // 截图设置对话框
  await page.screenshot({ path: "screenshot-settings.png", fullPage: true });
  console.log("截图已保存: screenshot-settings.png");

  // 点击知识库标签
  const kbTab = page
    .locator('[role="tab"]:has-text("知识库"), button:has-text("知识库")')
    .first();
  if (await kbTab.isVisible()) {
    await kbTab.click();
    await page.waitForTimeout(1000);
    await page.screenshot({
      path: "screenshot-knowledge-base.png",
      fullPage: true,
    });
    console.log("截图已保存: screenshot-knowledge-base.png");
  }
});
