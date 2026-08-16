// Quick test script for all webhook endpoints
const http = require('http');

const BASE_URL = 'http://localhost:3000';

function makeRequest(method, path, body) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, BASE_URL);
    const options = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname,
      method,
      headers: body ? { 'Content-Type': 'application/json' } : {},
    };
    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        try { resolve({ status: res.statusCode, body: JSON.parse(data) }); }
        catch { resolve({ status: res.statusCode, body: data }); }
      });
    });
    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

function makeToolCall(toolCallId, name, args) {
  return {
    message: {
      type: 'tool-calls',
      toolCalls: [{ id: toolCallId, function: { name, arguments: args } }]
    }
  };
}

async function runTests() {
  let passed = 0;
  let failed = 0;

  console.log('\n╔══════════════════════════════════════════════════╗');
  console.log('║   KAPTURE MOCK SERVER — ENDPOINT TEST SUITE     ║');
  console.log('╚══════════════════════════════════════════════════╝\n');

  // Test 1: Health check
  try {
    const r = await makeRequest('GET', '/health');
    const ok = r.status === 200 && r.body.status === 'ok';
    console.log(`${ok ? '✅' : '❌'} Test 1: GET /health`);
    console.log(`   Response: ${JSON.stringify(r.body)}\n`);
    ok ? passed++ : failed++;
  } catch (e) { console.log(`❌ Test 1: GET /health — ${e.message}\n`); failed++; }

  // Test 2: verify_customer (valid code 1234)
  try {
    const r = await makeRequest('POST', '/webhook', makeToolCall('call-1', 'verify_customer', { account_id: 'ACC-88392', verification_code: '1234' }));
    const result = JSON.parse(r.body.results[0].result);
    const ok = result.verified === true && result.customer_name === 'Rahul Sharma';
    console.log(`${ok ? '✅' : '❌'} Test 2: verify_customer (valid code "1234")`);
    console.log(`   Result: ${JSON.stringify(result)}\n`);
    ok ? passed++ : failed++;
  } catch (e) { console.log(`❌ Test 2: verify_customer — ${e.message}\n`); failed++; }

  // Test 3: verify_customer (valid code 1995)
  try {
    const r = await makeRequest('POST', '/webhook', makeToolCall('call-2', 'verify_customer', { account_id: 'ACC-88392', verification_code: '1995' }));
    const result = JSON.parse(r.body.results[0].result);
    const ok = result.verified === true;
    console.log(`${ok ? '✅' : '❌'} Test 3: verify_customer (valid code "1995")`);
    console.log(`   Result: ${JSON.stringify(result)}\n`);
    ok ? passed++ : failed++;
  } catch (e) { console.log(`❌ Test 3: verify_customer — ${e.message}\n`); failed++; }

  // Test 4: verify_customer (invalid code)
  try {
    const r = await makeRequest('POST', '/webhook', makeToolCall('call-3', 'verify_customer', { account_id: 'ACC-88392', verification_code: '9999' }));
    const result = JSON.parse(r.body.results[0].result);
    const ok = result.verified === false;
    console.log(`${ok ? '✅' : '❌'} Test 4: verify_customer (invalid code "9999")`);
    console.log(`   Result: ${JSON.stringify(result)}\n`);
    ok ? passed++ : failed++;
  } catch (e) { console.log(`❌ Test 4: verify_customer — ${e.message}\n`); failed++; }

  // Test 5: log_promise_to_pay
  try {
    const r = await makeRequest('POST', '/webhook', makeToolCall('call-4', 'log_promise_to_pay', { account_id: 'ACC-88392', ptp_date: '2026-08-14', amount: 8499 }));
    const result = JSON.parse(r.body.results[0].result);
    const ok = result.success === true && result.ptp_id.startsWith('PTP-') && result.amount === 8499;
    console.log(`${ok ? '✅' : '❌'} Test 5: log_promise_to_pay`);
    console.log(`   Result: ${JSON.stringify(result)}\n`);
    ok ? passed++ : failed++;
  } catch (e) { console.log(`❌ Test 5: log_promise_to_pay — ${e.message}\n`); failed++; }

  // Test 6: send_payment_link (SMS)
  try {
    const r = await makeRequest('POST', '/webhook', makeToolCall('call-5', 'send_payment_link', { account_id: 'ACC-88392', channel: 'SMS' }));
    const result = JSON.parse(r.body.results[0].result);
    const ok = result.success === true && result.link_sent === true;
    console.log(`${ok ? '✅' : '❌'} Test 6: send_payment_link (SMS)`);
    console.log(`   Result: ${JSON.stringify(result)}\n`);
    ok ? passed++ : failed++;
  } catch (e) { console.log(`❌ Test 6: send_payment_link — ${e.message}\n`); failed++; }

  // Test 7: send_payment_link (WhatsApp)
  try {
    const r = await makeRequest('POST', '/webhook', makeToolCall('call-6', 'send_payment_link', { account_id: 'ACC-88392', channel: 'WhatsApp' }));
    const result = JSON.parse(r.body.results[0].result);
    const ok = result.success === true && result.message.includes('WhatsApp');
    console.log(`${ok ? '✅' : '❌'} Test 7: send_payment_link (WhatsApp)`);
    console.log(`   Result: ${JSON.stringify(result)}\n`);
    ok ? passed++ : failed++;
  } catch (e) { console.log(`❌ Test 7: send_payment_link — ${e.message}\n`); failed++; }

  // Test 8: escalate_to_agent
  try {
    const r = await makeRequest('POST', '/webhook', makeToolCall('call-7', 'escalate_to_agent', { account_id: 'ACC-88392', reason: 'DISPUTE', notes: 'Customer disputes amount' }));
    const result = JSON.parse(r.body.results[0].result);
    const ok = result.success === true && result.ticket_id.startsWith('ESC-');
    console.log(`${ok ? '✅' : '❌'} Test 8: escalate_to_agent (DISPUTE)`);
    console.log(`   Result: ${JSON.stringify(result)}\n`);
    ok ? passed++ : failed++;
  } catch (e) { console.log(`❌ Test 8: escalate_to_agent — ${e.message}\n`); failed++; }

  // Test 9: mark_disposition (PTP_AGREED)
  try {
    const r = await makeRequest('POST', '/webhook', makeToolCall('call-8', 'mark_disposition', { account_id: 'ACC-88392', status: 'PTP_AGREED', notes: 'Customer agreed to pay by Friday' }));
    const result = JSON.parse(r.body.results[0].result);
    const ok = result.success === true && result.disposition_logged === 'PTP_AGREED';
    console.log(`${ok ? '✅' : '❌'} Test 9: mark_disposition (PTP_AGREED)`);
    console.log(`   Result: ${JSON.stringify(result)}\n`);
    ok ? passed++ : failed++;
  } catch (e) { console.log(`❌ Test 9: mark_disposition — ${e.message}\n`); failed++; }

  // Test 10: mark_disposition (DO_NOT_CALL)
  try {
    const r = await makeRequest('POST', '/webhook', makeToolCall('call-9', 'mark_disposition', { account_id: 'ACC-88392', status: 'DO_NOT_CALL', notes: 'Customer requested opt-out' }));
    const result = JSON.parse(r.body.results[0].result);
    const ok = result.success === true && result.disposition_logged === 'DO_NOT_CALL';
    console.log(`${ok ? '✅' : '❌'} Test 10: mark_disposition (DO_NOT_CALL)`);
    console.log(`   Result: ${JSON.stringify(result)}\n`);
    ok ? passed++ : failed++;
  } catch (e) { console.log(`❌ Test 10: mark_disposition — ${e.message}\n`); failed++; }

  // Test 11: Non-tool-call event (status-update)
  try {
    const r = await makeRequest('POST', '/webhook', { message: { type: 'status-update', status: 'in-progress' } });
    const ok = r.status === 200;
    console.log(`${ok ? '✅' : '❌'} Test 11: Non-tool-call event (status-update) → acknowledged`);
    console.log(`   Status: ${r.status}\n`);
    ok ? passed++ : failed++;
  } catch (e) { console.log(`❌ Test 11: status-update — ${e.message}\n`); failed++; }

  // Test 12: Unknown tool call
  try {
    const r = await makeRequest('POST', '/webhook', makeToolCall('call-10', 'unknown_function', {}));
    const result = JSON.parse(r.body.results[0].result);
    const ok = result.error !== undefined;
    console.log(`${ok ? '✅' : '❌'} Test 12: Unknown tool call → error returned`);
    console.log(`   Result: ${JSON.stringify(result)}\n`);
    ok ? passed++ : failed++;
  } catch (e) { console.log(`❌ Test 12: unknown tool — ${e.message}\n`); failed++; }

  // Test 13: Vapi response format (toolCallId matches)
  try {
    const r = await makeRequest('POST', '/webhook', makeToolCall('my-custom-id-123', 'mark_disposition', { account_id: 'ACC-88392', status: 'NO_RESPONSE' }));
    const ok = r.body.results[0].toolCallId === 'my-custom-id-123';
    console.log(`${ok ? '✅' : '❌'} Test 13: toolCallId round-trip (preserves call ID)`);
    console.log(`   Sent: "my-custom-id-123", Got: "${r.body.results[0].toolCallId}"\n`);
    ok ? passed++ : failed++;
  } catch (e) { console.log(`❌ Test 13: toolCallId — ${e.message}\n`); failed++; }

  // Summary
  console.log('══════════════════════════════════════════════════');
  console.log(`  Results: ${passed} passed, ${failed} failed, ${passed + failed} total`);
  console.log('══════════════════════════════════════════════════\n');

  process.exit(failed > 0 ? 1 : 0);
}

runTests();
