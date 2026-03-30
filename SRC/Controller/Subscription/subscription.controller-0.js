// Controllers/Subscription/subscription.controller.js

import SubscriptionService from '../../Service/Subscription/subscription.service.js';
import User                from '../../Models/USER-Auth/User-Auth.-Model.js';
import Subscription        from '../../Models/Subscription/Subscription.Model.js';
import { RAZORPAY_EVENTS,IS_LIVE } from '../../Config/razorpay.js';  // ✅ added
// Add after the RAZORPAY_EVENTS import:
import { handleCertificateWebhook } from '../../Service/Certificate/CertificateWebhookHandler.js';
import {
  sendSubscriptionActivated,
  sendSubscriptionRenewed,
  sendSubscriptionCancelled,
  sendSubscriptionPaymentFailed,
} from '../../Email/emailService.js';  // ✅ fixed casing Services not services




// ─────────────────────────────────────────────────────────────
// 1️⃣ INITIATE SUBSCRIPTION
// ─────────────────────────────────────────────────────────────
export const initiateSubscription = async (req, res) => {
  try {
    const userId   = req.userId;
    const userType = req.userType;
    const { plan, billingCycle = 'monthly' } = req.body;

    if (!plan)
      return res.status(400).json({ success: false, message: '❌ Plan is required' });

    if (!['premium'].includes(plan))
      return res.status(400).json({ success: false, message: '❌ Invalid plan. Valid plans: premium' });

    if (!['monthly', 'yearly'].includes(billingCycle))
      return res.status(400).json({ success: false, message: '❌ Invalid billing cycle. Valid: monthly, yearly' });

   const existingSub = await Subscription.findOne({ userId });

if (existingSub) {


if (existingSub.subscriptionStatus === 'active') {
  return res.status(400).json({
    success: false,
    code:    'ALREADY_SUBSCRIBED',
    message: '❌ You already have an active subscription',
    data: {
      plan:         existingSub.plan,
      status:       existingSub.subscriptionStatus,
      expiresAt:    existingSub.planExpiresAt,
      daysRemaining: Math.ceil(
        (new Date(existingSub.planExpiresAt) - new Date()) / (1000 * 60 * 60 * 24)
      ),
      next: {
        action:  'manage',
        message: 'You can cancel your subscription from settings',
      },
    },
  });
}
  // TO ✅ — return the payment URL so they can actually pay
if (existingSub.subscriptionStatus === 'authenticated') {

  // Re-fetch payment URL from Razorpay
  let paymentUrl = null;
  if (existingSub.razorpaySubscriptionId) {
    paymentUrl = `https://rzp.io/i/${existingSub.razorpaySubscriptionId}`;
  }

  return res.status(200).json({
    success: false,
    code:    'PAYMENT_PENDING',
    message: '⏳ Payment not completed — please complete your payment',
    data: {
      plan:           existingSub.plan,
      status:         existingSub.subscriptionStatus,
      subscriptionId: existingSub._id,

      // ── Give frontend everything to re-open payment ──
      payment: paymentUrl ? {
        paymentUrl,
        razorpaySubscriptionId: existingSub.razorpaySubscriptionId,
        razorpayKey: IS_LIVE
          ? process.env.RAZORPAY_KEY_ID
          : process.env.RAZORPAY_TEST_KEY_ID,
        method:  'razorpay',
        mode:    IS_LIVE ? 'live' : 'test',
      } : null,

      next: {
        action:      paymentUrl ? 'open_payment' : 'contact_support',
        redirectUrl: paymentUrl,
        message:     paymentUrl
          ? 'Click below to complete your payment'
          : 'Contact support if payment issue persists',
      },
    },
  });
}

  // TO ✅
  // ── Cancelled but still has paid access ──────────────────
  if (existingSub.subscriptionStatus === 'cancelled') {
    const stillHasAccess = new Date() < new Date(existingSub.planExpiresAt);
    if (stillHasAccess) {
      return res.status(400).json({
        success: false,
        code:    'CANCELLED_BUT_ACTIVE',
        message: '⚠️ You cancelled but still have premium access until your billing period ends',
        data: {
          plan:          existingSub.plan,
          status:        existingSub.subscriptionStatus,
          accessUntil:   existingSub.planExpiresAt,
          daysRemaining: Math.ceil(
            (new Date(existingSub.planExpiresAt) - new Date()) / (1000 * 60 * 60 * 24)
          ),
          next: {
            action:  'wait',
            message: 'You can re-subscribe after your current period ends',
          },
        },
      });
    }
  }

  // ── Pending / halted / expired / cancelled (no remaining access) — delete and retry
  await Subscription.deleteOne({ userId });
  console.log(`🗑️ Deleted stale subscription (${existingSub.subscriptionStatus}) — allowing retry`);




  
}

    const razorpayData = await SubscriptionService.createRazorpaySubscription(
      userId, userType, plan, billingCycle
    );

    const subscription = await SubscriptionService.createSubscription(
      userId, userType, plan, billingCycle
    );

    const razorpayKey = IS_LIVE
      ? process.env.RAZORPAY_KEY_ID
      : process.env.RAZORPAY_TEST_KEY_ID;

    // ✅ Short payment URL — user can open directly in browser/webview
    const paymentUrl = `https://rzp.io/i/${razorpayData.razorpaySubscriptionId}`;

    console.log(`✅ Subscription initiated for user ${userId}`);

    return res.status(201).json({
      success: true,
      message: '✅ Subscription initiated — complete payment on Razorpay',
      data: {

        // ── Subscription Info ──────────────────────────────
        subscriptionId: subscription._id,
        plan,
        billingCycle,
        status:         subscription.subscriptionStatus,
        price:          subscription.planPrice,
        currency:       'INR',
        createdAt:      subscription.createdAt,

        // ── Payment — Frontend uses this ───────────────────
        payment: {
          razorpaySubscriptionId: razorpayData.razorpaySubscriptionId,
          razorpayKey,                   // ← for Razorpay checkout SDK
          paymentUrl,                    // ← open in WebView or browser directly
          method:    'razorpay',
          mode:      IS_LIVE ? 'live' : 'test',
        },

        // ── What to do next — Frontend action guide ────────
        next: {
          action:      'open_payment',   // ← frontend reads this
          redirectUrl: paymentUrl,       // ← open this URL
          message:     'Complete your payment to activate premium',
          expiresIn:   '30 minutes',     // ← Razorpay subscription link validity
        },

      },
    });

  } catch (error) {
    console.error('❌ initiateSubscription error:', error.message);
    return res.status(500).json({
      success: false,
      message: error.message || 'Failed to initiate subscription'
    });
  }
};
// ─────────────────────────────────────────────────────────────
// 2️⃣ GET MY SUBSCRIPTION
// ─────────────────────────────────────────────────────────────
export const getMySubscription = async (req, res) => {
  try {
    const userId = req.userId;
    const sub    = await SubscriptionService.getSubscription(userId);

    if (!sub) {
      return res.status(200).json({
        success: true,
        message: 'No active subscription',
        data: {
          plan:      'free',
          status:    'none',
          isPremium: false,
        },
      });
    }

    // TO ✅
const isPremium =
  sub.plan !== 'free' &&
  ['active', 'cancelled'].includes(sub.subscriptionStatus) &&
  new Date() < new Date(sub.planExpiresAt);

    const daysRemaining = isPremium
      ? Math.ceil((new Date(sub.planExpiresAt) - new Date()) / (1000 * 60 * 60 * 24))
      : 0;

    const isPaymentPending = ['pending', 'authenticated'].includes(sub.subscriptionStatus);
    const paymentUrl       = isPaymentPending && sub.razorpaySubscriptionId
      ? `https://rzp.io/i/${sub.razorpaySubscriptionId}`
      : null;

    return res.status(200).json({
      success: true,
      data: {
        _id:                sub._id,
        plan:               sub.plan,
        status:             sub.subscriptionStatus,
        isPremium,
        billingCycle:       sub.billingCycle,
        planPrice:          sub.planPrice,
        currency:           'INR',
        planActivatedAt:    sub.planActivatedAt,
        planExpiresAt:      sub.planExpiresAt,
        nextBillingDate:    sub.nextBillingDate,
        daysRemaining,
        isAutoRenewEnabled: sub.isAutoRenewEnabled,
        features:           isPremium ? sub.features : null,

        // ✅ Tell frontend exactly what the current status means
        statusLabel:
          sub.subscriptionStatus === 'active'        ? 'Active'           :
          sub.subscriptionStatus === 'authenticated' ? 'Payment Pending'  :
          sub.subscriptionStatus === 'pending'       ? 'Awaiting Payment' :
          sub.subscriptionStatus === 'halted'        ? 'Payment Failed'   :
          sub.subscriptionStatus === 'cancelled'     ? 'Cancelled'        :
          sub.subscriptionStatus === 'expired'       ? 'Expired'          :
          'Inactive',

        // ✅ Payment URL — only present when action is needed
        ...(isPaymentPending && {
          payment: {
            paymentUrl,
            razorpaySubscriptionId: sub.razorpaySubscriptionId,
            razorpayKey: IS_LIVE
              ? process.env.RAZORPAY_KEY_ID
              : process.env.RAZORPAY_TEST_KEY_ID,
            method: 'razorpay',
            mode:   IS_LIVE ? 'live' : 'test',
          },
          next: {
            action:      paymentUrl ? 'open_payment'     : 'contact_support',
            redirectUrl: paymentUrl || null,
            message:     paymentUrl
              ? 'Complete your payment to activate premium'
              : 'Contact support to resolve your payment issue',
          },
        }),

        // ✅ Renewal prompt — only when expiring soon (within 7 days)
        ...(isPremium && daysRemaining <= 7 && {
          renewalAlert: {
            message:     `Your subscription expires in ${daysRemaining} day${daysRemaining === 1 ? '' : 's'}`,
            expiresAt:   sub.planExpiresAt,
            action:      'renew',
          },
        }),
      },
    });

  } catch (error) {
    console.error('❌ getMySubscription error:', error.message);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch subscription'
    });
  }
};
// ─────────────────────────────────────────────────────────────
// 3️⃣ CANCEL SUBSCRIPTION
// ─────────────────────────────────────────────────────────────
export const cancelSubscription = async (req, res) => {
  try {
    const userId = req.userId;
    const { reason = 'User initiated cancellation' } = req.body;

    const sub  = await SubscriptionService.cancelSubscription(userId, reason, 'user');
    const user = await User.findById(userId);

    if (user) {
      try {
        await sendSubscriptionCancelled(
          user.email, user.fullname, sub.plan, sub.planExpiresAt, reason
        );
      } catch (emailErr) {
        console.warn('⚠️ Cancellation email failed:', emailErr.message);
      }
    }

    return res.status(200).json({
      success: true,
      message: '✅ Subscription cancelled successfully',
      data: {
        plan:        sub.plan,
        status:      sub.subscriptionStatus,
        cancelledAt: sub.cancelledAt,
        accessUntil: sub.planExpiresAt,
      },
    });
  } catch (error) {
    console.error('❌ cancelSubscription error:', error.message);
    return res.status(400).json({ success: false, message: error.message || 'Failed to cancel subscription' });
  }
};

