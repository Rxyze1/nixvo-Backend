// Services/Subscription/subscription.service.js

import Subscription from '../../Models/Subscription/Subscription.Model.js';
import User from '../../Models/USER-Auth/User-Auth.-Model.js';
import Client from '../../Models/USER-Auth/Client-Model.js';
import Employee from '../../Models/USER-Auth/Employee-Model.js';
import { razorpay } from '../../Config/razorpay.js';
import mongoose from 'mongoose';

// ─────────────────────────────────────────────────────────────
// PLAN MAPPING — PREMIUM ONLY
// ─────────────────────────────────────────────────────────────
const PLAN_CONFIG = {
  client: {
    free: { price: 0, features: 'basic' },
    premium: { price: 49, features: 'premium' },
  },
  employee: {
    free: { price: 0, features: 'basic' },
    premium: { price: 149, features: 'premium' },
  },
};

const PLAN_FEATURES = {
  basic: {
    maxJobsPerMonth: 5,
    maxApplications: 10,
    maxBidsPerJob: 3,
    escrowTransactions: true,
    premiumBadge: false,
    prioritySupport: false,
    advancedAnalytics: false,
    customBranding: false,
    apiAccess: false,
    walletAccess: true,
    bulkUpload: false,
  },
  premium: {
    maxJobsPerMonth: 999,
    maxApplications: 9999,
    maxBidsPerJob: 999,
    escrowTransactions: true,
    premiumBadge: true,
    prioritySupport: true,
    advancedAnalytics: true,
    customBranding: true,
    apiAccess: true,
    walletAccess: true,
    bulkUpload: true,
  },
};

class SubscriptionService {
  // ───────────────────────────────────────────────────────────────
  // 1️⃣ CREATE SUBSCRIPTION
  // ───────────────────────────────────────────────────────────────
  async createSubscription(userId, userType, plan, billingCycle = 'monthly') {
    try {
      // ✅ Validate user exists
      const user = await User.findById(userId);
      if (!user) {
        throw new Error('User not found');
      }

      // ✅ Validate plan
      if (!PLAN_CONFIG[userType]?.[plan]) {
        throw new Error(`Invalid plan "${plan}" for userType "${userType}"`);
      }

      // TO ✅
const existingSub = await Subscription.findOne({ userId });
if (existingSub) {
  if (existingSub.subscriptionStatus === 'active') {
    throw new Error('User already has an active subscription');
  }
  // stale sub — delete and allow fresh create
  await Subscription.deleteOne({ userId });
  console.log(`🗑️ Deleted stale sub (${existingSub.subscriptionStatus}) in service`);
}
      const planPrice = PLAN_CONFIG[userType][plan].price;
      const featureSet = PLAN_CONFIG[userType][plan].features;
      const features = PLAN_FEATURES[featureSet];

      // ✅ Calculate dates
      const now = new Date();
      const planActivatedAt = now;
      const planExpiresAt = this._calculateExpiryDate(now, billingCycle);

      // ✅ Create subscription
      const subscription = await Subscription.create({
        userId,
        plan,
        subscriptionStatus: 'pending',
        planPrice,
        billingCycle,
        planActivatedAt,
        planExpiresAt,
        isAutoRenewEnabled: true,
        nextBillingDate: planExpiresAt,
        features,
        isTrialActive: false,
      });

      // ✅ Link to user
      user.subscriptionId = subscription._id;
      await user.save();

      // ✅ Update Client/Employee profile
      if (userType === 'client') {
      await Client.findOneAndUpdate(
  { userId },
  { subscription: subscription._id, isPremium: false }
);
      } else if (userType === 'employee') {


      // ✅ Should be
const employee = await Employee.findOneAndUpdate(
  { userId },
  { subscription: subscription._id },
  { new: true }
);
        // Sync badge
        if (employee) {
          await employee.syncBadge();
        }
      }

      console.log(`✅ Subscription created: ${subscription._id}`);
      return subscription;
    } catch (error) {
      console.error('❌ Error creating subscription:', error.message);
      throw error;
    }
  }

