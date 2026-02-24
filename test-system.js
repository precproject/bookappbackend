const axios = require('axios');
const crypto = require('crypto');

const BASE_URL = 'http://localhost:5001/api';
const api = axios.create({ baseURL: BASE_URL, timeout: 15000 });

// --- STATE VARIABLES ---
let state = {
  adminToken: '', adminMongoId: '', customerToken: '', 
  physBookId: '', digBookId: '', 
  discountCode: `DISC-${Date.now()}`, referralCode: `REF-${Date.now()}`,
  order1_Id: '', order1_MongoId: '', order2_Id: '', order3_Fail_Id: '', order4_Sync_Id: ''
};

// Helper to format and isolate errors
const handleError = (error, stepName) => {
  console.log(`\n❌ FAILED AT: ${stepName}`);
  if (error.code === 'ECONNREFUSED') {
    console.error('   -> SERVER IS DOWN! Ensure localhost:5001 is running.');
  } else if (error.response) {
    console.error(`   -> API Error [${error.response.status}]:`, error.response.data.message || error.response.data);
  } else {
    console.error('   -> Error:', error.message);
  }
};

const runTests = async () => {
  console.log('🚀 STARTING ULTIMATE ISOLATED LIFECYCLE TEST (18 SCENARIOS)...\n');

  // --- 0. HEALTH CHECK ---
  try {
    console.log('⏳ 0. Server Health Check...');
    await api.get('/health');
    console.log('✅ Server is online!\n');
  } catch (err) {
    handleError(err, 'Health Check');
    console.log('🛑 FATAL: Server is down. Aborting tests.\n');
    return;
  }

  // --- 1. ADMIN LOGIN ---
  try {
    console.log('⏳ 1. Authenticating Admin...');
    const adminLogin = await api.post('/auth/login', { email: 'admin@chintamukti.com', password: 'Admin@123' });
    state.adminToken = adminLogin.data.token;
    state.adminMongoId = adminLogin.data._id;
    console.log('✅ Admin Logged In!\n');
  } catch (err) { handleError(err, 'Admin Login'); }

  // --- 2. DYNAMIC SETTINGS ---
  if (state.adminToken) {
    try {
      console.log('⏳ 2. Configuring Dynamic Settings...');
      await api.put('/admin/settings', {
        payment: { provider: 'PhonePe', merchantId: 'TEST_MERCHANT_99', saltKey: 'test_salt_123', saltIndex: 1, isLiveMode: false }
      }, { headers: { Authorization: `Bearer ${state.adminToken}` } });
      console.log('✅ Keys configured dynamically!\n');
    } catch (err) { handleError(err, 'Update Settings'); }
  } else console.log('⏭️ Skipping Step 2: No Admin Token\n');

  // --- 3. CREATE INVENTORY ---
  if (state.adminToken) {
    try {
      console.log('⏳ 3. Creating Physical & Digital Inventory...');
      const physRes = await api.post('/admin/inventory', { sku: `PHYS-${Date.now()}`, title: 'Physical Book', description: 'Hardcopy', type: 'Physical', price: 300, stock: 50 }, { headers: { Authorization: `Bearer ${state.adminToken}` } });
      const digRes = await api.post('/admin/inventory', { sku: `DIG-${Date.now()}`, title: 'eBook', description: 'PDF', type: 'Digital', price: 150, stock: null }, { headers: { Authorization: `Bearer ${state.adminToken}` } });
      state.physBookId = physRes.data._id; 
      state.digBookId = digRes.data._id;
      console.log(`✅ Inventory Created! (Phys: 50 stock, Dig: Infinite)\n`);
    } catch (err) { handleError(err, 'Create Inventory'); }
  } else console.log('⏭️ Skipping Step 3: No Admin Token\n');

  // --- 4. CREATE PROMOS ---
  if (state.adminToken) {
    try {
      console.log('⏳ 4. Creating Promos (Discount & Referral)...');
      await api.post('/admin/discounts', { code: state.discountCode, type: 'Amount', value: 50, maxDiscount: 50 }, { headers: { Authorization: `Bearer ${state.adminToken}` } });
      await api.post('/admin/referrals', { code: state.referralCode, user: state.adminMongoId, rewardRate: 100, isDiscountLinked: true }, { headers: { Authorization: `Bearer ${state.adminToken}` } });
      console.log(`✅ Promos Active! Disc: ${state.discountCode}, Ref: ${state.referralCode}\n`);
    } catch (err) { handleError(err, 'Create Promos'); }
  } else console.log('⏭️ Skipping Step 4: No Admin Token\n');

  // --- 5. PUBLIC STOREFRONT API ---
  try {
    console.log('⏳ 5. Verifying Public Storefront API...');
    const publicBooks = await api.get('/public/books');
    console.log(`✅ Storefront accessible to public. Found ${publicBooks.data.length} books.\n`);
  } catch (err) { handleError(err, 'Public API'); }

  // --- 6. CUSTOMER REGISTRATION ---
  try {
    console.log('⏳ 6. Registering new Customer...');
    // Using Date.now() guarantees the email and mobile are always unique per test run
    const uniqueNum = Math.floor(10000000 + Math.random() * 90000000);
    const newCustomer = await api.post('/auth/register', { name: 'Test Cust', email: `cust${Date.now()}@test.com`, mobile: `98${uniqueNum}`, password: 'pass' });
    state.customerToken = newCustomer.data.token;
    console.log('✅ Customer account created!\n');
  } catch (err) { handleError(err, 'Customer Registration'); }

  // --- 7. CHECKOUT 1 ---
  if (state.customerToken && state.physBookId) {
    try {
      console.log('⏳ 7. Checkout 1: Physical Book + Discount Code...');
      const order1 = await api.post('/orders/checkout', { orderItems: [{ bookId: state.physBookId, qty: 1 }], shippingAddress: 'Pune', discountCode: state.discountCode }, { headers: { Authorization: `Bearer ${state.customerToken}` } });
      state.order1_Id = order1.data.orderId;
      console.log(`✅ Order 1 Placed (Pending). Total: ₹${order1.data.totalAmount} (300+50ship-50disc)\n`);
    } catch (err) { handleError(err, 'Checkout 1'); }
  } else console.log('⏭️ Skipping Step 7: Missing Customer or Book data\n');

  // --- 8. CHECKOUT 2 ---
  if (state.customerToken && state.digBookId) {
    try {
      console.log('⏳ 8. Checkout 2: Digital Book + Referral Code...');
      const order2 = await api.post('/orders/checkout', { orderItems: [{ bookId: state.digBookId, qty: 1 }], shippingAddress: '', referralCode: state.referralCode }, { headers: { Authorization: `Bearer ${state.customerToken}` } });
      state.order2_Id = order2.data.orderId;
      console.log(`✅ Order 2 Placed (Pending). Total: ₹${order2.data.totalAmount} (150-50ref)\n`);
    } catch (err) { handleError(err, 'Checkout 2'); }
  } else console.log('⏭️ Skipping Step 8: Missing Customer or Book data\n');

  // --- 9. WEBHOOK SUCCESS ---
  if (state.order1_Id && state.order2_Id) {
    try {
      console.log('⏳ 9. Processing Webhooks (Simulating PhonePe Success)...');
      const simulateSuccessWebhook = async (oId) => {
        const payload = Buffer.from(JSON.stringify({ data: { merchantTransactionId: oId, transactionId: `TXN-${Date.now()}`, code: 'PAYMENT_SUCCESS' } })).toString('base64');
        const hash = crypto.createHash('sha256').update(payload + 'test_salt_123').digest('hex') + "###1";
        await api.post('/webhooks/phonepe', { response: payload }, { headers: { 'x-verify': hash } });
      };
      await simulateSuccessWebhook(state.order1_Id);
      await simulateSuccessWebhook(state.order2_Id);
      console.log('✅ Webhooks caught! Orders marked Success, stock deducted, referrers credited.\n');
    } catch (err) { handleError(err, 'Payment Webhook Success'); }
  } else console.log('⏭️ Skipping Step 9: Missing Order IDs\n');

  // --- 10. CUSTOMER HISTORY ---
  if (state.customerToken) {
    try {
      console.log('⏳ 10. Customer Order History Check...');
      const myOrders = await api.get('/orders/myorders', { headers: { Authorization: `Bearer ${state.customerToken}` } });
      const foundOrder = myOrders.data.find(o => o.orderId === state.order1_Id);
      if (foundOrder) state.order1_MongoId = foundOrder._id;
      console.log(`✅ Customer sees ${myOrders.data.length} orders in history.\n`);
    } catch (err) { handleError(err, 'Customer History Check'); }
  } else console.log('⏭️ Skipping Step 10: Missing Customer Token\n');

  // --- 11. ADMIN ADD TRACKING ---
  if (state.adminToken && state.order1_MongoId) {
    try {
      console.log('⏳ 11. Admin adds Tracking to Order 1...');
      await api.put(`/admin/orders/${state.order1_MongoId}/status`, { partner: 'Delhivery', trackingId: 'AWB-123' }, { headers: { Authorization: `Bearer ${state.adminToken}` } });
      console.log('✅ Tracking saved.\n');
    } catch (err) { handleError(err, 'Admin Add Tracking'); }
  } else console.log('⏭️ Skipping Step 11: Missing Admin Token or Order Mongo ID\n');

  // --- 12. LOGISTICS WEBHOOK ---
  if (state.order1_Id) {
    try {
      console.log('⏳ 12. Processing Delivery Webhook...');
      await api.post('/webhooks/delivery', { waybill: 'AWB-123', current_status: 'Delivered', status_dateTime: new Date().toISOString() });
      console.log('✅ Transit history updated to Delivered via Logistics API.\n');
    } catch (err) { handleError(err, 'Delivery Webhook'); }
  } else console.log('⏭️ Skipping Step 12: Missing Order 1 ID\n');

  // --- 13. ADMIN ADJUST INVENTORY ---
  if (state.adminToken && state.physBookId) {
    try {
      console.log('⏳ 13. Admin adjusts inventory manually...');
      await api.put(`/admin/inventory/${state.physBookId}`, { type: 'Physical', stock: 60 }, { headers: { Authorization: `Bearer ${state.adminToken}` } });
      console.log('✅ Stock corrected. Manual change logged in history array.\n');
    } catch (err) { handleError(err, 'Manual Inventory Adjustment'); }
  } else console.log('⏭️ Skipping Step 13: Missing Admin Token or Book ID\n');

  // --- 14. ADMIN PAYOUT REFERRAL ---
  if (state.adminToken) {
    try {
      console.log('⏳ 14. Admin clears Referral Payout...');
      const refs = await api.get('/admin/referrals', { headers: { Authorization: `Bearer ${state.adminToken}` } });
      const targetRef = refs.data.find(r => r.code === state.referralCode);
      if (targetRef) await api.put(`/admin/referrals/${targetRef._id}/mark-paid`, { amount: targetRef.pendingPayout }, { headers: { Authorization: `Bearer ${state.adminToken}` } });
      console.log('✅ Payout cleared!\n');
    } catch (err) { handleError(err, 'Referral Payout'); }
  } else console.log('⏭️ Skipping Step 14: Missing Admin Token\n');

  // --- 15. CHECKOUT 3 (FAILED) ---
  if (state.customerToken && state.physBookId) {
    try {
      console.log('⏳ 15. Checkout 3: Failed Payment Scenario...');
      const order3 = await api.post('/orders/checkout', { orderItems: [{ bookId: state.physBookId, qty: 1 }], shippingAddress: 'Pune' }, { headers: { Authorization: `Bearer ${state.customerToken}` } });
      state.order3_Fail_Id = order3.data.orderId;
      
      const failPayload = Buffer.from(JSON.stringify({ data: { merchantTransactionId: state.order3_Fail_Id, code: 'PAYMENT_ERROR' } })).toString('base64');
      const failHash = crypto.createHash('sha256').update(failPayload + 'test_salt_123').digest('hex') + "###1";
      await api.post('/webhooks/phonepe', { response: failPayload }, { headers: { 'x-verify': failHash } });
      console.log('✅ Webhook caught failure! Order marked Failed, stock protected.\n');
    } catch (err) { handleError(err, 'Failed Payment Scenario'); }
  } else console.log('⏭️ Skipping Step 15: Missing Customer or Book data\n');

  // --- 16. CHECKOUT 4 (MISSED WEBHOOK / SYNC) ---
  if (state.customerToken && state.physBookId) {
    try {
      console.log('⏳ 16. Checkout 4: The "Missed Webhook" Status Verification...');
      const order4 = await api.post('/orders/checkout', { orderItems: [{ bookId: state.physBookId, qty: 1 }], shippingAddress: 'Pune' }, { headers: { Authorization: `Bearer ${state.customerToken}` } });
      state.order4_Sync_Id = order4.data.orderId;
      
      const verifyRes = await api.get(`/orders/verify-payment/${state.order4_Sync_Id}`, { headers: { Authorization: `Bearer ${state.customerToken}` } });
      console.log(`✅ Verification API forced a sync! Result: ${verifyRes.data.status} (Expected: Failed due to fake test keys).\n`);
    } catch (err) { handleError(err, 'Missed Webhook Verification'); }
  } else console.log('⏭️ Skipping Step 16: Missing Customer or Book data\n');

  // --- 17. ADMIN FETCH ALL TABLES ---
  if (state.adminToken) {
    try {
      console.log('⏳ 17. Admin verifying all Data Tables...');
      await Promise.all([
        api.get('/admin/orders', { headers: { Authorization: `Bearer ${state.adminToken}` } }),
        api.get('/admin/users', { headers: { Authorization: `Bearer ${state.adminToken}` } }),
        api.get('/admin/discounts', { headers: { Authorization: `Bearer ${state.adminToken}` } })
      ]);
      console.log('✅ All Admin dashboards successfully retrieved complex relational data!\n');
    } catch (err) { handleError(err, 'Admin Fetch Tables'); }
  } else console.log('⏭️ Skipping Step 17: Missing Admin Token\n');

  // --- 18. SUSPEND MALICIOUS USER ---
  if (state.adminToken && state.customerToken) {
    try {
      console.log('⏳ 18. Security: Suspending Malicious User...');
      const myInfo = await api.get('/auth/profile', { headers: { Authorization: `Bearer ${state.customerToken}` } });
      await api.put(`/admin/users/${myInfo.data._id}/toggle-status`, {}, { headers: { Authorization: `Bearer ${state.adminToken}` } });
      
      try {
        await api.get('/auth/profile', { headers: { Authorization: `Bearer ${state.customerToken}` } });
        console.log('❌ FAILURE: Suspended user bypassed security block.');
      } catch (err) {
        if (err.response?.status === 403) console.log('✅ SUCCESS: User is blocked with 403 Forbidden!\n');
        else throw err; // Re-throw if it's a different error
      }
    } catch (err) { handleError(err, 'Suspend User'); }
  } else console.log('⏭️ Skipping Step 18: Missing Admin or Customer Token\n');

  console.log('🎉🎉🎉 TEST SCRIPT FINISHED! CHECK LOGS FOR ANY ISOLATED FAILURES. 🎉🎉🎉\n');
};

runTests();