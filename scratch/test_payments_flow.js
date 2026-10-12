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
  console.log("=== Testing Complete Payments Flow ===");

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

  // 2. Fetch or create customer & invoice
  const custRes = await request({
    hostname: 'localhost',
    port: 8001,
    path: '/api/customers',
    method: 'POST',
    headers
  }, {
    name: "Payment Test Corp",
    email: `paytest_${Date.now()}@example.com`,
    phone: "9876543210"
  });
  const customerId = custRes.data.id;
  console.log(`✅ 2. Created customer #${customerId} (${custRes.data.name}).`);

  // Create Invoice for ₹10,000 (tax inclusive items)
  const invRes = await request({
    hostname: 'localhost',
    port: 8001,
    path: '/api/invoices',
    method: 'POST',
    headers
  }, {
    customer_id: customerId,
    status: 'Issued/Sent',
    currency: 'INR',
    items: [
      {
        product_name: "Cloud Enterprise Suite",
        quantity: 1,
        unit_price: 10000,
        tax_percentage: 18
      }
    ]
  });

  if (invRes.status !== 201) {
    console.error("❌ Invoice creation failed:", invRes);
    process.exit(1);
  }

  const invoice = invRes.data;
  const invoiceId = invoice.id;
  const grandTotal = invoice.grand_total;
  console.log(`✅ 3. Created Invoice ${invoice.invoice_number} (ID: ${invoiceId}), Grand Total: ₹${grandTotal}, Status: ${invoice.status}`);

  // 3. Test Partial Payment: Record ₹4,000
  const uniqueRef1 = `UTR-TEST-${Date.now()}-A`;
  const partialPayRes = await request({
    hostname: 'localhost',
    port: 8001,
    path: '/api/payments',
    method: 'POST',
    headers
  }, {
    invoice_id: invoiceId,
    amount: 4000,
    payment_method: 'UPI / QR',
    reference_number: uniqueRef1,
    notes: 'Initial milestone payment via UPI'
  });

  if (partialPayRes.status !== 201) {
    console.error("❌ Partial payment failed:", partialPayRes);
    process.exit(1);
  }
  const pay1 = partialPayRes.data;
  console.log(`✅ 4. Recorded Partial Payment #${pay1.id}: ₹${pay1.amount}, Status: ${pay1.invoice_status}, Remaining: ₹${pay1.invoice_remaining_balance}`);
  if (pay1.invoice_status !== 'Partially Paid') {
    console.error("❌ Expected invoice status to be 'Partially Paid', got:", pay1.invoice_status);
    process.exit(1);
  }

  // 4. Test Duplicate Reference Prevention: Try recording with uniqueRef1 again
  console.log(`ℹ️ 5. Testing duplicate reference prevention with ref: ${uniqueRef1}...`);
  const dupRes = await request({
    hostname: 'localhost',
    port: 8001,
    path: '/api/payments',
    method: 'POST',
    headers
  }, {
    invoice_id: invoiceId,
    amount: 1000,
    payment_method: 'Bank Transfer (NEFT/RTGS/IMPS)',
    reference_number: uniqueRef1,
    notes: 'Duplicate attempt'
  });

  if (dupRes.status === 400 && String(dupRes.data.error).includes('already been recorded')) {
    console.log(`✅ 5. Duplicate reference check PASSED: Backend correctly rejected with '${dupRes.data.error}'.`);
  } else {
    console.error("❌ Duplicate check FAILED! Response:", dupRes);
    process.exit(1);
  }

  // 5. Test Overpayment Prevention: Try recording ₹10,000 when remaining is ₹(grandTotal - 4000)
  const remaining = grandTotal - 4000;
  console.log(`ℹ️ 6. Testing overpayment prevention (Remaining: ₹${remaining}, trying to pay: ₹${remaining + 500})...`);
  const overpayRes = await request({
    hostname: 'localhost',
    port: 8001,
    path: '/api/payments',
    method: 'POST',
    headers
  }, {
    invoice_id: invoiceId,
    amount: remaining + 500,
    payment_method: 'Cash',
    reference_number: `OVERPAY-${Date.now()}`
  });

  if (overpayRes.status === 400 && String(overpayRes.data.error).includes('exceeds')) {
    console.log(`✅ 6. Overpayment prevention PASSED: Backend correctly rejected with '${overpayRes.data.error}'.`);
  } else {
    console.error("❌ Overpayment check FAILED! Response:", overpayRes);
    process.exit(1);
  }

  // 6. Test Final Payment: Record remaining balance
  const uniqueRef2 = `UTR-TEST-${Date.now()}-B`;
  const finalPayRes = await request({
    hostname: 'localhost',
    port: 8001,
    path: '/api/payments',
    method: 'POST',
    headers
  }, {
    invoice_id: invoiceId,
    amount: remaining,
    payment_method: 'Bank Transfer (NEFT/RTGS/IMPS)',
    reference_number: uniqueRef2,
    notes: 'Final balance clearance'
  });

  if (finalPayRes.status !== 201) {
    console.error("❌ Final payment failed:", finalPayRes);
    process.exit(1);
  }
  const pay2 = finalPayRes.data;
  console.log(`✅ 7. Final payment #${pay2.id} recorded. Invoice Status: ${pay2.invoice_status}, Remaining Balance: ₹${pay2.invoice_remaining_balance}`);
  if (pay2.invoice_status !== 'Paid' || pay2.invoice_remaining_balance > 0.01) {
    console.error("❌ Expected invoice status to be 'Paid' and remaining 0. Got:", pay2);
    process.exit(1);
  }

  // 7. Verify Payments Ledger Listing
  const listRes = await request({
    hostname: 'localhost',
    port: 8001,
    path: `/api/payments?invoice_id=${invoiceId}`,
    method: 'GET',
    headers
  });
  console.log(`✅ 8. Payments Ledger query returned ${listRes.data.items?.length} payments for this invoice.`);
  if (listRes.data.items?.length !== 2) {
    console.error("❌ Expected 2 payments, got:", listRes.data.items?.length);
    process.exit(1);
  }

  // 8. Test Receipt Voucher API
  const receiptRes = await request({
    hostname: 'localhost',
    port: 8001,
    path: `/api/payments/${pay1.id}/receipt`,
    method: 'GET',
    headers
  });
  console.log(`✅ 9. Payment Receipt voucher fetched for payment #${pay1.id}: Company: '${receiptRes.data.company?.company_name}', Customer: '${receiptRes.data.customer?.name}'.`);

  // 9. Test Summary API
  const summaryRes = await request({
    hostname: 'localhost',
    port: 8001,
    path: '/api/payments/summary',
    method: 'GET',
    headers
  });
  console.log(`✅ 10. Summary Metrics: Received: ₹${summaryRes.data.total_received}, Outstanding: ₹${summaryRes.data.total_outstanding}, Overdue: ₹${summaryRes.data.total_overdue}, Total Payments: ${summaryRes.data.total_payments}`);

  // 10. Test Voiding / Deleting Payment
  console.log(`ℹ️ 11. Testing payment rollback by voiding payment #${pay2.id} (₹${remaining})...`);
  const voidRes = await request({
    hostname: 'localhost',
    port: 8001,
    path: `/api/payments/${pay2.id}`,
    method: 'DELETE',
    headers
  });
  if (voidRes.status !== 200) {
    console.error("❌ Void payment failed:", voidRes);
    process.exit(1);
  }

  // Check invoice status after rollback
  const checkInv = await request({
    hostname: 'localhost',
    port: 8001,
    path: `/api/invoices/${invoiceId}`,
    method: 'GET',
    headers
  });
  console.log(`✅ 11. After voiding final payment, Invoice #${invoiceId} rolled back: Status: '${checkInv.data.status}', Amount Paid: ₹${checkInv.data.amount_paid}, Remaining Balance: ₹${checkInv.data.remaining_balance}`);
  if (checkInv.data.status !== 'Partially Paid' || Math.abs(checkInv.data.amount_paid - 4000) > 0.01) {
    console.error("❌ Rollback assertion failed! Invoice should be Partially Paid with ₹4000 paid. Got:", checkInv.data);
    process.exit(1);
  }

  console.log("\n==========================================");
  console.log("🎉 ALL TESTS PASSED! Payment flow is 100% verified.");
  console.log("==========================================\n");
}

main().catch(err => {
  console.error("Fatal test error:", err);
  process.exit(1);
});
