// Routes/Payment/subscriptionRoutes.js

import express                   from 'express';
import {
  initiateSubscription,
  getMySubscription,
  cancelSubscription,
  handleWebhook,
  getPlans,
}                                from '../../Controller/Subscription/subscription.controller.js';
import { protect }               from '../../Middleware/authMiddleware.js';
import { attachSubscription }    from '../../Middleware/Payment-Middleware/subscriptionMiddleware.js';
import { verifyRazorpayWebhook } from '../../Middleware/Payment-Middleware/webhookMiddleware.js';

const Subscriptionrouter = express.Router();

// ── Public ──
Subscriptionrouter.get('/plans', getPlans);

// ── Webhook — NO protect ──
Subscriptionrouter.post('/webhook',
  verifyRazorpayWebhook,
  handleWebhook
);

// ── Authenticated ──
Subscriptionrouter.post('/subscribe',    protect, attachSubscription, initiateSubscription);
Subscriptionrouter.get('/my-subscription', protect, attachSubscription, getMySubscription);
Subscriptionrouter.post('/cancel',       protect, attachSubscription, cancelSubscription);

export default Subscriptionrouter;