// ─────────────────────────────────────────────────────────────
// 4️⃣ WEBHOOK HANDLER
// ─────────────────────────────────────────────────────────────
export const handleWebhook = async (req, res) => {
  const event = req.body;

  console.log(`\n🔔 WEBHOOK: ${event.event}`);

  // ✅ Respond immediately — Razorpay needs 200 within 5 seconds
  res.status(200).json({ success: true, received: true });

  try {
    switch (event.event) {

      case RAZORPAY_EVENTS.SUB_AUTHENTICATED: {  // ✅ constant
        await SubscriptionService.handleSubscriptionAuthenticated(event);
        console.log('✅ Handled: subscription.authenticated');
        break;
      }

      case RAZORPAY_EVENTS.SUB_ACTIVATED: {  // ✅ constant
        const sub = await SubscriptionService.handleSubscriptionActivated(event);
        try {
          const subscription   = event.payload.subscription.entity;
          const { userId }     = subscription.notes;
          const user           = await User.findById(userId);
          if (user && sub) {
            await sendSubscriptionActivated(
              user.email, user.fullname, sub.plan, sub.planPrice,
              sub.planActivatedAt, sub.planExpiresAt, sub.features,
              `INV-${sub._id.toString().slice(-8).toUpperCase()}`,
              subscription.id
            );
          }
        } catch (emailErr) {
          console.warn('⚠️ Activation email failed:', emailErr.message);
        }
        console.log('✅ Handled: subscription.activated — user is now PREMIUM');
        break;
      }

      case RAZORPAY_EVENTS.SUB_CHARGED: {  // ✅ constant
        const sub = await SubscriptionService.handleSubscriptionCharged(event);
        try {
          const subscription = event.payload.subscription.entity;
          const payment      = event.payload.payment.entity;
          const { userId }   = subscription.notes;
          const user         = await User.findById(userId);
          if (user && sub) {
            await sendSubscriptionRenewed(
              user.email, user.fullname, sub.plan, sub.planPrice,
              sub.planExpiresAt,
              `INV-${sub._id.toString().slice(-8).toUpperCase()}`,
              payment.id
            );
          }
        } catch (emailErr) {
          console.warn('⚠️ Renewal email failed:', emailErr.message);
        }
        console.log('✅ Handled: subscription.charged — renewed');
        break;
      }

      case RAZORPAY_EVENTS.SUB_CANCELLED:  // ✅ constant
      case RAZORPAY_EVENTS.SUB_COMPLETED: {  // ✅ constant
        const sub = await SubscriptionService.handleSubscriptionCancelled(event);
        try {
          const subscription = event.payload.subscription.entity;
          const { userId }   = subscription.notes;
          const user         = await User.findById(userId);
          if (user && sub) {
            await sendSubscriptionCancelled(
              user.email, user.fullname, sub.plan,
              sub.planExpiresAt, 'Cancelled via Razorpay'
            );
          }
        } catch (emailErr) {
          console.warn('⚠️ Cancellation email failed:', emailErr.message);
        }
        console.log('✅ Handled: subscription.cancelled');
        break;
      }

      case RAZORPAY_EVENTS.SUB_HALTED: {  // ✅ constant
        const sub = await SubscriptionService.handleSubscriptionFailed(event);
        try {
          const subscription = event.payload.subscription.entity;
          const { userId }   = subscription.notes;
          const user         = await User.findById(userId);
          if (user && sub) {
            await sendSubscriptionPaymentFailed(
              user.email, user.fullname, sub.plan, sub.planPrice,
              sub.planExpiresAt, 'Payment declined by bank', null
            );
          }
        } catch (emailErr) {
          console.warn('⚠️ Payment failed email failed:', emailErr.message);
        }
        console.log('✅ Handled: subscription.halted');
        break;
      }

       // ── Certificate one-time payments ─────────────────────
      case RAZORPAY_EVENTS.ORDER_PAID:
      case RAZORPAY_EVENTS.PAYMENT_CAPTURED: {
        const handled = await handleCertificateWebhook(event.event, event.payload);
        if (handled) console.log('✅ Handled: certificate payment');
        else console.log('ℹ️ order.paid — not a certificate payment');
        break;
      }

      default:
        console.log(`ℹ️ Unhandled webhook event: ${event.event}`);
    }

  } catch (error) {
    console.error(`❌ Webhook processing error [${event.event}]:`, error.message);
  }
};

// ─────────────────────────────────────────────────────────────
// 5️⃣ GET PLANS — public
// ─────────────────────────────────────────────────────────────
export const getPlans = async (req, res) => {
  return res.status(200).json({
    success: true,
    data: {
      client:   { free: { price: 0, label: 'Free' }, premium: { price: 49,  label: 'Premium' } },
      employee: { free: { price: 0, label: 'Free' }, premium: { price: 149, label: 'Premium' } },
    },
  });
};