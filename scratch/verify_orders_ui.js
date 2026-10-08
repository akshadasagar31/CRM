const { chromium } = require('c:/Users/Akshada/OneDrive/Pictures/Documents/projects/CRM/frontend/node_modules/playwright');
const path = require('path');
const fs = require('fs');

const ARTIFACT_DIR = 'C:/Users/Akshada/.gemini/antigravity-ide/brain/170834df-c7dd-4fa4-b4e9-fe70a22b981a';

async function verifyUI() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();

  console.log('1. Navigating to CRM login page...');
  await page.goto('http://localhost:3000/login');
  await page.waitForLoadState('networkidle');

  // Fill login
  console.log('2. Logging in...');
  await page.fill('input[type="email"]', 'admin@crmdemo.com');
  await page.fill('input[type="password"]', 'admin123');
  await page.click('button[type="submit"]');

  await page.waitForTimeout(2000);
  console.log('   Current URL after login:', page.url());

  // Check Sidebar
  console.log('3. Checking sidebar navigation items...');
  const sidebarNavItems = await page.evaluate(() => {
    const navButtons = Array.from(document.querySelectorAll('nav button, nav a'));
    return navButtons.map(btn => btn.textContent.trim().replace(/\s+/g, ' '));
  });
  console.log('   Sidebar items found:', sidebarNavItems);

  // Take screenshot of sidebar
  const sidebarPath = path.join(ARTIFACT_DIR, 'sidebar_with_orders_nav.png');
  await page.screenshot({ path: sidebarPath });
  console.log('   Saved screenshot:', sidebarPath);

  // Click on Orders in sidebar or navigate to /orders
  console.log('4. Navigating to /orders page...');
  await page.goto('http://localhost:3000/orders');
  await page.waitForTimeout(2500);

  // Take screenshot of Orders listing page
  const ordersListPath = path.join(ARTIFACT_DIR, 'orders_page_overview.png');
  await page.screenshot({ path: ordersListPath });
  console.log('   Saved screenshot:', ordersListPath);

  // Check metrics & table
  const orderCount = await page.locator('table tbody tr').count();
  console.log(`   Found ${orderCount} rows in Orders table`);

  // Click first order row to open detail drawer
  console.log('5. Clicking on first order row to open Order Detail Drawer...');
  const firstRow = page.locator('table tbody tr').first();
  await firstRow.click();
  await page.waitForTimeout(1500);

  // Take screenshot of Order Detail Drawer
  const orderDrawerPath = path.join(ARTIFACT_DIR, 'order_detail_drawer.png');
  await page.screenshot({ path: orderDrawerPath });
  console.log('   Saved screenshot:', orderDrawerPath);

  // Test stage dropdown change in drawer
  console.log('6. Interacting with Current Stage dropdown in drawer...');
  const stageSelect = page.locator('select').first();
  if (await stageSelect.isVisible()) {
    console.log('   Current stage dropdown is visible');
    await stageSelect.selectOption('In Progress');
    await page.waitForTimeout(1000);
  }

  // Click deliverables tab
  console.log('7. Switching to Deliverables tab...');
  const itemsTab = page.locator('button:has-text("Deliverables")');
  if (await itemsTab.isVisible()) {
    await itemsTab.click();
    await page.waitForTimeout(1000);
  }

  // Click Timeline tab
  console.log('8. Switching to Timeline tab...');
  const timelineTab = page.locator('button:has-text("Timeline")');
  if (await timelineTab.isVisible()) {
    await timelineTab.click();
    await page.waitForTimeout(1000);
  }

  const drawerWithTimelinePath = path.join(ARTIFACT_DIR, 'order_drawer_timeline.png');
  await page.screenshot({ path: drawerWithTimelinePath });
  console.log('   Saved screenshot:', drawerWithTimelinePath);

  // Close drawer
  const closeBtn = page.locator('button:has-text("✕"), button[aria-label="Close"], button:has-text("Close")').first();
  if (await closeBtn.isVisible()) {
    await closeBtn.click();
    await page.waitForTimeout(500);
  }

  // Open Create Order Modal
  console.log('9. Opening Create Order modal...');
  const createBtn = page.locator('button:has-text("Create Order")');
  if (await createBtn.isVisible()) {
    await createBtn.click();
    await page.waitForTimeout(1000);
    const modalPath = path.join(ARTIFACT_DIR, 'order_create_modal.png');
    await page.screenshot({ path: modalPath });
    console.log('   Saved screenshot:', modalPath);
  }

  await browser.close();
  console.log('\n=== BROWSER VERIFICATION COMPLETED SUCCESSFULLY! ===');
}

verifyUI().catch(err => {
  console.error('Browser verification failed:', err);
  process.exit(1);
});
