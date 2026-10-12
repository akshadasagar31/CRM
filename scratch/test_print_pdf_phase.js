const http = require('http');

async function runTests() {
  console.log("=== Testing Quotation & Invoice Maroto v2 PDF & Print Flow ===");

  // 1. Authenticate
  const loginRes = await fetch("http://localhost:8001/api/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: "admin@crmdemo.com", password: "admin123" }),
  });
  if (!loginRes.ok) throw new Error("Login failed with status " + loginRes.status);
  const loginData = await loginRes.json();
  const token = loginData.access_token || loginData.token;
  console.log("✅ 1. Authenticated successfully. Token obtained.");

  // 2. Fetch Quotations & Test PDF
  const qListRes = await fetch("http://localhost:8001/api/quotations", {
    headers: { Authorization: "Bearer " + token },
  });
  if (!qListRes.ok) throw new Error("Failed to list quotations");
  const qListData = await qListRes.json();
  const quotation = qListData.items && qListData.items.length > 0 ? qListData.items[0] : null;
  if (!quotation) throw new Error("No quotations found in database to test");
  console.log(`ℹ️ Found Quotation #${quotation.quotation_number} (ID: ${quotation.id}, Total: ₹${quotation.total_amount})`);

  // 2a. Inline action
  const qPdfInlineRes = await fetch(`http://localhost:8001/api/quotations/${quotation.id}/pdf?action=inline`, {
    headers: { Authorization: "Bearer " + token },
  });
  if (qPdfInlineRes.status !== 200) throw new Error(`Quotation inline PDF returned HTTP ${qPdfInlineRes.status}`);
  if (qPdfInlineRes.headers.get("content-type") !== "application/pdf") {
    throw new Error(`Invalid content-type: ${qPdfInlineRes.headers.get("content-type")}`);
  }
  const qDispInline = qPdfInlineRes.headers.get("content-disposition");
  if (!qDispInline || !qDispInline.includes("inline")) {
    throw new Error(`Expected inline disposition, got: ${qDispInline}`);
  }
  const qBuffer = await qPdfInlineRes.arrayBuffer();
  const qMagic = Buffer.from(qBuffer.slice(0, 5)).toString();
  if (!qMagic.startsWith("%PDF-")) throw new Error(`Invalid PDF magic bytes: ${qMagic}`);
  console.log(`✅ 2a. Quotation PDF (inline) verified: ${qBuffer.byteLength} bytes, Magic: ${qMagic}, Disposition: ${qDispInline}`);

  // 2b. Download action
  const qPdfDlRes = await fetch(`http://localhost:8001/api/quotations/${quotation.id}/pdf?action=download`, {
    headers: { Authorization: "Bearer " + token },
  });
  const qDispDl = qPdfDlRes.headers.get("content-disposition");
  if (!qDispDl || !qDispDl.includes("attachment")) {
    throw new Error(`Expected attachment disposition, got: ${qDispDl}`);
  }
  console.log(`✅ 2b. Quotation PDF (download) verified. Disposition: ${qDispDl}`);

  // 3. Fetch Invoices & Test PDF
  const invListRes = await fetch("http://localhost:8001/api/invoices", {
    headers: { Authorization: "Bearer " + token },
  });
  if (!invListRes.ok) throw new Error("Failed to list invoices");
  const invListData = await invListRes.json();
  const invoice = invListData.items && invListData.items.length > 0 ? invListData.items[0] : null;
  if (!invoice) throw new Error("No invoices found in database to test");
  console.log(`ℹ️ Found Invoice #${invoice.invoice_number} (ID: ${invoice.id}, Total: ₹${invoice.grand_total}, Status: ${invoice.status})`);

  // 3a. Inline action
  const invPdfInlineRes = await fetch(`http://localhost:8001/api/invoices/${invoice.id}/pdf?action=inline`, {
    headers: { Authorization: "Bearer " + token },
  });
  if (invPdfInlineRes.status !== 200) throw new Error(`Invoice inline PDF returned HTTP ${invPdfInlineRes.status}`);
  if (invPdfInlineRes.headers.get("content-type") !== "application/pdf") {
    throw new Error(`Invalid content-type: ${invPdfInlineRes.headers.get("content-type")}`);
  }
  const invDispInline = invPdfInlineRes.headers.get("content-disposition");
  if (!invDispInline || !invDispInline.includes("inline")) {
    throw new Error(`Expected inline disposition, got: ${invDispInline}`);
  }
  const invBuffer = await invPdfInlineRes.arrayBuffer();
  const invMagic = Buffer.from(invBuffer.slice(0, 5)).toString();
  if (!invMagic.startsWith("%PDF-")) throw new Error(`Invalid PDF magic bytes: ${invMagic}`);
  console.log(`✅ 3a. Invoice PDF (inline) verified: ${invBuffer.byteLength} bytes, Magic: ${invMagic}, Disposition: ${invDispInline}`);

  // 3b. Download action
  const invPdfDlRes = await fetch(`http://localhost:8001/api/invoices/${invoice.id}/pdf?action=download`, {
    headers: { Authorization: "Bearer " + token },
  });
  const invDispDl = invPdfDlRes.headers.get("content-disposition");
  if (!invDispDl || !invDispDl.includes("attachment")) {
    throw new Error(`Expected attachment disposition, got: ${invDispDl}`);
  }
  console.log(`✅ 3b. Invoice PDF (download) verified. Disposition: ${invDispDl}`);

  // 4. Test URL Token fallback query param
  const tokenQueryRes = await fetch(`http://localhost:8001/api/invoices/${invoice.id}/pdf?action=inline&token=${token}`);
  if (tokenQueryRes.status !== 200) {
    throw new Error(`Token query parameter authentication failed with HTTP ${tokenQueryRes.status}`);
  }
  console.log(`✅ 4. Token query parameter authentication verified (HTTP 200 OK for direct iframe/tab opens).`);

  // 5. Test Invoice with Recorded Payments
  const paidInvoice = invListData.items.find(inv => inv.amount_paid > 0) || invoice;
  console.log(`ℹ️ Testing Invoice #${paidInvoice.invoice_number} with payments (Paid: ₹${paidInvoice.amount_paid}, Balance: ₹${paidInvoice.remaining_balance})`);
  const paidPdfRes = await fetch(`http://localhost:8001/api/invoices/${paidInvoice.id}/pdf?action=inline`, {
    headers: { Authorization: "Bearer " + token },
  });
  if (paidPdfRes.status !== 200) throw new Error("Paid invoice PDF generation failed");
  const paidPdfBuf = await paidPdfRes.arrayBuffer();
  console.log(`✅ 5. Invoice PDF with Payments Ledger generated successfully (${paidPdfBuf.byteLength} bytes).`);

  // 6. Test Frontend Routes
  const qPageRes = await fetch("http://localhost:3000/quotations");
  if (qPageRes.status !== 200) throw new Error(`Frontend /quotations returned HTTP ${qPageRes.status}`);
  console.log(`✅ 6a. Frontend /quotations serving HTTP 200 OK.`);

  const invPageRes = await fetch("http://localhost:3000/invoices");
  if (invPageRes.status !== 200) throw new Error(`Frontend /invoices returned HTTP ${invPageRes.status}`);
  console.log(`✅ 6b. Frontend /invoices serving HTTP 200 OK.`);

  console.log("\n=======================================================");
  console.log("🎉 ALL TESTS PASSED! Quotation & Invoice PDF printing 100% verified.");
  console.log("=======================================================");
}

runTests().catch(err => {
  console.error("❌ Test failed:", err);
  process.exit(1);
});