  // ───────────────────────────────────────────────────────────────
  // 2️⃣ CREATE RAZORPAY SUBSCRIPTION
  // ───────────────────────────────────────────────────────────────
async createRazorpaySubscription(userId, userType, plan, billingCycle = 'monthly') {
  try {
    const user = await User.findById(userId);
    if (!user) throw new Error('User not found');

    const planIdKey      = `RAZORPAY_PLAN_${userType.toUpperCase()}_${plan.toUpperCase()}`;
    const razorpayPlanId = process.env[planIdKey];

    if (!razorpayPlanId) {
      throw new Error(
        `Razorpay plan not configured: ${planIdKey}\n` +
        `Available plans: RAZORPAY_PLAN_CLIENT_PREMIUM, RAZORPAY_PLAN_EMPLOYEE_PREMIUM`
      );
    }

    // ✅ Only valid fields for Razorpay subscriptions API
    const razorpaySubscription = await razorpay.subscriptions.create({
      plan_id:         razorpayPlanId,
      customer_notify: 1,               // Razorpay sends payment link to customer
      quantity:        1,

      total_count: billingCycle === 'yearly' ? 12 : 1,

      notes: {
        userId:      userId.toString(), // ← critical — webhook reads this
        userType,
        plan,
        billingCycle,
      },
    });

    console.log(`✅ Razorpay subscription created: ${razorpaySubscription.id}`);
    return {
      razorpaySubscriptionId: razorpaySubscription.id,
      status:                 razorpaySubscription.status,
    };
  } catch (error) {
  console.error('❌ Razorpay subscription error:', error.message || JSON.stringify(error));
  throw new Error(error.message || JSON.stringify(error));
  }
}

  // ───────────────────────────────────────────────────────────────
  // 3️⃣ HANDLE WEBHOOK — subscription.authenticated
  // ───────────────────────────────────────────────────────────────

async handleSubscriptionAuthenticated(event) {
  try {
    const subscription = event.payload.subscription.entity;
    const { notes }    = subscription;
    const { userId, userType, plan } = notes;

    console.log(`🔔 [SUB.AUTHENTICATED] Razorpay SubID: ${subscription.id}`);

    let sub = await Subscription.findOne({ userId });

    if (!sub) {
      sub = await this.createSubscription(
        new mongoose.Types.ObjectId(userId),
        userType,
        plan,
        notes.billingCycle || 'monthly'
      );
    }

    // In handleSubscriptionAuthenticated — add before save ✅
sub.razorpaySubscriptionId = subscription.id;
if (sub.subscriptionStatus !== 'active') {
  sub.subscriptionStatus = 'authenticated';
  await sub.save();
}


    console.log(`✅ Subscription authenticated: ${sub._id}`);
    return sub;
  } catch (error) {
    console.error('❌ Webhook authenticated error:', error.message);
    throw error;
  }
}

  // ───────────────────────────────────────────────────────────────
  // 4️⃣ HANDLE WEBHOOK — subscription.activated
  // ───────────────────────────────────────────────────────────────
async handleSubscriptionActivated(event) {
  try {
    const subscription          = event.payload.subscription.entity;
    const { notes }             = subscription;
    const { userId, userType, plan } = notes;

    console.log(`🔔 [SUB.ACTIVATED] Razorpay SubID: ${subscription.id}`);

    const sub = await Subscription.findOne({ userId });
    if (!sub) throw new Error('Subscription not found');

    // ── Update all fields ────────────────────────────────
    sub.razorpaySubscriptionId = subscription.id;
    sub.subscriptionStatus     = 'active';
    sub.plan                   = plan;
    sub.features               = PLAN_FEATURES[
      PLAN_CONFIG[userType]?.[plan]?.features || 'premium'
    ];


    sub.planActivatedAt = new Date(subscription.current_start * 1000);
sub.planExpiresAt   = new Date(subscription.current_end   * 1000); // ← fix
sub.nextBillingDate = new Date(subscription.current_end   * 1000); // ← fix




    await sub.save();

    await this._syncUserProfile(userId);

    console.log(`✅ Subscription activated: ${sub._id}`);
    return sub;

  } catch (error) {
    console.error('❌ Webhook activated error:', error.message);
    throw error;
  }
}

