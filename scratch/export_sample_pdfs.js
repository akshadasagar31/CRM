const fs = require("fs");

async function main() {
  const loginRes = await fetch("http://localhost:8001/api/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: "admin@crmdemo.com", password: "admin123" }),
  });
  const data = await loginRes.json();
  const token = data.access_token || data.token;
  const headers = { Authorization: "Bearer " + token };

  const invRes = await fetch("http://localhost:8001/api/invoices/30/pdf?action=inline", { headers });
  fs.writeFileSync("scratch/sample_invoice.pdf", Buffer.from(await invRes.arrayBuffer()));

  const qRes = await fetch("http://localhost:8001/api/quotations/59/pdf?action=inline", { headers });
  fs.writeFileSync("scratch/sample_quotation.pdf", Buffer.from(await qRes.arrayBuffer()));

  console.log("PDFs saved successfully! Invoice size:", fs.statSync("scratch/sample_invoice.pdf").size, "Quotation size:", fs.statSync("scratch/sample_quotation.pdf").size);
}

main().catch(console.error);
