import { test } from "@playwright/test";

test("登录并每步截图", async ({ page }) => {
  // 步骤1: 访问登录页
  await page.goto("http://localhost:3000/login");
  await page.waitForLoadState("networkidle");
  await page.screenshot({ path: "step-01-login-page.png", fullPage: true });
  console.log("步骤1: 登录页面");

  // 步骤2: 填写邮箱
  await page.fill(
    'input[type="email"], input[name="email"], input[placeholder*="邮箱"]',
    "demo@rag.com",
  );
  await page.waitForTimeout(300);
  await page.screenshot({ path: "step-02-fill-email.png", fullPage: true });
  console.log("步骤2: 填写邮箱");

  // 步骤3: 填写密码
  await page.fill(
    'input[type="password"], input[name="password"], input[placeholder*="密码"]',
    "Demo123456",
  );
  await page.waitForTimeout(300);
  await page.screenshot({ path: "step-03-fill-password.png", fullPage: true });
  console.log("步骤3: 填写密码");

  // 步骤4: 点击登录按钮
  await page.click('button[type="submit"], button:has-text("登录")');
  await page.waitForURL("**/", { timeout: 10000 });
  await page.waitForLoadState("networkidle");
  await page.screenshot({ path: "step-04-after-login.png", fullPage: true });
  console.log("步骤4: 登录后主页");

  // 步骤5: 找到设置按钮
  await page.waitForTimeout(500);
  await page.screenshot({ path: "step-05-main-interface.png", fullPage: true });
  console.log("步骤5: 主界面");

  // 步骤6: 点击设置按钮
  const settingsButton = page
    .locator(
      'button:has-text("设置"), [data-testid="settings-button"], button[aria-label*="设置"]',
    )
    .first();
  await settingsButton.click();
  await page.waitForTimeout(500);
  await page.screenshot({
    path: "step-06-settings-dialog.png",
    fullPage: true,
  });
  console.log("步骤6: 设置对话框");

  // 步骤7: 点击知识库标签
  const kbTab = page
    .locator('[role="tab"]:has-text("知识库"), button:has-text("知识库")')
    .first();
  if (await kbTab.isVisible()) {
    await kbTab.click();
    await page.waitForTimeout(500);
    await page.screenshot({
      path: "step-07-knowledge-base-tab.png",
      fullPage: true,
    });
    console.log("步骤7: 知识库标签页");
  }

  // 步骤8: 展开知识库查看文档列表
  const expandButton = page
    .locator(
      'button:has([class*="chevron"]), button:has-text("展开"), [data-state="closed"]',
    )
    .first();
  if (await expandButton.isVisible()) {
    await expandButton.click();
    await page.waitForTimeout(500);
    await page.screenshot({ path: "step-08-expand-kb.png", fullPage: true });
    console.log("步骤8: 展开知识库");
  }

  // 步骤9: 查看文档筛选复选框
  await page.waitForTimeout(500);
  await page.screenshot({ path: "step-09-document-list.png", fullPage: true });
  console.log("步骤9: 文档列表");

  console.log("所有截图完成！");
});
