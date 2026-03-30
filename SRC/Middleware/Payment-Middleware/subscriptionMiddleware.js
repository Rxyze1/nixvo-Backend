// Middlewares/subscriptionMiddleware.js

import Subscription from '../../Models/Subscription/Subscription.Model.js';
import { razorpay } from '../../Config/razorpay.js';

// ─────────────────────────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────────────────────────
const STALE_STATUSES       = ['pending', 'authenticated'];
const RZP_CHECK_COOLDOWN   = 5 * 60 * 1000; // 5 min — don't hammer Razorpay
const rzpCheckTimestamps   = new Map();      // userId → last checked at

// ─────────────────────────────────────────────────────────────
// HELPER — should we call Razorpay right now?
// ─────────────────────────────────────────────────────────────
const shouldCheckRazorpay = (userId, sub) => {
  if (!sub?.razorpaySubscriptionId)                          return false;
  if (!STALE_STATUSES.includes(sub.subscriptionStatus))      return false;

  const lastChecked = rzpCheckTimestamps.get(userId?.toString());
  if (lastChecked && Date.now() - lastChecked < RZP_CHECK_COOLDOWN) {
    console.log(`⏳ Razorpay cooldown active for ${userId} — skipping check`);
    return false;
  }

  return true;
};

// ─────────────────────────────────────────────────────────────
// HELPER — sync DB from Razorpay if mismatch found
// ─────────────────────────────────────────────────────────────
const syncFromRazorpay = async (sub, userId) => {
  try {
    rzpCheckTimestamps.set(userId.toString(), Date.now());

    const rzpSub = await razorpay.subscriptions.fetch(sub.razorpaySubscriptionId);

    console.log(`🔍 Razorpay status for ${userId}: ${rzpSub.status}`);

    // ── Active on Razorpay but not in DB → sync up ──
    if (rzpSub.status === 'active' && sub.subscriptionStatus !== 'active') {
      console.log('⚠️  Webhook missed — syncing active from Razorpay');

      await Subscription.findByIdAndUpdate(sub._id, {
        subscriptionStatus: 'active',
        planActivatedAt:    new Date(rzpSub.start_at  * 1000),
        planExpiresAt:      new Date(rzpSub.end_at    * 1000),
        nextBillingDate:    new Date(rzpSub.end_at    * 1000),
        razorpaySubscriptionId: rzpSub.id,
      });

      // Return updated fields so req.isPremium is correct this request
      return {
        subscriptionStatus: 'active',
        planExpiresAt:      new Date(rzpSub.end_at * 1000),
        synced:             true,
      };
    }

    // ── Cancelled / expired on Razorpay but active in DB → sync down ──
    if (
      ['cancelled', 'expired', 'completed'].includes(rzpSub.status) &&
      sub.subscriptionStatus === 'active'
    ) {
      console.log(`⚠️  Razorpay ${rzpSub.status} — downgrading DB`);

      await Subscription.findByIdAndUpdate(sub._id, {
        subscriptionStatus: rzpSub.status,
      });

      return { subscriptionStatus: rzpSub.status, synced: true };
    }

    return { synced: false };

  } catch (err) {
    console.warn('⚠️  Razorpay sync failed (non-critical):', err.message);
    return { synced: false, error: err.message };
  }
};

// ─────────────────────────────────────────────────────────────
// 1️⃣ ATTACH SUBSCRIPTION — use on all authenticated routes
// Attaches req.subscription + req.isPremium
// Never blocks — always calls next()
// ─────────────────────────────────────────────────────────────
export const attachSubscription = async (req, res, next) => {
  try {
    const userId = req.userId;

    if (!userId) {
      req.subscription = null;
      req.isPremium    = false;
      return next();
    }

    let sub = await Subscription.findOne({ userId }).lean();

    if (!sub) {
      req.subscription = null;
      req.isPremium    = false;
      return next();
    }

    // ── Auto-expire check ────────────────────────────────────
    if (
      sub.subscriptionStatus === 'active' &&
      sub.planExpiresAt &&
      new Date() > new Date(sub.planExpiresAt)
    ) {
      console.log(`⏰ Subscription expired for ${userId} — auto-expiring`);
      await Subscription.findByIdAndUpdate(sub._id, {
        subscriptionStatus: 'expired'
      });
      sub.subscriptionStatus = 'expired';
    }

    // ── Razorpay cross-check (stale statuses only, with cooldown) ──
    if (shouldCheckRazorpay(userId, sub)) {
      const sync = await syncFromRazorpay(sub, userId);
      if (sync.synced) {
        // Merge synced fields into local sub object
        sub = { ...sub, ...sync };
      }
    }

    // ── Attach to request ────────────────────────────────────
   // TO ✅
const isPremium = (
  sub.plan !== 'free' &&
  ['active', 'cancelled'].includes(sub.subscriptionStatus) &&
  new Date() < new Date(sub.planExpiresAt)
);

    req.subscription = {
      ...sub,
      isPremium,
      daysRemaining: isPremium
        ? Math.ceil((new Date(sub.planExpiresAt) - new Date()) / (1000 * 60 * 60 * 24))
        : 0,
    };

    req.isPremium = isPremium;

    console.log(`📋 Subscription attached: ${userId} | ${sub.plan} | ${sub.subscriptionStatus} | premium=${isPremium}`);

    next();

  } catch (error) {
    console.error('❌ attachSubscription error:', error.message);
    // Never block a request because of subscription enrichment failure
    req.subscription = null;
    req.isPremium    = false;
    next();
  }
};

// ─────────────────────────────────────────────────────────────
// 2️⃣ REQUIRE PREMIUM — use on premium-only routes
// ─────────────────────────────────────────────────────────────
export const requirePremium = (req, res, next) => {
  if (req.isPremium) return next();

  const status = req.subscription?.subscriptionStatus;

  const reason =
    status === 'pending'       ? 'Payment not completed — please complete your payment'      :
    status === 'authenticated' ? 'Payment pending — please complete your payment'            :
    status === 'halted'        ? 'Payment failed — please update your payment method'        :
    status === 'cancelled'     ? 'Subscription cancelled — renew to access premium features' :
    status === 'expired'       ? 'Subscription expired — renew to continue'                  :
                                 'Premium subscription required';

  return res.status(403).json({
    success:  false,
    code:     'PREMIUM_REQUIRED',
    message:  `❌ ${reason}`,
    data: {
      currentPlan:   req.subscription?.plan   || 'free',
      currentStatus: status                   || 'none',
      upgradeUrl:    '/api/v1/subscription/initiate',
    },
  });
};

// ─────────────────────────────────────────────────────────────
// 3️⃣ REQUIRE FEATURE — granular feature-level gating
// Usage: requireFeature('apiAccess')
// ─────────────────────────────────────────────────────────────
export const requireFeature = (featureName) => (req, res, next) => {
  if (!req.isPremium) {
    return res.status(403).json({
      success: false,
      code:    'PREMIUM_REQUIRED',
      message: `❌ ${featureName} requires a premium subscription`,
      data:    { upgradeUrl: '/api/v1/subscription/initiate' },
    });
  }

  const hasFeature = req.subscription?.features?.[featureName];

  if (!hasFeature) {
    return res.status(403).json({
      success: false,
      code:    'FEATURE_NOT_AVAILABLE',
      message: `❌ ${featureName} is not available on your current plan`,
      data:    { upgradeUrl: '/api/v1/subscription/initiate' },
    });
  }

  next();
};