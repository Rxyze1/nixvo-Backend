// ─────────────────────────────────────────────────────────────
// ADD THIS TO YOUR EXISTING WEBHOOK CONTROLLER
//
// Your existing webhook controller already handles subscription
// events. Certificate payments are order.paid events with
// notes.type === 'certificate_basic' or 'certificate_pro'.
//
// Just import this handler and call it from the existing
// order.paid / payment.captured case in your webhook switch.
// ─────────────────────────────────────────────────────────────
//
// Service/Certificate/CertificateWebhookHandler.js

import { handleCertificatePaymentSuccess } from './CertificateService.js';
import { PAYMENT_TYPES }                   from '../../Config/razorpay.js';

// ═══════════════════════════════════════════════════════════════
// CERTIFICATE PAYMENT WEBHOOK HANDLER
//
// Called from your main webhook controller when:
//   event === 'order.paid' AND notes.type starts with 'certificate'
// ═══════════════════════════════════════════════════════════════

export const handleCertificateWebhook = async (event, payload) => {

  const CERT_TYPES = [PAYMENT_TYPES.CERTIFICATE_BASIC, PAYMENT_TYPES.CERTIFICATE_PRO];

  // ── Only handle certificate payments ─────────────────────
  const notes = payload?.order?.entity?.notes || payload?.payment?.entity?.notes || {};

  if (!CERT_TYPES.includes(notes.type)) return false;   // not ours — let caller handle

  const { certificateId, userId } = notes;

  if (!certificateId) {
    console.error('⚠️  [CERT WEBHOOK] notes.certificateId missing — cannot issue');
    return false;
  }

  console.log(`\n🎓 [CERT WEBHOOK] ${event} → ${certificateId}`);

  // ── order.paid ────────────────────────────────────────────
  if (event === 'order.paid') {
    const order   = payload.order?.entity;
    const payment = payload.payment?.entity;

    await handleCertificatePaymentSuccess({
      certificateId,
      razorpayOrderId:   order?.id,
      razorpayPaymentId: payment?.id,
    });

    console.log(`✅ [CERT WEBHOOK] Issued: ${certificateId}`);
    return true;
  }

  // ── payment.captured (fallback — fires before order.paid sometimes) ──
  if (event === 'payment.captured') {
    const payment = payload.payment?.entity;

    await handleCertificatePaymentSuccess({
      certificateId,
      razorpayOrderId:   payment?.order_id,
      razorpayPaymentId: payment?.id,
    });

    console.log(`✅ [CERT WEBHOOK] Issued via payment.captured: ${certificateId}`);
    return true;
  }

  return false;
};


// ═══════════════════════════════════════════════════════════════
// HOW TO WIRE INTO YOUR EXISTING WEBHOOK CONTROLLER
// ─────────────────────────────────────────────────────────────
// In your existing webhook controller file, add:
//
//   import { handleCertificateWebhook } from '../Service/Certificate/CertificateWebhookHandler.js';
//
// Then inside your switch/if-else on `event`:
//
//   case RAZORPAY_EVENTS.ORDER_PAID:
//   case RAZORPAY_EVENTS.PAYMENT_CAPTURED: {
//
//     // ── Try certificate first ─────────────────────────────
//     const handled = await handleCertificateWebhook(event, payload);
//     if (handled) break;
//
//     // ── Otherwise fall through to subscription logic ──────
//     await handleSubscriptionPayment(event, payload);
//     break;
//   }
//
// That's it. One import, one line. No new webhook URL needed.
// ═══════════════════════════════════════════════════════════════