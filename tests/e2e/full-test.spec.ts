import { test } from "@playwright/test";

test("完整测试文档筛选和浏览功能", async ({ page }) => {
  // 步骤1: 访问登录页
  await page.goto("http://localhost:3000/login");
  await page.waitForLoadState("networkidle");
  await page.screenshot({ path: "pic-01-login.png", fullPage: true });
  console.log("步骤1: 登录页面");

  // 步骤2: 填写邮箱
  await page.fill(
    'input[type="email"], input[name="email"], input[placeholder*="邮箱"]',
    "demo@rag.com",
  );
  await page.waitForTimeout(300);
  await page.screenshot({ path: "pic-02-email.png", fullPage: true });
  console.log("步骤2: 填写邮箱");

  // 步骤3: 填写密码
  await page.fill(
    'input[type="password"], input[name="password"], input[placeholder*="密码"]',
    "Demo123456",
  );
  await page.waitForTimeout(300);
  await page.screenshot({ path: "pic-03-password.png", fullPage: true });
  console.log("步骤3: 填写密码");

  // 步骤4: 点击登录
  await page.click('button[type="submit"], button:has-text("登录")');
  await page.waitForURL("**/", { timeout: 10000 });
  await page.waitForLoadState("networkidle");
  await page.screenshot({ path: "pic-04-home.png", fullPage: true });
  console.log("步骤4: 登录后主页");

  // 步骤5: 点击设置按钮
  const settingsButton = page.locator('button:has-text("设置")').first();
  await settingsButton.click();
  await page.waitForTimeout(500);
  await page.screenshot({ path: "pic-05-settings.png", fullPage: true });
  console.log("步骤5: 设置对话框");

  // 步骤6: 选择 RAG provider（使用 select 下拉框）
  const providerSelect = page.locator("select").first();
  await providerSelect.selectOption("rag");
  await page.waitForTimeout(500);
  await page.screenshot({ path: "pic-06-select-rag.png", fullPage: true });
  console.log("步骤6: 选择 RAG provider");

  // 步骤7: 点击知识库标签
  const kbTab = page
    .locator('[role="tab"]:has-text("知识库"), button:has-text("知识库")')
    .first();
  await kbTab.click();
  await page.waitForTimeout(500);
  await page.screenshot({ path: "pic-07-kb-tab.png", fullPage: true });
  console.log("步骤7: 知识库标签页");

  // 步骤8: 点击知识库选择按钮（title="选择此知识库"）
  const selectKbButton = page.locator('button[title="选择此知识库"]').first();
  await selectKbButton.click();
  await page.waitForTimeout(500);
  await page.screenshot({ path: "pic-08-select-kb.png", fullPage: true });
  console.log("步骤8: 选择知识库");

  // 步骤9: 点击保存按钮
  const saveButton = page.locator('button:has-text("保存")').first();
  await saveButton.click();
  await page.waitForTimeout(1500);
  await page.screenshot({ path: "pic-09-saved.png", fullPage: true });
  console.log("步骤9: 保存设置");

  // 步骤10: 等待页面稳定
  await page.waitForTimeout(500);
  await page.screenshot({ path: "pic-10-ready.png", fullPage: true });
  console.log("步骤10: 页面准备就绪");

  // 步骤11: 点击悬浮按钮展开文档筛选
  const floatButton = page.locator("button.fixed.right-5.bottom-24").first();
  await floatButton.click();
  await page.waitForTimeout(1000);
  await page.screenshot({ path: "pic-11-sidebar-open.png", fullPage: true });
  console.log("步骤11: 展开文档筛选");

  // 步骤12: 检查文档列表（使用正确的选择器）
  // Radix UI Checkbox 渲染为 button[role="checkbox"]
  const docItem = page
    .locator('div.group:has(button[role="checkbox"])')
    .first();
  const noDocs = page.locator("text=暂无文档");
  const loading = page.locator("text=加载中");

  if (await docItem.isVisible()) {
    // 步骤13: 悬停在文档项上
    await docItem.hover();
    await page.waitForTimeout(500);
    await page.screenshot({ path: "pic-12-hover-doc.png", fullPage: true });
    console.log("步骤12: 悬停文档项");

    // 步骤14: 点击预览按钮（Eye 图标）
    const previewButton = docItem.locator("button:has(svg)").nth(1);
    if (await previewButton.isVisible()) {
      await previewButton.click();
      await page.waitForTimeout(2000);

      // 步骤15: 预览页面
      const pages = page.context().pages();
      if (pages.length > 1) {
        const previewPage = pages[pages.length - 1];
        await previewPage.waitForLoadState("networkidle");
        await previewPage.screenshot({
          path: "pic-13-preview.png",
          fullPage: true,
        });
        console.log("步骤13: 预览页面");
        await previewPage.close();
        await page.waitForTimeout(500);
      }
    }
  } else if (await noDocs.isVisible()) {
    console.log("侧边栏显示: 暂无文档");
    await page.screenshot({ path: "pic-12-no-docs.png", fullPage: true });
  } else if (await loading.isVisible()) {
    console.log("侧边栏显示: 加载中...");
    await page.screenshot({ path: "pic-12-loading.png", fullPage: true });
  } else {
    console.log("侧边栏状态未知，检查内容");
    // 获取侧边栏文本内容
    const sidebarText = await page
      .locator("div.w-56")
      .textContent()
      .catch(() => "无法获取");
    console.log("侧边栏内容:", sidebarText);
    await page.screenshot({ path: "pic-12-unknown.png", fullPage: true });
  }

  // 步骤15: 勾选文档（使用正确的选择器）
  const checkbox = page.locator('button[role="checkbox"]').nth(1);
  if (await checkbox.isVisible()) {
    await checkbox.click();
    await page.waitForTimeout(300);
    await page.screenshot({ path: "pic-14-select-doc.png", fullPage: true });
    console.log("步骤14: 勾选文档");
  }

  // 步骤16: 关闭侧边栏查看角标
  const closeSidebar = page.locator('button:has([class*="X"])').first();
  if (await closeSidebar.isVisible()) {
    await closeSidebar.click();
    await page.waitForTimeout(300);
    await page.screenshot({ path: "pic-15-badge.png", fullPage: true });
    console.log("步骤15: 角标显示");
  }

  console.log("所有截图完成！");
});
