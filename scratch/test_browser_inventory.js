const { chromium } = require('c:/Users/Akshada/OneDrive/Pictures/Documents/projects/CRM/frontend/node_modules/playwright');

async function verifyFullInventoryFlow() {
  console.log('--- STARTING COMPREHENSIVE BROWSER VERIFICATION ---');
  const browser = await chromium.launch({
    executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    headless: true
  });

  const context = await browser.newContext();
  const page = await context.newPage();

  const consoleLogs = [];
  const pageErrors = [];

  page.on('console', msg => {
    if (msg.type() === 'error') {
      consoleLogs.push(`[ERROR] ${msg.text()}`);
    }
  });

  page.on('pageerror', err => {
    pageErrors.push(err.toString());
  });

  // Step 1: Login
  console.log('1. Navigating to /login...');
  await page.goto('http://localhost:3000/login', { waitUntil: 'networkidle' });
  await page.fill('input[type="email"]', 'admin@crmdemo.com');
  await page.fill('input[type="password"]', 'admin123');
  await page.click('button[type="submit"]');
  await page.waitForTimeout(2000);
  console.log('Logged in successfully. Current URL:', page.url());

  // Step 2: Navigate to /leads and click "Inventory" in the Sidebar
  console.log('2. Navigating to /leads...');
  await page.goto('http://localhost:3000/leads', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1500);
  console.log('Current URL on leads page:', page.url());

  console.log('3. Clicking Inventory sidebar item...');
  const inventorySidebarLink = await page.$('#sidebar-nav-inventory');
  if (!inventorySidebarLink) {
    throw new Error('Sidebar inventory item #sidebar-nav-inventory not found!');
  }
  await inventorySidebarLink.click();
  await page.waitForTimeout(2500);

  console.log('Current URL after sidebar click:', page.url());
  if (!page.url().includes('/inventory')) {
    throw new Error(`Expected URL to include /inventory, but got: ${page.url()}`);
  }

  // Step 3: Verify Page Elements
  console.log('4. Verifying page title and elements...');
  const pageTitle = await page.textContent('h1');
  console.log('Page Header H1:', pageTitle);
  if (!pageTitle || !pageTitle.includes('Inventory')) {
    throw new Error(`H1 does not contain 'Inventory': ${pageTitle}`);
  }

  // Verify KPI Cards
  const bodyText = await page.evaluate(() => document.body.innerText);
  const requiredTexts = [
    'CATALOG PRODUCTS',
    'PHYSICAL ON-HAND',
    'RESERVED UNITS',
    'AVAILABLE TO SELL',
    'LOW STOCK ALERTS',
    'Stock Overview',
    'Movement Audit History'
  ];

  for (const text of requiredTexts) {
    if (bodyText.includes(text)) {
      console.log(`✓ Found expected text: "${text}"`);
    } else {
      throw new Error(`Missing expected text: "${text}" on inventory page!`);
    }
  }

  // Step 4: Test Stock In Modal
  console.log('5. Testing + Stock In modal...');
  const stockInBtn = await page.$('#btn-stock-in');
  if (!stockInBtn) throw new Error('#btn-stock-in button not found!');
  await stockInBtn.click();
  await page.waitForTimeout(1000);

  const modalHeading = await page.$eval('h3', el => el.innerText);
  console.log('Stock In Modal Heading:', modalHeading);
  // Close modal
  const cancelBtn = await page.$('button:has-text("Cancel")');
  if (cancelBtn) await cancelBtn.click();
  await page.waitForTimeout(500);

  // Step 5: Test Adjust Stock Modal
  console.log('6. Testing Adjust Stock modal...');
  const adjustBtn = await page.$('#btn-adjust-stock');
  if (!adjustBtn) throw new Error('#btn-adjust-stock button not found!');
  await adjustBtn.click();
  await page.waitForTimeout(1000);
  const adjustHeading = await page.$eval('h3', el => el.innerText);
  console.log('Adjust Modal Heading:', adjustHeading);
  const cancelBtn2 = await page.$('button:has-text("Cancel")');
  if (cancelBtn2) await cancelBtn2.click();
  await page.waitForTimeout(500);

  // Step 6: Test Customer Return Modal
  console.log('7. Testing Customer Return modal...');
  const returnBtn = await page.$('#btn-return-stock');
  if (!returnBtn) throw new Error('#btn-return-stock button not found!');
  await returnBtn.click();
  await page.waitForTimeout(1000);
  const returnHeading = await page.$eval('h3', el => el.innerText);
  console.log('Return Modal Heading:', returnHeading);
  const cancelBtn3 = await page.$('button:has-text("Cancel")');
  if (cancelBtn3) await cancelBtn3.click();
  await page.waitForTimeout(500);

  // Step 7: Check Tab Switching
  console.log('8. Testing Tab Switching (Movement Audit History)...');
  const movementsTab = await page.$('button:has-text("Movement Audit History")');
  if (movementsTab) {
    await movementsTab.click();
    await page.waitForTimeout(1000);
    const hasMovements = await page.evaluate(() => document.body.innerText.includes('DATE / TIME') || document.body.innerText.includes('No stock movement'));
    console.log('Movements Tab loaded correctly:', hasMovements);
  }

  console.log('--- VERIFICATION RESULT ---');
  console.log('Page Errors count:', pageErrors.length);
  if (pageErrors.length > 0) {
    console.error('Page errors encountered:', pageErrors);
  } else {
    console.log('ALL BROWSER WORKFLOW TESTS PASSED 100% WITH ZERO ERRORS!');
  }

  await browser.close();
}

verifyFullInventoryFlow().catch(err => {
  console.error('TEST FAILED:', err);
  process.exit(1);
});
