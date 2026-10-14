const http = require('http');

function request(options, data) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(body) });
        } catch (e) {
          resolve({ status: res.statusCode, raw: body });
        }
      });
    });
    req.on('error', reject);
    if (data) req.write(JSON.stringify(data));
    req.end();
  });
}

async function run() {
  console.log("=== Testing Automatic Inventory Management Workflow ===");

  // 1. Login
  const loginRes = await request({
    hostname: 'localhost',
    port: 8001,
    path: '/api/auth/login',
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, { email: 'admin@crmdemo.com', password: 'admin123' });

  if (loginRes.status !== 200 || !loginRes.data.access_token) {
    throw new Error("Login failed: " + JSON.stringify(loginRes));
  }
  const token = loginRes.data.access_token;
  const authHeaders = {
    'Content-Type': 'application/json',
    'Authorization': 'Bearer ' + token
  };
  console.log("1. Authenticated successfully.");

  // 2. Initial Inventory Stats
  const statsRes = await request({
    hostname: 'localhost',
    port: 8001,
    path: '/api/inventory/stats',
    method: 'GET',
    headers: authHeaders
  });
  console.log("2. Initial Inventory Stats:", statsRes.data);

  // 3. Create a unique product with 0 stock
  const sku = 'INV-SKU-' + Math.floor(Math.random() * 90000 + 10000);
  const prodRes = await request({
    hostname: 'localhost',
    port: 8001,
    path: '/api/products',
    method: 'POST',
    headers: authHeaders
  }, {
    name: 'Auto-Inv Widget Pro',
    sku: sku,
    category: 'Hardware',
    selling_price: 250.00,
    unit: 'Box',
    low_stock_threshold: 5.0
  });

  if (prodRes.status !== 201 && prodRes.status !== 200) {
    throw new Error("Failed to create product: " + JSON.stringify(prodRes));
  }
  const product = prodRes.data;
  console.log(`3. Created product ${product.name} (ID: ${product.id}, SKU: ${product.sku}), Current Stock: ${product.current_stock}, Available: ${product.available_stock}`);

  // 4. Create customer for testing
  const custRes = await request({
    hostname: 'localhost',
    port: 8001,
    path: '/api/customers',
    method: 'POST',
    headers: authHeaders
  }, {
    name: 'Acme Logistics Corp',
    email: 'acme' + Math.floor(Math.random() * 10000) + '@example.com',
    company: 'Acme Logistics'
  });
  const customerId = custRes.data.id;

  // 5. Create Order requesting 5 units while stock is 0
  const orderRes = await request({
    hostname: 'localhost',
    port: 8001,
    path: '/api/orders',
    method: 'POST',
    headers: authHeaders
  }, {
    title: 'Order with zero stock',
    customer_id: customerId,
    stage: 'Not Started',
    items: [
      {
        product_id: product.id,
        name: product.name,
        quantity: 5,
        unit_price: 250.00
      }
    ]
  });
  const order = orderRes.data;
  console.log(`4. Created Order ${order.order_number} in Not Started stage.`);

  // 6. Attempt to Confirm Order when stock is 0 -> MUST FAIL with insufficient stock error!
  const failConfirmRes = await request({
    hostname: 'localhost',
    port: 8001,
    path: `/api/orders/${order.id}/stage`,
    method: 'POST',
    headers: authHeaders
  }, { stage: 'Confirmed' });

  if (failConfirmRes.status === 200) {
    throw new Error("Expected confirmation to fail due to insufficient stock, but it succeeded!");
  }
  console.log(`5. Insufficient stock prevention verified! Error received: "${failConfirmRes.data.detail}"`);

  // 7. Stock In: Add 10 units to product
  const stockInRes = await request({
    hostname: 'localhost',
    port: 8001,
    path: '/api/inventory/stock-in',
    method: 'POST',
    headers: authHeaders
  }, {
    product_id: product.id,
    quantity: 10,
    notes: 'Warehouse batch shipment'
  });
  if (stockInRes.status !== 200) {
    throw new Error("Stock In failed: " + JSON.stringify(stockInRes));
  }
  console.log(`6. Stock In 10 units successful! Movement ID: ${stockInRes.data.id}, Previous: ${stockInRes.data.previous_stock}, New: ${stockInRes.data.new_stock}`);

  // 8. Confirm Order now (requires 5 units out of 10) -> MUST SUCCEED!
  const confirmRes = await request({
    hostname: 'localhost',
    port: 8001,
    path: `/api/orders/${order.id}/stage`,
    method: 'POST',
    headers: authHeaders
  }, { stage: 'Confirmed' });

  if (confirmRes.status !== 200) {
    throw new Error("Order confirmation failed: " + JSON.stringify(confirmRes));
  }
  console.log(`7. Order confirmed successfully! Stage: ${confirmRes.data.stage}, Inventory Status: ${confirmRes.data.inventory_status}`);

  // 9. Verify product stock: current should be 10, reserved should be 5, available should be 5
  const prodCheck1 = await request({
    hostname: 'localhost',
    port: 8001,
    path: `/api/products/${product.id}`,
    method: 'GET',
    headers: authHeaders
  });
  console.log(`8. Product stock after reservation: On-Hand: ${prodCheck1.data.current_stock}, Reserved: ${prodCheck1.data.reserved_stock}, Available: ${prodCheck1.data.available_stock}`);
  if (prodCheck1.data.reserved_stock !== 5 || prodCheck1.data.available_stock !== 5) {
    throw new Error("Stock counts mismatch after reservation!");
  }

  // 10. Attempt to confirm another order for 7 units (only 5 available) -> MUST FAIL!
  const order2Res = await request({
    hostname: 'localhost',
    port: 8001,
    path: '/api/orders',
    method: 'POST',
    headers: authHeaders
  }, {
    title: 'Order exceeding available stock',
    customer_id: customerId,
    stage: 'Not Started',
    items: [{ product_id: product.id, name: product.name, quantity: 7, unit_price: 250.00 }]
  });
  const failConfirm2Res = await request({
    hostname: 'localhost',
    port: 8001,
    path: `/api/orders/${order2Res.data.id}/stage`,
    method: 'POST',
    headers: authHeaders
  }, { stage: 'Confirmed' });
  if (failConfirm2Res.status === 200) {
    throw new Error("Expected confirmation to fail when exceeding available stock!");
  }
  console.log(`9. Over-reservation prevention verified! Error: "${failConfirm2Res.data.detail}"`);

  // 11. Dispatch / Deliver Order 1 -> Physical stock must deduct, reservation released, sold quantity incremented
  const deliverRes = await request({
    hostname: 'localhost',
    port: 8001,
    path: `/api/orders/${order.id}/stage`,
    method: 'POST',
    headers: authHeaders
  }, { stage: 'Delivered' });

  if (deliverRes.status !== 200) {
    throw new Error("Order delivery failed: " + JSON.stringify(deliverRes));
  }
  console.log(`10. Order delivered successfully! Stage: ${deliverRes.data.stage}, Inventory Status: ${deliverRes.data.inventory_status}`);

  const prodCheck2 = await request({
    hostname: 'localhost',
    port: 8001,
    path: `/api/products/${product.id}`,
    method: 'GET',
    headers: authHeaders
  });
  console.log(`11. Product stock after delivery: On-Hand: ${prodCheck2.data.current_stock}, Reserved: ${prodCheck2.data.reserved_stock}, Available: ${prodCheck2.data.available_stock}, Sold: ${prodCheck2.data.sold_quantity}`);
  if (prodCheck2.data.current_stock !== 5 || prodCheck2.data.reserved_stock !== 0 || prodCheck2.data.sold_quantity !== 5) {
    throw new Error("Stock counts mismatch after delivery!");
  }

  // 12. Test Customer Return: Return 2 units with restock = true
  const returnRes = await request({
    hostname: 'localhost',
    port: 8001,
    path: '/api/inventory/return',
    method: 'POST',
    headers: authHeaders
  }, {
    product_id: product.id,
    order_id: order.id,
    quantity: 2,
    restock: true,
    condition: 'good',
    reason: 'Customer ordered extra',
    notes: 'Boxes unopened and in mint condition'
  });
  if (returnRes.status !== 200) {
    throw new Error("Return failed: " + JSON.stringify(returnRes));
  }
  console.log(`12. Customer Return processed! Restocked 2 units. New on-hand: ${returnRes.data.new_stock}`);

  const prodCheck3 = await request({
    hostname: 'localhost',
    port: 8001,
    path: `/api/products/${product.id}`,
    method: 'GET',
    headers: authHeaders
  });
  console.log(`13. Product stock after restock return: On-Hand: ${prodCheck3.data.current_stock}, Available: ${prodCheck3.data.available_stock}, Sold: ${prodCheck3.data.sold_quantity}`);
  if (prodCheck3.data.current_stock !== 7 || prodCheck3.data.sold_quantity !== 3) {
    throw new Error("Return stock mismatch!");
  }

  // 13. Test Stock Adjustment: Set stock to 20 via audit
  const adjustRes = await request({
    hostname: 'localhost',
    port: 8001,
    path: '/api/inventory/adjust',
    method: 'POST',
    headers: authHeaders
  }, {
    product_id: product.id,
    adjustment_type: 'set',
    quantity: 20,
    reason: 'Quarterly Audit Correction',
    notes: 'Recount verified in bin A-12'
  });
  if (adjustRes.status !== 200) {
    throw new Error("Adjustment failed: " + JSON.stringify(adjustRes));
  }
  console.log(`14. Stock adjusted to 20 units! Previous: ${adjustRes.data.previous_stock}, New: ${adjustRes.data.new_stock}`);

  // 14. Check Movement History
  const movesRes = await request({
    hostname: 'localhost',
    port: 8001,
    path: `/api/inventory/movements?product_id=${product.id}`,
    method: 'GET',
    headers: authHeaders
  });
  console.log(`15. Movement audit log has ${movesRes.data.items.length} records for this product:`);
  for (const m of movesRes.data.items) {
    console.log(`   - [${m.movement_type.toUpperCase()}] Qty: ${m.quantity}, Prev: ${m.previous_stock} -> New: ${m.new_stock}, Notes: ${m.notes}`);
  }

  // 15. Check Low Stock Alerts
  const alertsRes = await request({
    hostname: 'localhost',
    port: 8001,
    path: '/api/inventory/alerts',
    method: 'GET',
    headers: authHeaders
  });
  console.log(`16. Low stock alerts active items count: ${alertsRes.data.length}`);

  console.log("\n>>> ALL INVENTORY BACKEND TESTS PASSED WITH 100% SUCCESS! <<<");
}

run().catch(err => {
  console.error("TEST FAILED:", err);
  process.exit(1);
});
