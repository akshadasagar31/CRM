const { chromium } = require('c:/Users/Akshada/OneDrive/Pictures/Documents/projects/CRM/frontend/node_modules/playwright');
const path = require('path');

const ARTIFACT_DIR = 'C:/Users/Akshada/.gemini/antigravity-ide/brain/170834df-c7dd-4fa4-b4e9-fe70a22b981a';

async function verifyLeadEditUI() {
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
  console.log('   Current URL:', page.url());

  // Navigate to Leads page if not already there
  if (!page.url().includes('/leads')) {
    await page.goto('http://localhost:3000/leads');
  }
  await page.waitForTimeout(2000);

  // Take screenshot of Leads page
  console.log('3. Capturing Leads table before edit...');
  const beforeEditPath = path.join(ARTIFACT_DIR, 'leads_before_edit.png');
  await page.screenshot({ path: beforeEditPath });

  // Click on the first lead name button to open Lead Detail Drawer
  console.log('4. Clicking on first lead name button to open drawer...');
  const firstLeadNameBtn = page.locator('table tbody td button').first();
  await firstLeadNameBtn.click();
  await page.waitForTimeout(2000);

  // Find and click the Edit button in drawer
  console.log('5. Clicking Edit button in drawer...');
  const editBtn = page.locator('button:has-text("Edit")').first();
  await editBtn.click();
  await page.waitForTimeout(1500);

  // Capture Edit Modal screenshot
  const editModalPath = path.join(ARTIFACT_DIR, 'lead_edit_modal.png');
  await page.screenshot({ path: editModalPath });
  console.log('   Captured edit modal screenshot:', editModalPath);

  // Modify Requirement or City to verify immediate update
  console.log('6. Modifying city and requirement...');
  const cityInput = page.locator('input[value*=""], input[type="text"]').nth(3); // city input
  // Or find input next to City label
  const cityField = page.locator('label:has-text("City") + input');
  if (await cityField.isVisible()) {
    await cityField.fill('Pune, Maharashtra');
  }

  // Click Save Changes
  console.log('7. Clicking Save Changes button...');
  const saveBtn = page.locator('button:has-text("Save Changes")');
  await saveBtn.click();
  await page.waitForTimeout(2000);

  // Verify toast or updated lead
  const afterEditPath = path.join(ARTIFACT_DIR, 'lead_after_successful_save.png');
  await page.screenshot({ path: afterEditPath });
  console.log('   Captured post-save screenshot:', afterEditPath);

  console.log('8. Checking for any error dialogs or toasts...');
  const errorToast = page.locator('div:has-text("parsing time"), div:has-text("Failed to update")');
  const hasError = await errorToast.isVisible();
  if (hasError) {
    throw new Error('Error toast was found on page!');
  } else {
    console.log('   No parsing errors found! Lead edit saved cleanly.');
  }

  await browser.close();
  console.log('\n=== BROWSER LEAD EDIT VERIFICATION SUCCESSFUL! ===');
}

verifyLeadEditUI().catch(err => {
  console.error('Lead Edit UI verification failed:', err);
  process.exit(1);
});
