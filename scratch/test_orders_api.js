const http = require('http');

async function request(path, options = {}) {
  return new Promise((resolve, reject) => {
    const defaultHeaders = {
      'Content-Type': 'application/json',
      ...(options.headers || {})
    };
    const req = http.request(`http://localhost:8001${path}`, {
      method: options.method || 'GET',
      headers: defaultHeaders
    }, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          const json = body ? JSON.parse(body) : {};
          if (res.statusCode >= 200 && res.statusCode < 300) {
            resolve({ status: res.statusCode, data: json });
          } else {
            reject(new Error(`HTTP ${res.statusCode}: ${body}`));
          }
        } catch (e) {
          resolve({ status: res.statusCode, body });
        }
      });
    });
    req.on('error', reject);
    if (options.body) {
      req.write(JSON.stringify(options.body));
    }
    req.end();
  });
}

async function main() {
  console.log('1. Logging in as admin...');
  const loginRes = await request('/api/auth/login', {
    method: 'POST',
    body: { email: 'admin@crmdemo.com', password: 'admin123' }
  });
  const token = loginRes.data.access_token;
  const headers = { Authorization: `Bearer ${token}` };
  console.log('   Logged in successfully.');

  console.log('\n2. Listing existing orders...');
  const ordersListRes = await request('/api/orders', { headers });
  console.log(`   Found ${ordersListRes.data.items ? ordersListRes.data.items.length : 0} existing orders.`);

  console.log('\n3. Finding or creating a Won Deal to test Order creation...');
  const dealsRes = await request('/api/deals', { headers });
  const wonDeal = (dealsRes.data.items || []).find(d => d.stage?.is_won || d.status === 'won');
  
  let targetDealId;
  let targetCustomerId;
  if (wonDeal) {
    console.log(`   Found existing Won Deal: ID=${wonDeal.id}, Title="${wonDeal.title}"`);
    targetDealId = wonDeal.id;
    targetCustomerId = wonDeal.customer_id;
  } else {
    console.log('   No Won deal found, fetching pipelines to locate Won stage...');
    const pipelinesRes = await request('/api/pipelines', { headers });
    const defaultPipeline = pipelinesRes.data.find(p => p.is_default) || pipelinesRes.data[0];
    const wonStage = defaultPipeline.stages.find(s => s.is_won);
    
    // Find any customer
    const customersRes = await request('/api/customers', { headers });
    targetCustomerId = customersRes.data.items[0].id;

    // Create a new deal and move to won
    const newDealRes = await request('/api/deals', {
      method: 'POST',
      headers,
      body: {
        name: 'Enterprise Fulfillment Test Deal',
        customer_id: targetCustomerId,
        pipeline_id: defaultPipeline.id,
        stage_id: defaultPipeline.stages[0].id,
        amount: 150000,
        currency: 'INR'
      }
    });
    targetDealId = newDealRes.data?.id;
    console.log(`   newDealRes data:`, newDealRes.data);
    console.log(`   Created new Deal ID=${targetDealId}`);

    // Move to Won stage
    console.log(`   Moving Deal to Won stage (ID=${wonStage.id})...`);
    await request(`/api/deals/${targetDealId}/stage`, {
      method: 'POST',
      headers,
      body: { stage_id: wonStage.id }
    });
  }

  console.log('\n4. Checking if Order was auto-created or creating one via API...');
  let afterOrdersRes = await request('/api/orders', { headers });
  let order = (afterOrdersRes.data.items || []).find(o => o.deal_id === targetDealId);

  if (!order) {
    console.log('   Auto-created order not found for deal, calling /api/deals/' + targetDealId + '/create-order...');
    const createRes = await request(`/api/deals/${targetDealId}/create-order`, {
      method: 'POST',
      headers,
      body: { title: 'Enterprise Fulfillment Order' }
    });
    order = createRes.data;
  }
  console.log(`   Order active: ID=${order.id}, Number=${order.order_number}, Title="${order.title}", Stage="${order.stage}"`);
  console.log(`   Customer ID=${order.customer_id}, Deal ID=${order.deal_id}, Quotation ID=${order.quotation_id || 'None'}`);

  console.log('\n5. Verifying Order Detail with items and activities...');
  const detailRes = await request(`/api/orders/${order.id}`, { headers });
  const detail = detailRes.data;
  console.log(`   Order has ${detail.items ? detail.items.length : 0} line item deliverables.`);
  console.log(`   Order has ${detail.activities ? detail.activities.length : 0} activity records.`);

  console.log('\n6. Testing Fulfillment Stage progression through all 7 stages:');
  const stages = [
    'Not Started',
    'Planning',
    'In Progress',
    'Client Review',
    'Revision/Changes',
    'Delivered',
    'Completed'
  ];

  for (const st of stages) {
    const stageRes = await request(`/api/orders/${order.id}/stage`, {
      method: 'POST',
      headers,
      body: { stage: st, comment: `Transitioned to ${st} in automated verification` }
    });
    console.log(`   -> Stage updated to: "${stageRes.data.stage}" (HTTP ${stageRes.status})`);
  }

  console.log('\n7. Testing independent Payment and Invoice Status updates...');
  const updateRes = await request(`/api/orders/${order.id}`, {
    method: 'PATCH',
    headers,
    body: {
      payment_status: 'Paid',
      invoice_status: 'Invoiced',
      notes: 'Fully delivered and invoiced.'
    }
  });
  console.log(`   Order updated: PaymentStatus="${updateRes.data.payment_status}", InvoiceStatus="${updateRes.data.invoice_status}", Stage="${updateRes.data.stage}"`);
  if (updateRes.data.stage === 'Completed' && updateRes.data.payment_status === 'Paid') {
    console.log('   SUCCESS: Fulfillment stage remained "Completed" independently of PaymentStatus="Paid" and InvoiceStatus="Invoiced"!');
  } else {
    throw new Error('Fulfillment stage collided with payment status');
  }

  console.log('\n8. Testing creation of standalone Order from Won Deal via POST /api/orders...');
  const manualOrderRes = await request('/api/orders', {
    method: 'POST',
    headers,
    body: {
      title: 'Manual Custom Order',
      deal_id: targetDealId,
      customer_id: targetCustomerId,
      total_amount: 50000,
      currency: 'INR',
      items: [
        {
          item_name: 'Custom Service Sprint',
          description: 'Implementation Sprint 1',
          quantity: 1,
          unit_price: 50000,
          gst_rate: 18,
          gst_amount: 9000,
          cgst_rate: 9,
          cgst_amount: 4500,
          sgst_rate: 9,
          sgst_amount: 4500,
          line_total: 59000
        }
      ]
    }
  });
  console.log(`   Manual Order created: ID=${manualOrderRes.data.id}, Number=${manualOrderRes.data.order_number}, Items=${manualOrderRes.data.items?.length}`);

  console.log('\n=== ALL API VERIFICATION TESTS PASSED SUCCESSFULLY! ===');
}

main().catch(err => {
  console.error('Test failed:', err);
  process.exit(1);
});
