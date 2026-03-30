// Controllers/Certificate/CertificateController.js
import crypto          from 'crypto';
import Certificate     from '../../Models/Certificate/Certificate.Model.js';
import CertificateQuestion from '../../Models/Certificate/CertificateQuestion.Model.js';
import Subscription    from '../../Models/Subscription/Subscription.Model.js';
import { razorpay, PAYMENT_TYPES, KEY_SECRET } from '../../Config/razorpay.js';
import { SKILL_SLUGS } from '../../Models/Certificate/CertificateQuestion.Model.js';
import {
  createAndIssueCertificate,
  createDraftCertificate,
  handleCertificatePaymentSuccess,
  issueCertificate,
} from '../../Service/Certificate/CertificateService.js';


// ═══════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════

const ok  = (res, data, status = 200)  => res.status(status).json({ success: true,  ...data });
const err = (res, message, status = 400) => res.status(status).json({ success: false, message });

// ═══════════════════════════════════════════════════════════════
// 1. GET QUESTIONS
// GET /api/certificates/questions?skill=Video Editing&tier=pro
//
// Public — no auth required (frontend needs this before login too)
// Returns ordered questions for a skill + tier combination
// ═══════════════════════════════════════════════════════════════

export const getQuestions = async (req, res) => {
  try {
   // ✅ REPLACE with these two lines:
const { skill: rawSkill, tier = 'basic' } = req.query;
const skill = SKILL_SLUGS[rawSkill] || rawSkill;

    if (!skill) return err(res, 'skill query param is required');

    const validTiers = ['basic', 'pro', 'both'];
    if (!validTiers.includes(tier)) return err(res, `tier must be one of: ${validTiers.join(', ')}`);

    const questions = await CertificateQuestion.getBySkill(skill, tier);

    if (!questions.length)
      return err(res, `No active questions found for skill: ${skill}`, 404);

    return ok(res, {
      skill,
      tier,
      count: questions.length,
      questions: questions.map(q => ({
        _id:         q._id,
        question:    q.question,
        category:    q.category,
        placeholder: q.placeholder,
        required:    q.required,
        minLength:   q.minLength,
        maxLength:   q.maxLength,
        difficulty:  q.difficulty,
        order:       q.order,
      })),
    });

  } catch (e) {
    console.error('getQuestions error:', e.message);
    return err(res, 'Failed to fetch questions', 500);
  }
};




export const applyCertificate = async (req, res) => {
  try {
    const { tier = 'basic', skill, assessment, proofImages = [], proofVideos = [] } = req.body;

    if (!skill)      return err(res, 'skill is required');
    if (!assessment) return err(res, 'assessment answers are required');

    const validTiers = ['basic', 'pro'];
    if (!validTiers.includes(tier)) return err(res, 'tier must be basic or pro');

    await CertificateQuestion.validateAnswers(skill, tier, assessment);

    const userId     = req.user._id;
    const employeeId = req.employee._id;
    const employee   = req.employee;

    const metadata = {
      employeeName:     employee.name            || req.user.name     || '',
      employeeUsername: employee.username        || req.user.username || '',
      profilePic:       employee.profilePic      || req.user.profilePic || null,
      bio:              employee.bio             || '',
      skills:           employee.skills          || [],
      yearsExperience:  employee.yearsExperience || 0,
    };

    const assessmentData = { answers: assessment, submittedAt: new Date() };

    // ✅ REPLACE:
const sub = await Subscription.findOne({
  userId:             req.user._id,
  subscriptionStatus: 'active',
  plan:               'premium',
}).lean();

const isPremium = sub !== null && new Date() < new Date(sub.planExpiresAt);

    if (isPremium) {
      const result = await createAndIssueCertificate({
        userId, employeeId, tier, skill, metadata,
        assessment: assessmentData, proofImages, proofVideos,
      });

      return ok(res, {
        message:         'Certificate issued successfully.',
        flow:            'premium',
        certificateId:   result.certificateId,
        verificationUrl: result.verificationUrl,
        qrCodeUrl:       result.qrCodeUrl,
        pdfUrl:          result.pdfUrl,
         verifyPngUrl:    result.verifyPngUrl,
      }, 201);

    } else {
      const cert = await createDraftCertificate({
        userId, employeeId, tier, skill, metadata,
        assessment: assessmentData, proofImages, proofVideos,
      });

      const order = await razorpay.orders.create({
        amount:   cert.payment.amount * 100,
        currency: 'INR',
        receipt:  cert.certificateId,
        notes: {
          type:          tier === 'pro' ? PAYMENT_TYPES.CERTIFICATE_PRO : PAYMENT_TYPES.CERTIFICATE_BASIC,
          certificateId: cert.certificateId,
          userId:        userId.toString(),
          tier,
          skill,
        },
      });

      cert.payment.razorpayOrderId = order.id;
      cert.status = 'payment_pending';
      await cert.save();

      return ok(res, {
        message: 'Draft created. Complete payment to issue certificate.',
        flow:    'payment',
        certificate: {
          certificateId: cert.certificateId,
          tier:          cert.tier,
          skill:         cert.skill,
          status:        cert.status,
          amount:        cert.payment.amount,
        },
        razorpayOrder: {
          id:       order.id,
          amount:   order.amount,
          currency: order.currency,
          key:      process.env.RAZORPAY_LIVE_MODE === 'true'
                      ? process.env.RAZORPAY_KEY_ID
                      : process.env.RAZORPAY_TEST_KEY_ID,
        },
      }, 201);
    }

  } catch (e) {
    console.error('applyCertificate error:', e.message);
    if (e.message.includes('required') || e.message.includes('invalid') ||
        e.message.includes('short')    || e.message.includes('long')) {
      return err(res, e.message, 422);
    }
    return err(res, 'Failed to apply for certificate', 500);
  }
};


