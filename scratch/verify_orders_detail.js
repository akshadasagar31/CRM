const { chromium } = require('c:/Users/Akshada/OneDrive/Pictures/Documents/projects/CRM/frontend/node_modules/playwright');
const path = require('path');

const ARTIFACT_DIR = 'C:/Users/Akshada/.gemini/antigravity-ide/brain/170834df-c7dd-4fa4-b4e9-fe70a22b981a';

async function verifyUI() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();

  console.log('1. Navigating to CRM login page...');
  await page.goto('http://localhost:3000/login');
  await page.waitForLoadState('networkidle');

  console.log('2. Logging in...');
  await page.fill('input[type="email"]', 'admin@crmdemo.com');
  await page.fill('input[type="password"]', 'admin123');
  await page.click('button[type="submit"]');

  await page.waitForTimeout(2000);

  console.log('3. Navigating to /orders page...');
  await page.goto('http://localhost:3000/orders');
  await page.waitForTimeout(2000);

  // Click on ORD-0001 (second row)
  console.log('4. Clicking on ORD-0001 row...');
  const rows = page.locator('table tbody tr');
  const ord1Row = rows.nth(1);
  if (await ord1Row.isVisible()) {
    await ord1Row.click();
    await page.waitForTimeout(1500);

    const drawerPath = path.join(ARTIFACT_DIR, 'order_detail_drawer_ord1.png');
    await page.screenshot({ path: drawerPath });
    console.log('   Saved ORD-0001 detail drawer:', drawerPath);

    // Switch to Timeline tab in drawer
    const timelineTab = page.locator('button:has-text("Timeline & History")');
    if (await timelineTab.isVisible()) {
      await timelineTab.click();
      await page.waitForTimeout(1000);
      const timelinePath = path.join(ARTIFACT_DIR, 'order_timeline_tab.png');
      await page.screenshot({ path: timelinePath });
      console.log('   Saved Timeline tab screenshot:', timelinePath);
    }
  }

  // Close drawer by clicking backdrop or close button
  console.log('5. Closing drawer...');
  const closeBtn = page.locator('button:has-text("Close")');
  if (await closeBtn.isVisible()) {
    await closeBtn.click();
    await page.waitForTimeout(1000);
  }

  // Open Create Order modal
  console.log('6. Opening Create Order modal...');
  const createBtn = page.locator('button:has-text("Create Order")');
  if (await createBtn.isVisible()) {
    await createBtn.click();
    await page.waitForTimeout(1500);
    const modalPath = path.join(ARTIFACT_DIR, 'order_create_modal.png');
    await page.screenshot({ path: modalPath });
    console.log('   Saved Create Order modal screenshot:', modalPath);
  }

  await browser.close();
  console.log('\n=== VERIFICATION FINISHED ===');
}

verifyUI().catch(err => {
  console.error('Failed:', err);
  process.exit(1);
});
