import { test } from '@playwright/test';

test('测试文档筛选和浏览功能', async ({ page }) => {
  // 步骤1: 访问登录页
  await page.goto('http://localhost:3000/login');
  await page.waitForLoadState('networkidle');
  await page.screenshot({ path: 'doc-01-login.png', fullPage: true });
  console.log('步骤1: 登录页面');

  // 步骤2: 填写邮箱
  await page.fill('input[type="email"], input[name="email"], input[placeholder*="邮箱"]', 'demo@rag.com');
  await page.waitForTimeout(300);
  await page.screenshot({ path: 'doc-02-email.png', fullPage: true });
  console.log('步骤2: 填写邮箱');

  // 步骤3: 填写密码
  await page.fill('input[type="password"], input[name="password"], input[placeholder*="密码"]', 'Demo123456');
  await page.waitForTimeout(300);
  await page.screenshot({ path: 'doc-03-password.png', fullPage: true });
  console.log('步骤3: 填写密码');

  // 步骤4: 点击登录
  await page.click('button[type="submit"], button:has-text("登录")');
  await page.waitForURL('**/', { timeout: 10000 });
  await page.waitForLoadState('networkidle');
  await page.screenshot({ path: 'doc-04-home.png', fullPage: true });
  console.log('步骤4: 登录后主页');

  // 步骤5: 查看右侧悬浮按钮
  await page.waitForTimeout(500);
  await page.screenshot({ path: 'doc-05-float-button.png', fullPage: true });
  console.log('步骤5: 悬浮按钮位置');

  // 步骤6: 点击悬浮按钮展开文档筛选
  const filterButton = page.locator('button:has([class*="Filter"]), button[title*="文档筛选"], button[title*="知识库"]').last();
  await filterButton.click();
  await page.waitForTimeout(500);
  await page.screenshot({ path: 'doc-06-sidebar-open.png', fullPage: true });
  console.log('步骤6: 展开文档筛选侧边栏');

  // 步骤7: 悬停在文档项上显示预览按钮
  const docItem = page.locator('div:has(> input[type="checkbox"])').first();
  if (await docItem.isVisible()) {
    await docItem.hover();
    await page.waitForTimeout(300);
    await page.screenshot({ path: 'doc-07-hover-doc.png', fullPage: true });
    console.log('步骤7: 悬停文档项');
  }

  // 步骤8: 点击预览按钮
  const previewButton = page.locator('button:has([class*="Eye"]), button[title="预览文档"]').first();
  if (await previewButton.isVisible()) {
    await previewButton.click();
    await page.waitForTimeout(1000);
    await page.screenshot({ path: 'doc-08-preview-page.png', fullPage: true });
    console.log('步骤8: 预览页面');
  }

  // 步骤9: 关闭预览标签，回到主页面
  // 获取所有页面
  const pages = page.context().pages();
  if (pages.length > 1) {
    // 关闭预览标签
    await pages[pages.length - 1].close();
    await page.waitForTimeout(500);
    await page.screenshot({ path: 'doc-09-back-main.png', fullPage: true });
    console.log('步骤9: 返回主页面');
  }

  // 步骤10: 勾选文档进行筛选
  const checkbox = page.locator('input[type="checkbox"]').first();
  if (await checkbox.isVisible()) {
    await checkbox.check();
    await page.waitForTimeout(300);
    await page.screenshot({ path: 'doc-10-select-doc.png', fullPage: true });
    console.log('步骤10: 勾选文档');
  }

  // 步骤11: 查看角标显示已选数量
  await page.screenshot({ path: 'doc-11-badge.png', fullPage: true });
  console.log('步骤11: 角标显示');

  console.log('所有截图完成！');
});