  // ───────────────────────────────────────────────────────────────
  // 5️⃣ HANDLE WEBHOOK — subscription.charged
  // ───────────────────────────────────────────────────────────────

// ───────────────────────────────────────────────────────────────
// 5️⃣ HANDLE WEBHOOK — subscription.charged
// ───────────────────────────────────────────────────────────────
async handleSubscriptionCharged(event) {
  try {
    const subscription = event.payload.subscription.entity;
    const { notes }    = subscription;
    const { userId }   = notes;
    const payment      = event.payload.payment.entity;

    console.log(`🔔 [SUB.CHARGED] Payment: ${payment.id}`);

    const sub = await Subscription.findOne({ userId });
    if (!sub) throw new Error('Subscription not found');

    // ✅ Duplicate payment guard
    const alreadyRecorded = sub.paymentHistory.some(p => p.paymentId === payment.id);
    if (!alreadyRecorded) {
      sub.paymentHistory.push({
        paymentId: payment.id,
        amount:    payment.amount / 100,
        currency:  payment.currency,
        status:    'success',
        paidAt:    new Date(payment.created_at * 1000),
      });
    } else {
      console.log(`⚠️ Duplicate payment webhook ignored: ${payment.id}`);
    }

    sub.subscriptionStatus = 'active';
sub.planActivatedAt = new Date(subscription.current_start * 1000);
sub.planExpiresAt   = new Date(subscription.current_end   * 1000); // ← fix
sub.nextBillingDate = new Date(subscription.current_end   * 1000); // ← fix
    await sub.save();

    await this._syncUserProfile(userId);

    console.log(`✅ Payment recorded: ${payment.id}`);
    return sub;

  } catch (error) {
    console.error('❌ Webhook charged error:', error.message);
    throw error;
  }
}
  




async handleSubscriptionCancelled(event) {
  try {
    const subscription = event.payload.subscription.entity;
    const { notes }    = subscription;
    const { userId }   = notes;

    console.log(`🔔 [SUB.CANCELLED] Razorpay SubID: ${subscription.id}`);

    const sub = await Subscription.findOne({ userId });
    if (!sub) throw new Error('Subscription not found');

    // ✅ ADDED — idempotency check
    // Razorpay retries webhooks — don't process same cancellation twice
    if (sub.subscriptionStatus === 'cancelled') {
      console.log(`⚠️ Already cancelled — ignoring duplicate webhook: ${subscription.id}`);
      return sub;
    }

    sub.subscriptionStatus = 'cancelled';
    sub.cancelledAt        = new Date();
    sub.cancelledBy        = 'razorpay'; // ✅ FIXED — this comes from Razorpay, not user
    sub.isAutoRenewEnabled = false;
    sub.cancellationReason = `Cancelled via Razorpay — event: ${event.event}`; // ✅ ADDED
    await sub.save();

    await this._syncUserProfile(userId);

    console.log(`✅ Subscription cancelled: ${sub._id}`);
    return sub;

  } catch (error) {
    console.error('❌ Webhook cancelled error:', error.message);
    throw error;
  }
}


  // ───────────────────────────────────────────────────────────────
  // 7️⃣ HANDLE WEBHOOK — subscription.failed
  // ───────────────────────────────────────────────────────────────
  async handleSubscriptionFailed(event) {
    try {
      const subscription = event.payload.subscription.entity;
const { notes }    = subscription;

      const { userId } = notes;

      console.log(`🔔 [SUB.FAILED] Razorpay SubID: ${subscription.id}`);

      const sub = await Subscription.findOne({ userId });
      if (!sub) throw new Error('Subscription not found');

      // Add failed payment
      sub.paymentHistory.push({
        paymentId: subscription.id,
        amount: 0,
        status: 'failed',
        failureReason: 'Payment declined by bank',
        paidAt:        new Date(),
      });

      sub.subscriptionStatus = 'halted';
      await sub.save();

      // TODO: Send email to user
      console.log(`⚠️ Subscription payment failed: ${sub._id}`);
      return sub;
    } catch (error) {
      console.error('❌ Webhook failed error:', error.message);
      throw error;
    }
  }


