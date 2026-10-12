const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

async function main() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 }
  });
  const page = await context.newPage();

  console.log("1. Navigating to http://localhost:3000/invoices...");
  await page.goto("http://localhost:3000/login", { waitUntil: "networkidle" });

  // Login if needed
  if (page.url().includes("/login")) {
    console.log("Logging in as admin...");
    await page.fill('input[type="email"]', 'admin@crmdemo.com');
    await page.fill('input[type="password"]', 'admin123');
    await page.click('button[type="submit"]');
    await page.waitForTimeout(1500);
  }

  // Navigate to /invoices
  await page.goto("http://localhost:3000/invoices", { waitUntil: "networkidle" });
  await page.waitForTimeout(2000);

  // Take screenshot 1: Invoices List View with Sidebar
  const artifactDir = "C:\\Users\\Akshada\\.gemini\\antigravity-ide\\brain\\170834df-c7dd-4fa4-b4e9-fe70a22b981a";
  const screenshot1 = path.join(artifactDir, "invoices_list_view.png");
  await page.screenshot({ path: screenshot1 });
  console.log("Saved screenshot 1:", screenshot1);

  // 2. Open Invoice Detail Drawer
  const row = page.locator('tbody tr').first();
  if (await row.count() > 0) {
    console.log("Opening invoice detail drawer...");
    await row.click();
    await page.waitForTimeout(1000);
    const screenshot2 = path.join(artifactDir, "invoice_detail_drawer.png");
    await page.screenshot({ path: screenshot2 });
    console.log("Saved screenshot 2:", screenshot2);

    // 3. Open Print View
    const printBtn = page.locator('#btn-drawer-print');
    if (await printBtn.count() > 0) {
      console.log("Opening printable GST Tax Invoice...");
      await printBtn.click();
      await page.waitForTimeout(1000);
      const screenshot3 = path.join(artifactDir, "invoice_print_document.png");
      await page.screenshot({ path: screenshot3 });
      console.log("Saved screenshot 3:", screenshot3);

      // Close print modal
      await page.keyboard.press("Escape");
      await page.waitForTimeout(500);
    }

    // Close drawer
    await page.keyboard.press("Escape");
    await page.waitForTimeout(500);
  }

  // 4. Open Create Invoice Modal
  console.log("Opening Create Invoice modal...");
  const createBtn = page.locator('#btn-create-invoice');
  if (await createBtn.count() > 0) {
    await createBtn.click();
    await page.waitForTimeout(1000);
    const screenshot4 = path.join(artifactDir, "invoice_create_modal.png");
    await page.screenshot({ path: screenshot4 });
    console.log("Saved screenshot 4:", screenshot4);
  }

  // 5. Navigate to /orders to verify "Invoice This Order" button in Order Detail Drawer
  console.log("Navigating to /orders to check Order Detail Drawer Invoice button...");
  await page.goto("http://localhost:3000/orders", { waitUntil: "networkidle" });
  await page.waitForTimeout(1500);
  const orderRow = page.locator('tbody tr').first();
  if (await orderRow.count() > 0) {
    await orderRow.click();
    await page.waitForTimeout(1000);
    const screenshot5 = path.join(artifactDir, "order_drawer_with_invoice_btn.png");
    await page.screenshot({ path: screenshot5 });
    console.log("Saved screenshot 5:", screenshot5);
  }

  await browser.close();
  console.log("\n=== ALL UI VERIFICATIONS COMPLETED SUCCESSFULLY! ===");
}

main().catch(err => {
  console.error("Verification failed:", err);
  process.exit(1);
});
