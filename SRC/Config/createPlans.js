// createPlans.js
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import path from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// .env is at project root — go up 2 levels from SRC/Config/
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

// ✅ Dynamic import AFTER dotenv runs (fixes ESM hoisting issue)
const { createRazorpayPlan } = await import('../Service/Payment-services/subscription.service.js');

console.log('🚀 Creating Razorpay plans in TEST mode...');
console.log('Key:', process.env.RAZORPAY_TEST_KEY_ID);

try {
  const clientPlan = await createRazorpayPlan('client');
  console.log('✅ Client Plan:', clientPlan.id);

  const employeePlan = await createRazorpayPlan('employee');
  console.log('✅ Employee Plan:', employeePlan.id);

  console.log('\nCopy these to your .env:');
  console.log(`RAZORPAY_PLAN_CLIENT_PREMIUM=${clientPlan.id}`);
  console.log(`RAZORPAY_PLAN_EMPLOYEE_PREMIUM=${employeePlan.id}`);

} catch (err) {
  console.error('❌ Failed:', err.message);
  process.exit(1);
}