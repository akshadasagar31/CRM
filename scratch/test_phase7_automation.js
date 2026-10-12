const http = require('http');

function request(options, body) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(data) });
        } catch (e) {
          resolve({ status: res.statusCode, data });
        }
      });
    });
    req.on('error', reject);
    if (body) {
      req.write(JSON.stringify(body));
    }
    req.end();
  });
}

async function main() {
  console.log("=== Testing Phase 7: Automation & Reporting ===");

  // 1. Authenticate as admin
  const loginRes = await request({
    hostname: 'localhost',
    port: 8001,
    path: '/api/auth/login',
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, { email: 'admin@crmdemo.com', password: 'admin123' });

  if (loginRes.status !== 200 || !loginRes.data.access_token) {
    console.error("❌ Login failed:", loginRes);
    process.exit(1);
  }
  const token = loginRes.data.access_token;
  console.log("✅ 1. Authenticated as admin successfully.");

  const headers = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
  };

  // 2. Test Dashboard Metrics API
  console.log("ℹ️ 2. Testing GET /api/dashboard/metrics...");
  const metricsRes = await request({
    hostname: 'localhost',
    port: 8001,
    path: '/api/dashboard/metrics?timeframe=this_month',
    method: 'GET',
    headers
  });

  if (metricsRes.status !== 200) {
    console.error("❌ Metrics API failed:", metricsRes);
    process.exit(1);
  }
  console.log("✅ 2. Dashboard Metrics retrieved:", {
    total_deals: metricsRes.data.total_deals,
    pipeline_value: metricsRes.data.total_pipeline_value,
    total_invoiced: metricsRes.data.total_invoiced,
    total_received: metricsRes.data.total_received,
    outstanding_balance: metricsRes.data.outstanding_balance,
    overdue_balance: metricsRes.data.overdue_balance,
    pending_follow_ups: metricsRes.data.pending_follow_ups,
    overdue_follow_ups: metricsRes.data.overdue_follow_ups,
  });

  // 3. Test Sales Chart API
  console.log("ℹ️ 3. Testing GET /api/dashboard/sales-chart...");
  const chartRes = await request({
    hostname: 'localhost',
    port: 8001,
    path: '/api/dashboard/sales-chart?timeframe=all',
    method: 'GET',
    headers
  });

  if (chartRes.status !== 200 || !Array.isArray(chartRes.data)) {
    console.error("❌ Sales chart API failed:", chartRes);
    process.exit(1);
  }
  console.log(`✅ 3. Sales Chart points returned: ${chartRes.data.length} periods (Sample: ${chartRes.data[chartRes.data.length - 1]?.period}).`);

  // 4. Test Pipeline Distribution API
  console.log("ℹ️ 4. Testing GET /api/dashboard/pipeline-distribution...");
  const distRes = await request({
    hostname: 'localhost',
    port: 8001,
    path: '/api/dashboard/pipeline-distribution',
    method: 'GET',
    headers
  });

  if (distRes.status !== 200 || !Array.isArray(distRes.data)) {
    console.error("❌ Pipeline distribution API failed:", distRes);
    process.exit(1);
  }
  console.log(`✅ 4. Pipeline stages count: ${distRes.data.length}.`);

  // 5. Test Recent Activities API
  console.log("ℹ️ 5. Testing GET /api/dashboard/activities...");
  const actRes = await request({
    hostname: 'localhost',
    port: 8001,
    path: '/api/dashboard/activities?limit=10',
    method: 'GET',
    headers
  });

  if (actRes.status !== 200 || !Array.isArray(actRes.data)) {
    console.error("❌ Activities API failed:", actRes);
    process.exit(1);
  }
  console.log(`✅ 5. Recent activities fetched: ${actRes.data.length} entries.`);

  // 6. Test Automation: Create an overdue invoice
  console.log("ℹ️ 6. Creating a customer and an overdue invoice to test automated evaluation...");
  const custRes = await request({
    hostname: 'localhost',
    port: 8001,
    path: '/api/customers',
    method: 'POST',
    headers
  }, {
    name: "Automation Overdue Corp",
    email: `auto_${Date.now()}@test.com`,
    phone: "9123456789"
  });

  const customerId = custRes.data.id;
  const pastDueDate = new Date();
  pastDueDate.setDate(pastDueDate.getDate() - 5); // 5 days overdue

  const invRes = await request({
    hostname: 'localhost',
    port: 8001,
    path: '/api/invoices',
    method: 'POST',
    headers
  }, {
    customer_id: customerId,
    status: 'Issued/Sent',
    due_date: pastDueDate.toISOString().split("T")[0],
    items: [
      {
        product_name: "Annual License (Overdue Test)",
        quantity: 1,
        unit_price: 25000,
        tax_percentage: 18
      }
    ]
  });

  const invoice = invRes.data;
  console.log(`✅ 6. Overdue invoice created: ${invoice.invoice_number} (Due: ${invoice.due_date}, Total: ₹${invoice.grand_total}).`);

  // 7. Trigger Automated Evaluation
  console.log("ℹ️ 7. Testing POST /api/automation/reminders/evaluate...");
  const evalRes = await request({
    hostname: 'localhost',
    port: 8001,
    path: '/api/automation/reminders/evaluate',
    method: 'POST',
    headers
  });

  if (evalRes.status !== 200) {
    console.error("❌ Evaluation API failed:", evalRes);
    process.exit(1);
  }
  console.log(`✅ 7. Evaluation completed: ${evalRes.data.reminders_synced_or_found} reminder(s) synced.`);

  // 8. List Active Reminders
  console.log("ℹ️ 8. Testing GET /api/automation/reminders?status=active...");
  const remListRes = await request({
    hostname: 'localhost',
    port: 8001,
    path: '/api/automation/reminders?status=active',
    method: 'GET',
    headers
  });

  if (remListRes.status !== 200 || !Array.isArray(remListRes.data)) {
    console.error("❌ List reminders failed:", remListRes);
    process.exit(1);
  }

  const invoiceReminder = remListRes.data.find(r => r.entity_id === String(invoice.id) && r.reminder_type === 'invoice_overdue');
  if (!invoiceReminder) {
    console.error("❌ Overdue invoice reminder was NOT found in active reminders:", remListRes.data);
    process.exit(1);
  }
  console.log(`✅ 8. Found automated overdue reminder #${invoiceReminder.id}: '${invoiceReminder.title}' with severity '${invoiceReminder.severity}'.`);

  // 9. Test Snoozing Reminder
  console.log(`ℹ️ 9. Snoozing reminder #${invoiceReminder.id} for 24h...`);
  const snoozeRes = await request({
    hostname: 'localhost',
    port: 8001,
    path: `/api/automation/reminders/${invoiceReminder.id}/status`,
    method: 'PATCH',
    headers
  }, {
    status: 'snoozed',
    snooze_hours: 24
  });

  if (snoozeRes.status !== 200) {
    console.error("❌ Snooze reminder failed:", snoozeRes);
    process.exit(1);
  }

  // Verify snoozed reminder is no longer returned in active list
  const activeAfterSnooze = await request({
    hostname: 'localhost',
    port: 8001,
    path: '/api/automation/reminders?status=active',
    method: 'GET',
    headers
  });
  const stillInActive = activeAfterSnooze.data.some(r => r.id === invoiceReminder.id);
  if (stillInActive) {
    console.error("❌ Snoozed reminder still appeared in active list!");
    process.exit(1);
  }
  console.log("✅ 9. Reminder snoozed successfully and excluded from active view.");

  // Unsnooze / mark back to pending for resolution test
  await request({
    hostname: 'localhost',
    port: 8001,
    path: `/api/automation/reminders/${invoiceReminder.id}/status`,
    method: 'PATCH',
    headers
  }, { status: 'pending' });

  // 10. Test Automatic Resolution on Payment Clearance
  console.log(`ℹ️ 10. Recording full payment for invoice #${invoice.id} to verify automatic reminder resolution...`);
  const payRes = await request({
    hostname: 'localhost',
    port: 8001,
    path: '/api/payments',
    method: 'POST',
    headers
  }, {
    invoice_id: invoice.id,
    amount: invoice.grand_total,
    payment_method: 'Bank Transfer (NEFT/RTGS/IMPS)',
    reference_number: `AUTO-RESOLVE-${Date.now()}`
  });

  if (payRes.status !== 201) {
    console.error("❌ Payment failed:", payRes);
    process.exit(1);
  }

  // Re-evaluate
  await request({
    hostname: 'localhost',
    port: 8001,
    path: '/api/automation/reminders/evaluate',
    method: 'POST',
    headers
  });

  // Verify reminder transitioned to resolved
  const allReminders = await request({
    hostname: 'localhost',
    port: 8001,
    path: '/api/automation/reminders?status=all',
    method: 'GET',
    headers
  });
  const checkResolved = allReminders.data.find(r => r.id === invoiceReminder.id);
  console.log(`✅ 10. Reminder #${invoiceReminder.id} status after full payment: '${checkResolved?.status}' (Resolved At: ${checkResolved?.resolved_at}).`);
  if (checkResolved?.status !== 'resolved') {
    console.error("❌ Reminder was expected to auto-resolve upon payment. Got:", checkResolved);
    process.exit(1);
  }

  console.log("\n=======================================================");
  console.log("🎉 ALL TESTS PASSED! Phase 7 is 100% verified.");
  console.log("=======================================================\n");
}

main().catch(err => {
  console.error("Fatal error:", err);
  process.exit(1);
});
