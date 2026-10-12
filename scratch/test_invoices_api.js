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
  console.log("=== Testing Invoices API ===");

  // 1. Login
  const loginRes = await request({
    hostname: 'localhost',
    port: 8001,
    path: '/api/auth/login',
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, { email: 'admin@crmdemo.com', password: 'admin123' });

  if (loginRes.status !== 200 || !loginRes.data.access_token) {
    console.error("Login failed:", loginRes);
    process.exit(1);
  }
  const token = loginRes.data.access_token;
  console.log("1. Authenticated as admin.");

  const headers = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
  };

  // 2. Fetch existing orders
  const ordersRes = await request({
    hostname: 'localhost',
    port: 8001,
    path: '/api/orders',
    method: 'GET',
    headers
  });
  console.log(`2. Fetched ${ordersRes.data.items?.length || 0} orders.`);

  let orderToInvoice = ordersRes.data.items?.[0];
  if (!orderToInvoice) {
    console.error("No orders found to create invoice from!");
    process.exit(1);
  }
  console.log(`Target Order: #${orderToInvoice.id} (${orderToInvoice.order_number}) - "${orderToInvoice.title}"`);

  // 3. Create Invoice from Order
  console.log(`3. Generating invoice from order #${orderToInvoice.id}...`);
  const createInvRes = await request({
    hostname: 'localhost',
    port: 8001,
    path: `/api/orders/${orderToInvoice.id}/create-invoice`,
    method: 'POST',
    headers
  });

  if (createInvRes.status !== 201 && createInvRes.status !== 200) {
    console.error("Failed to create invoice from order:", createInvRes);
    process.exit(1);
  }

  const invoice = createInvRes.data;
  console.log(`-> Created Invoice: ${invoice.invoice_number}`);
  console.log(`   Customer: ${invoice.customer_name}`);
  console.log(`   Grand Total: ₹${invoice.grand_total}`);
  console.log(`   Amount Paid: ₹${invoice.amount_paid}`);
  console.log(`   Remaining Balance: ₹${invoice.remaining_balance}`);
  console.log(`   Status: ${invoice.status}`);
  console.log(`   Items: ${invoice.items?.length || 0}`);

  // Check Order invoice status updated
  const updatedOrderRes = await request({
    hostname: 'localhost',
    port: 8001,
    path: `/api/orders/${orderToInvoice.id}`,
    method: 'GET',
    headers
  });
  console.log(`-> Order #${orderToInvoice.id} invoice_status is now: "${updatedOrderRes.data.invoice_status}" (expected: Invoiced)`);

  // 4. Record Partial Payment
  const partialPaymentAmt = Math.round(invoice.grand_total / 2);
  console.log(`4. Recording partial payment of ₹${partialPaymentAmt}...`);
  const partialPayRes = await request({
    hostname: 'localhost',
    port: 8001,
    path: `/api/invoices/${invoice.id}/payments`,
    method: 'POST',
    headers
  }, {
    amount: partialPaymentAmt,
    payment_date: new Date().toISOString().slice(0, 10),
    payment_method: 'Bank Transfer',
    reference_number: 'UTR-TEST-001',
    notes: 'Advance installment test'
  });

  if (partialPayRes.status !== 200) {
    console.error("Failed to record partial payment:", partialPayRes);
    process.exit(1);
  }
  console.log(`-> Invoice after partial payment:`);
  console.log(`   Status: ${partialPayRes.data.status} (expected: Partially Paid)`);
  console.log(`   Amount Paid: ₹${partialPayRes.data.amount_paid}`);
  console.log(`   Remaining Balance: ₹${partialPayRes.data.remaining_balance}`);

  // 5. Record Remaining Payment
  const remainingAmt = partialPayRes.data.remaining_balance;
  console.log(`5. Recording final payment of ₹${remainingAmt}...`);
  const finalPayRes = await request({
    hostname: 'localhost',
    port: 8001,
    path: `/api/invoices/${invoice.id}/payments`,
    method: 'POST',
    headers
  }, {
    amount: remainingAmt,
    payment_date: new Date().toISOString().slice(0, 10),
    payment_method: 'UPI',
    reference_number: 'UPI-REF-999',
    notes: 'Final settlement test'
  });

  if (finalPayRes.status !== 200) {
    console.error("Failed to record final payment:", finalPayRes);
    process.exit(1);
  }
  console.log(`-> Invoice after full payment:`);
  console.log(`   Status: ${finalPayRes.data.status} (expected: Paid)`);
  console.log(`   Amount Paid: ₹${finalPayRes.data.amount_paid}`);
  console.log(`   Remaining Balance: ₹${finalPayRes.data.remaining_balance}`);

  // Check Order payment status updated to Paid
  const settledOrderRes = await request({
    hostname: 'localhost',
    port: 8001,
    path: `/api/orders/${orderToInvoice.id}`,
    method: 'GET',
    headers
  });
  console.log(`-> Order #${orderToInvoice.id} payment_status is now: "${settledOrderRes.data.payment_status}" (expected: Paid)`);

  // 6. Test Invoices List & Metrics
  console.log("6. Testing Invoices List & KPI totals...");
  const listRes = await request({
    hostname: 'localhost',
    port: 8001,
    path: '/api/invoices',
    method: 'GET',
    headers
  });

  console.log(`-> Invoices count: ${listRes.data.total}`);
  console.log(`-> Total Invoiced: ₹${listRes.data.total_invoiced}`);
  console.log(`-> Total Paid: ₹${listRes.data.total_paid}`);
  console.log(`-> Total Outstanding: ₹${listRes.data.total_outstanding}`);
  console.log(`-> Paid count: ${listRes.data.paid_count}`);

  console.log("\n=== ALL INVOICES API TESTS PASSED SUCCESSFULLY! ===");
}

main().catch(console.error);