// ═══════════════════════════════════════════════════════════════
// 4. RAZORPAY PAYMENT SUCCESS WEBHOOK
// POST /api/certificates/payment/verify
//
// Called by Razorpay webhook OR frontend after payment success
// Body: { certificateId, razorpayOrderId, razorpayPaymentId, razorpaySignature }
// ═══════════════════════════════════════════════════════════════

export const verifyCertificatePayment = async (req, res) => {
  try {
    const { certificateId, razorpayOrderId, razorpayPaymentId, razorpaySignature } = req.body;

    if (!certificateId || !razorpayOrderId || !razorpayPaymentId || !razorpaySignature) {
      return err(res, 'certificateId, razorpayOrderId, razorpayPaymentId, and razorpaySignature are all required');
    }

    // ── Verify Razorpay signature ─────────────────────────────
  
    const body = razorpayOrderId + '|' + razorpayPaymentId;
const expectedSignature = crypto
  .createHmac('sha256', KEY_SECRET)
  .update(body)
  .digest('hex');
    if (expectedSignature !== razorpaySignature) {
      return err(res, 'Invalid payment signature. Possible tamper attempt.', 400);
    }

    // ── Issue the certificate ─────────────────────────────────
    const result = await handleCertificatePaymentSuccess({
      certificateId,
      razorpayOrderId,
      razorpayPaymentId,
    });

    if (result.alreadyIssued) {
      const cert = await Certificate.findOne({ certificateId }).lean();
      return ok(res, {
        message:         'Certificate already issued.',
        certificateId:   cert.certificateId,
        verificationUrl: cert.verificationUrl,
        qrCodeUrl:       cert.qrCodeUrl,
        pdfUrl:          cert.pdfUrl,
      });
    }

    return ok(res, {
      message:         'Payment verified. Certificate issued successfully.',
      certificateId:   result.certificateId,
      verificationUrl: result.verificationUrl,
      qrCodeUrl:       result.qrCodeUrl,
      pdfUrl:          result.pdfUrl,
    });

  } catch (e) {
    console.error('verifyCertificatePayment error:', e.message);
    return err(res, e.message || 'Payment verification failed', 500);
  }
};

// ═══════════════════════════════════════════════════════════════
// 5. PUBLIC VERIFY (QR Scan / Serial Entry)
// GET /api/certificates/verify/:certificateId
//
// Fully public — no auth
// Used by QR scan and the verify page on editcraft.co.in
// ═══════════════════════════════════════════════════════════════

export const publicVerify = async (req, res) => {
  try {
    const { certificateId } = req.params;

    if (!certificateId) return err(res, 'certificateId is required');

    const result = await Certificate.verify(certificateId.toUpperCase().trim());

    if (!result.valid) return err(res, result.reason, 404);

    return ok(res, { certificate: result.certificate });

  } catch (e) {
    console.error('publicVerify error:', e.message);
    return err(res, 'Verification failed', 500);
  }
};

// ═══════════════════════════════════════════════════════════════
// 6. MY CERTIFICATES (Authenticated User)
// GET /api/certificates/my?status=issued&page=1&limit=10
//
// Returns all certificates belonging to the logged-in user
// ═══════════════════════════════════════════════════════════════

