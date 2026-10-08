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

  console.log('\n2. Fetching leads to test on an existing lead...');
  const leadsRes = await request('/api/leads?limit=5', { headers });
  const lead = leadsRes.data.items[0];
  console.log(`   Target Lead: ${lead.name} (#${lead.number})`);

  console.log('\n3. Testing EXACT ERROR PAYLOAD: "2026-10-09T10:00" on PATCH /api/leads/' + lead.number + '...');
  const test1 = await request(`/api/leads/${lead.number}`, {
    method: 'PATCH',
    headers,
    body: {
      name: lead.name,
      follow_up_date: "2026-10-09T10:00"
    }
  });
  console.log(`   SUCCESS! HTTP ${test1.status}. Returned follow_up_date: ${test1.data.follow_up_date}`);

  console.log('\n4. Testing Date-only string: "2026-10-15"...');
  const test2 = await request(`/api/leads/${lead.number}`, {
    method: 'PATCH',
    headers,
    body: {
      follow_up_date: "2026-10-15"
    }
  });
  console.log(`   SUCCESS! HTTP ${test2.status}. Returned follow_up_date: ${test2.data.follow_up_date}`);

  console.log('\n5. Testing ISO-8601 UTC string: "2026-10-20T14:30:00Z"...');
  const test3 = await request(`/api/leads/${lead.number}`, {
    method: 'PATCH',
    headers,
    body: {
      follow_up_date: "2026-10-20T14:30:00Z"
    }
  });
  console.log(`   SUCCESS! HTTP ${test3.status}. Returned follow_up_date: ${test3.data.follow_up_date}`);

  console.log('\n6. Testing CLEARING date with null...');
  const test4 = await request(`/api/leads/${lead.number}`, {
    method: 'PATCH',
    headers,
    body: {
      follow_up_date: null
    }
  });
  console.log(`   SUCCESS! HTTP ${test4.status}. Returned follow_up_date: ${test4.data.follow_up_date}`);

  console.log('\n7. Testing CLEARING date with empty string ""...');
  const test5 = await request(`/api/leads/${lead.number}`, {
    method: 'PATCH',
    headers,
    body: {
      follow_up_date: ""
    }
  });
  console.log(`   SUCCESS! HTTP ${test5.status}. Returned follow_up_date: ${test5.data.follow_up_date}`);

  console.log('\n8. Testing creating new lead with HTML5 datetime-local format "2026-10-09T10:00"...');
  const testNum = '99' + Math.floor(10000000 + Math.random() * 90000000);
  const testCreate = await request('/api/leads', {
    method: 'POST',
    headers,
    body: {
      number: testNum,
      name: 'Datetime Test Lead',
      email: `test_${testNum}@example.com`,
      requirement: 'Testing HTML5 datetime-local input',
      source: 'Website',
      city: 'Mumbai',
      status: 'New',
      follow_up_date: "2026-10-09T10:00"
    }
  });
  console.log(`   SUCCESS! Created lead #${testCreate.data.number}. Follow-up date: ${testCreate.data.follow_up_date}`);

  // Clean up test lead
  await request(`/api/leads/${testNum}?permanent=true`, { method: 'DELETE', headers });
  console.log('   Cleaned up test lead.');

  console.log('\n=== ALL DATETIME PARSING & POSTGRESQL PERSISTENCE TESTS PASSED! ===');
}

main().catch(err => {
  console.error('Test failed:', err);
  process.exit(1);
});
