// Middlewares/webhookMiddleware.js
import crypto from 'crypto';

// ─────────────────────────────────────────────────────────────
// REPLAY ATTACK PROTECTION
// Razorpay sends a timestamp — reject if older than 5 minutes
// ─────────────────────────────────────────────────────────────
const MAX_WEBHOOK_AGE_MS = 5 * 60 * 1000; // 5 minutes

export const verifyRazorpayWebhook = (req, res, next) => {
  try {

    // ── Empty test ping from Razorpay dashboard ──────────────
    if (!req.rawBody || req.rawBody === '{}' || req.rawBody === '') {
      console.log('✅ Webhook test ping received');
      return res.status(200).json({ success: true });
    }

    // ── Signature must exist ─────────────────────────────────
    const razorpaySignature = req.headers['x-razorpay-signature'];

    if (!razorpaySignature) {
      console.warn('⚠️ Missing x-razorpay-signature header');
      return res.status(400).json({
        success: false,
        message: '❌ Missing webhook signature'
      });
    }

    // ── Webhook secret must be configured ───────────────────
    if (!process.env.RAZORPAY_WEBHOOK_SECRET) {
      console.error('❌ RAZORPAY_WEBHOOK_SECRET not set in .env');
      return res.status(500).json({
        success: false,
        message: 'Webhook secret not configured'
      });
    }

    // ── Signature verification ───────────────────────────────
    const expectedSignature = crypto
      .createHmac('sha256', process.env.RAZORPAY_WEBHOOK_SECRET)
      .update(req.rawBody)
      .digest('hex');

    // ✅ Use timingSafeEqual — prevents timing attacks
    const signaturesMatch = crypto.timingSafeEqual(
      Buffer.from(expectedSignature,   'hex'),
      Buffer.from(razorpaySignature,   'hex')
    );

    if (!signaturesMatch) {
      console.warn('⚠️ Invalid Razorpay webhook signature');
      console.warn(`   Expected: ${expectedSignature.substring(0, 20)}...`);
      console.warn(`   Received: ${razorpaySignature.substring(0, 20)}...`);
      return res.status(400).json({
        success: false,
        message: '❌ Invalid webhook signature'
      });
    }

    // ── Replay attack protection ─────────────────────────────
    try {
      const body = JSON.parse(req.rawBody);
      if (body.created_at) {
        const webhookAge = Date.now() - body.created_at * 1000;
        if (webhookAge > MAX_WEBHOOK_AGE_MS) {
          console.warn(`⚠️ Webhook too old: ${Math.round(webhookAge / 1000)}s — possible replay attack`);
          return res.status(400).json({
            success: false,
            message: '❌ Webhook timestamp too old'
          });
        }
      }
    } catch (parseErr) {
      // Body parse failed — still continue, signature already verified
      console.warn('⚠️ Could not parse webhook body for timestamp check');
    }

    console.log('✅ Razorpay webhook verified');
    next();

  } catch (error) {
    // ── timingSafeEqual throws if buffers are different lengths ──
    if (error.message?.includes('must be the same length')) {
      console.warn('⚠️ Signature length mismatch — invalid signature');
      return res.status(400).json({
        success: false,
        message: '❌ Invalid webhook signature'
      });
    }

    console.error('❌ Webhook verification error:', error.message);
    return res.status(500).json({
      success: false,
      message: 'Webhook verification failed'
    });
  }
};