export const myCertificates = async (req, res) => {
  try {
    const userId = req.user._id;
    const { status, page = 1, limit = 10 } = req.query;

    const filter = { userId };
    if (status) filter.status = status;

    const skip  = (Number(page) - 1) * Number(limit);
    const total = await Certificate.countDocuments(filter);

    const certs = await Certificate.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(Number(limit))
      .lean();

    return ok(res, {
      total,
      page:  Number(page),
      pages: Math.ceil(total / Number(limit)),
      certificates: certs.map(c => ({
        certificateId:   c.certificateId,
        tier:            c.tier,
        skill:           c.skill,
        status:          c.status,
        isValid:         c.isValid,
        issuedAt:        c.issuedAt,
        pdfUrl:          c.pdfUrl,
        qrCodeUrl:       c.qrCodeUrl,
        verificationUrl: c.verificationUrl,
        verifyPngUrl:    c.verifyPngUrl,
        amount:          c.payment.amount,
        paid:            c.payment.paid,
        createdAt:       c.createdAt,
      })),
    });

  } catch (e) {
    console.error('myCertificates error:', e.message);
    return err(res, 'Failed to fetch certificates', 500);
  }
};

// ═══════════════════════════════════════════════════════════════
// 7. GET SINGLE CERTIFICATE (Owner or Admin)
// GET /api/certificates/:certificateId
//
// Returns full certificate data for the owner
// ═══════════════════════════════════════════════════════════════

export const getCertificate = async (req, res) => {
  try {
    const { certificateId } = req.params;
    const userId = req.user._id;

    const cert = await Certificate.findOne({
      certificateId: certificateId.toUpperCase().trim(),
    }).lean();

    if (!cert) return err(res, 'Certificate not found', 404);

    // Only the owner can see full details (admins bypass this via a separate admin route)
    if (cert.userId.toString() !== userId.toString()) {
      return err(res, 'Not authorised to view this certificate', 403);
    }

    return ok(res, { certificate: cert });

  } catch (e) {
    console.error('getCertificate error:', e.message);
    return err(res, 'Failed to fetch certificate', 500);
  }
};

// ═══════════════════════════════════════════════════════════════
// 8. ADMIN — REVOKE CERTIFICATE
// PATCH /api/certificates/:certificateId/revoke
//
// Admin only — protected by isAdmin middleware
// Body: { reason }
// ═══════════════════════════════════════════════════════════════

export const revokeCertificate = async (req, res) => {
  try {
    const { certificateId } = req.params;
    const { reason = 'Revoked by admin' } = req.body;

    const cert = await Certificate.findOne({
      certificateId: certificateId.toUpperCase().trim(),
    });

    if (!cert) return err(res, 'Certificate not found', 404);

    if (cert.status === 'revoked') return err(res, 'Certificate is already revoked');

    await cert.revoke(reason);

    return ok(res, {
      message:       'Certificate revoked.',
      certificateId: cert.certificateId,
      revokedAt:     cert.revokedAt,
      revokedReason: cert.revokedReason,
    });

  } catch (e) {
    console.error('revokeCertificate error:', e.message);
    return err(res, 'Failed to revoke certificate', 500);
  }
};

// ═══════════════════════════════════════════════════════════════
// 9. ADMIN — ALL CERTIFICATES (paginated)
// GET /api/certificates/admin/all?status=issued&tier=pro&page=1&limit=20
// ═══════════════════════════════════════════════════════════════

export const adminGetAll = async (req, res) => {
  try {
    const { status, tier, skill, page = 1, limit = 20 } = req.query;

    const filter = {};
    if (status) filter.status = status;
    if (tier)   filter.tier   = tier;
    if (skill)  filter.skill  = skill;

    const skip  = (Number(page) - 1) * Number(limit);
    const total = await Certificate.countDocuments(filter);

    const certs = await Certificate.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(Number(limit))
      .lean();

    return ok(res, {
      total,
      page:         Number(page),
      pages:        Math.ceil(total / Number(limit)),
      certificates: certs,
    });

  } catch (e) {
    console.error('adminGetAll error:', e.message);
    return err(res, 'Failed to fetch certificates', 500);
  }
};

// ═══════════════════════════════════════════════════════════════
// 10. ADMIN — REISSUE (regenerate PDF + QR)
// POST /api/certificates/:certificateId/reissue
//
// Useful if PDF generation failed or template was updated
// ═══════════════════════════════════════════════════════════════

export const reissueCertificate = async (req, res) => {
  try {
    const { certificateId } = req.params;

    const cert = await Certificate.findOne({
      certificateId: certificateId.toUpperCase().trim(),
    });

    if (!cert)                    return err(res, 'Certificate not found', 404);
    if (cert.status === 'revoked') return err(res, 'Cannot reissue a revoked certificate', 400);
    if (!cert.payment.paid && cert.payment.paymentRequired)
      return err(res, 'Cannot reissue — payment not completed', 400);

    const result = await issueCertificate(cert);

    return ok(res, {
      message:         'Certificate reissued successfully.',
      certificateId:   result.certificateId,
      verificationUrl: result.verificationUrl,
      qrCodeUrl:       result.qrCodeUrl,
      pdfUrl:          result.pdfUrl,
    });

  } catch (e) {
    console.error('reissueCertificate error:', e.message);
    return err(res, 'Failed to reissue certificate', 500);
  }
};