  // ───────────────────────────────────────────────────────────────
  // 8️⃣ CANCEL SUBSCRIPTION
  // ───────────────────────────────────────────────────────────────
  async cancelSubscription(userId, cancellationReason = 'User initiated', cancelledBy = 'user') {
  try {
    const sub = await Subscription.findOne({ userId });
    if (!sub) throw new Error('Subscription not found');

    if (sub.subscriptionStatus === 'cancelled') {
      throw new Error('Subscription already cancelled');
    }

    // ✅ ADD — cancel on Razorpay side too
    if (sub.razorpaySubscriptionId) {
      try {
        await razorpay.subscriptions.cancel(
          sub.razorpaySubscriptionId,
          { cancel_at_cycle_end: 1 }  // cancels at end of billing cycle
        );
        console.log(`✅ Razorpay subscription cancelled: ${sub.razorpaySubscriptionId}`);
      } catch (rzpErr) {
        console.warn('⚠️ Razorpay cancel failed (continuing DB cancel):', rzpErr.message);
      }
    }

    sub.subscriptionStatus = 'cancelled';
    sub.cancelledAt        = new Date();
    sub.cancellationReason = cancellationReason;
    sub.cancelledBy        = cancelledBy;
    sub.isAutoRenewEnabled = false;
    await sub.save();

    await this._syncUserProfile(userId);

    console.log(`✅ Subscription cancelled by ${cancelledBy}: ${sub._id}`);
    return sub;
  } catch (error) {
    console.error('❌ Cancel subscription error:', error.message);
    throw error;
  }
}


  // ───────────────────────────────────────────────────────────────
  // 🔟 GET SUBSCRIPTION
  // ───────────────────────────────────────────────────────────────
  async getSubscription(userId) {
    try {
      const sub = await Subscription.findOne({ userId });
      if (!sub) return null;

      // ✅ Check if expired
     if (
  new Date() > new Date(sub.planExpiresAt) &&
  ['active', 'cancelled'].includes(sub.subscriptionStatus)
) {
        sub.subscriptionStatus = 'expired';
        await sub.save();
      }

      return sub;
    } catch (error) {
      console.error('❌ Get subscription error:', error.message);
      throw error;
    }
  }


  // ───────────────────────────────────────────────────────────────
  // 1️⃣3️⃣ HELPER — Sync user profile
  // ───────────────────────────────────────────────────────────────
  async _syncUserProfile(userId) {
    try {
      const user = await User.findById(userId);
      if (!user) return;

      const sub = await Subscription.findOne({ userId });

      if (user.userType === 'client') {
        await Client.findOneAndUpdate(
          { userId },
          {
            isPremium:
  sub &&
  sub.plan !== 'free' &&
  ['active', 'cancelled'].includes(sub.subscriptionStatus) &&
  new Date() < new Date(sub.planExpiresAt),
          }
        );
      } else if (user.userType === 'employee') {
        const employee = await Employee.findOne({ userId });
        if (employee) {
          await employee.syncBadge();
        }
      }
    } catch (error) {
      console.error('❌ Sync user profile error:', error.message);
    }
  }

  // ───────────────────────────────────────────────────────────────
  // 1️⃣4️⃣ HELPER — Calculate expiry date
  // ───────────────────────────────────────────────────────────────
  _calculateExpiryDate(startDate, billingCycle) {
    const date = new Date(startDate);

    if (billingCycle === 'monthly') {
      date.setMonth(date.getMonth() + 1);
    } else if (billingCycle === 'yearly') {
      date.setFullYear(date.getFullYear() + 1);
    } else if (billingCycle === 'lifetime') {
      date.setFullYear(date.getFullYear() + 100); // Far future
    }

    return date;
  }
}

export default new SubscriptionService();