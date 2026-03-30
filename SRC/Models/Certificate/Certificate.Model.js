// Models/Certificate/Certificate.Model.js

import mongoose from 'mongoose';
import { backupDocument } from '../../Service/Backup-DB/backupService.js';

// ═══════════════════════════════════════════════════════════════
// SUB SCHEMAS
// ═══════════════════════════════════════════════════════════════

const assessmentAnswerSchema = new mongoose.Schema({
  questionId: { type: mongoose.Schema.Types.ObjectId, ref: 'CertificateQuestion' },
  question:   { type: String, required: true },
  answer:     { type: String, required: true },
}, { _id: false });

const proofImageSchema = new mongoose.Schema({
  url:        { type: String, required: true },
  filename:   { type: String },
  filesize:   { type: Number },
  mimetype:   { type: String },
  uploadedAt: { type: Date, default: Date.now },
}, { _id: true });

const proofVideoSchema = new mongoose.Schema({
  url:      { type: String, required: true },
  filename: { type: String },
  filesize: { type: Number },
  mimetype: { type: String },
  duration: { type: Number },
  label: {
    type:     String,
    enum:     ['best_work', 'proof_video'],
    required: true,
  },
  uploadedAt: { type: Date, default: Date.now },
}, { _id: true });

// ═══════════════════════════════════════════════════════════════
// MAIN SCHEMA
// ═══════════════════════════════════════════════════════════════

const certificateSchema = new mongoose.Schema({

  // ─────────────────────────────────────────────
  // SERIAL NUMBER
  // Basic: NIXVO-BASIC-2026-XXXXXXXX  ₹99
  // Pro:   NIXVO-PRO-2026-XXXXXXXX    ₹199
  //        (free for Editcraft premium users)
  // ─────────────────────────────────────────────

  certificateId: {
    type:      String,
    unique:    true,
    required:  true,
    index:     true,
    trim:      true,
    uppercase: true,
  },

  tier: {
    type:    String,
    enum:    ['basic', 'pro'],
    default: 'basic',
    index:   true,
  },

  // ─────────────────────────────────────────────
  // STATUS
  // draft           → form filled, not paid
  // payment_pending → Razorpay order created
  // issued          → paid OR Editcraft premium → PDF + QR done
  // revoked         → manually revoked
  // ─────────────────────────────────────────────

  status: {
    type:    String,
    enum:    ['draft', 'payment_pending', 'issued', 'revoked'],
    default: 'draft',
    index:   true,
  },

  // ─────────────────────────────────────────────
  // REFERENCES
  // ─────────────────────────────────────────────

  employeeId: {
    type:     mongoose.Schema.Types.ObjectId,
    ref:      'Employee',
    required: true,
    index:    true,
  },

  userId: {
    type:     mongoose.Schema.Types.ObjectId,
    ref:      'User',
    required: true,
    index:    true,
  },

  type: {
    type:    String,
    enum:    ['skill_certificate'],
    default: 'skill_certificate',
  },

  // ─────────────────────────────────────────────
  // PAYMENT
  // Editcraft premium → paymentRequired: false → auto issued
  // Others → ₹99 basic / ₹199 pro
  // ─────────────────────────────────────────────

  payment: {
    paymentRequired:   { type: Boolean, default: true },
    paid:              { type: Boolean, default: false },
    amount:            { type: Number,  default: 0 },
    currency:          { type: String,  default: 'INR' },
    razorpayOrderId:   { type: String,  default: null },
    razorpayPaymentId: { type: String,  default: null },
    paidAt:            { type: Date,    default: null },
  },

  // ─────────────────────────────────────────────
  // SKILL
  // ─────────────────────────────────────────────

  skill: {
    type:     String,
    required: true,
    trim:     true,
  },

  // ─────────────────────────────────────────────
  // METADATA
  // ─────────────────────────────────────────────

  metadata: {
    employeeName:     { type: String, required: true },
    employeeUsername: { type: String, default: '' },
    profilePic:       { type: String, default: null },
    bio:              { type: String, default: '' },
    skills:           [{ type: String }],
    yearsExperience:  { type: Number, default: 0 },
    issuedAt:         { type: Date,   default: null },
  },

  // ─────────────────────────────────────────────
  // ASSESSMENT Q&A
  // ─────────────────────────────────────────────

  assessment: {
    answers:     [assessmentAnswerSchema],
    submittedAt: { type: Date, default: null },
  },

  // ─────────────────────────────────────────────
  // PROOF UPLOADS
  // Images: max 10 (10MB each)
  // Videos: max 2 (optional)
  // ─────────────────────────────────────────────

  proofImages: {
    type:     [proofImageSchema],
    default:  [],
    validate: {
      validator: function (arr) { return arr.length <= 10; },
      message:   'Maximum 10 proof images allowed',
    },
  },

  proofVideos: {
    type:     [proofVideoSchema],
    default:  [],
    validate: {
      validator: function (arr) { return arr.length <= 2; },
      message:   'Maximum 2 proof videos allowed',
    },
  },

  // ─────────────────────────────────────────────
  // GENERATED FILES
  // ─────────────────────────────────────────────

  pdfUrl:          { type: String, default: null },
  qrCodeUrl:       { type: String, default: null },
  verificationUrl: { type: String, default: null },
  verifyPngUrl:    { type: String, default: null },  // ← ADD THIS
  

  // ─────────────────────────────────────────────
  // REVOKE
  // ─────────────────────────────────────────────

  isValid:       { type: Boolean, default: true, index: true },
  revokedAt:     { type: Date,    default: null },
  revokedReason: { type: String,  default: null },
  issuedAt:      { type: Date,    default: null, index: true },

}, { timestamps: true });

// ═══════════════════════════════════════════════════════════════
// INDEXES
// ═══════════════════════════════════════════════════════════════

certificateSchema.index({ employeeId: 1, issuedAt: -1 });
certificateSchema.index({ certificateId: 1, isValid: 1 });
certificateSchema.index({ userId: 1 });
certificateSchema.index({ status: 1 });
certificateSchema.index({ tier: 1, status: 1 });

// ═══════════════════════════════════════════════════════════════
// STATICS
// ═══════════════════════════════════════════════════════════════

// NIXVO-BASIC-2026-XXXXXXXX  or  NIXVO-PRO-2026-XXXXXXXX
certificateSchema.statics.generateSerialNumber = async function (tier = 'basic') {
  const prefix = tier === 'pro' ? 'NIXVO-PRO' : 'NIXVO-BASIC';
  const year   = new Date().getFullYear();
  let serial, exists;
  do {
    const random = Math.random().toString(36).substring(2, 10).toUpperCase();
    serial       = `${prefix}-${year}-${random}`;
    exists       = await this.exists({ certificateId: serial });
  } while (exists);
  return serial;
};

// ₹99 for basic, ₹199 for pro
certificateSchema.statics.getPrice = function (tier) {
  return tier === 'pro' ? 199 : 99;
};

// Public verify — QR scan or serial entry
certificateSchema.statics.verify = async function (certificateId) {
  const cert = await this.findOne({ certificateId }).lean();

  if (!cert)                        return { valid: false, reason: 'Certificate not found' };
  if (cert.status !== 'issued')     return { valid: false, reason: 'Certificate not yet issued' };
  if (!cert.isValid)                return { valid: false, reason: cert.revokedReason || 'Certificate revoked' };

  return {
    valid: true,
    certificate: {
      serialNumber:     cert.certificateId,
      tier:             cert.tier,
      skill:            cert.skill,
      employeeName:     cert.metadata.employeeName,
      employeeUsername: cert.metadata.employeeUsername,
      profilePic:       cert.metadata.profilePic,
      bio:              cert.metadata.bio,
      skills:           cert.metadata.skills,
      yearsExperience:  cert.metadata.yearsExperience,
      assessment:       cert.assessment.answers,
      proofImages:      cert.proofImages,
      proofVideos:      cert.proofVideos,
      issuedAt:         cert.issuedAt,
      issuedBy:         'Nixvo · Powered by Editcraft',
      verificationUrl:  cert.verificationUrl,
      qrCodeUrl:        cert.qrCodeUrl,
    }
  };
};

// ═══════════════════════════════════════════════════════════════
// INSTANCE METHODS
// ═══════════════════════════════════════════════════════════════

certificateSchema.methods.revoke = function (reason = '') {
  this.isValid       = false;
  this.status        = 'revoked';
  this.revokedAt     = new Date();
  this.revokedReason = reason;
  return this.save();
};

certificateSchema.methods.markIssued = function () {
  this.status            = 'issued';
  this.issuedAt          = new Date();
  this.metadata.issuedAt = new Date();
  return this.save();
};

// ═══════════════════════════════════════════════════════════════
// BACKUP HOOKS
// ═══════════════════════════════════════════════════════════════

certificateSchema.pre('save', function () {
  this._wasNew = this.isNew;
});

certificateSchema.post('save', async function () {
  try {
    await backupDocument('certificates', this._wasNew ? 'create' : 'update', this);
  } catch (err) {
    console.error('⚠️ [BACKUP] post.save failed (certificates):', err.message);
  }
});

certificateSchema.post('findOneAndDelete', async function (doc) {
  if (!doc) return;
  try {
    await backupDocument('certificates', 'delete', doc);
  } catch (err) {
    console.error('⚠️ [BACKUP] post.findOneAndDelete failed (certificates):', err.message);
  }
});

certificateSchema.post('findOneAndUpdate', async function (doc) {
  if (!doc) return;
  try {
    await backupDocument('certificates', 'update', doc);
  } catch (err) {
    console.error('⚠️ [BACKUP] post.findOneAndUpdate failed (certificates):', err.message);
  }
});

// ═══════════════════════════════════════════════════════════════
// EXPORT
// ═══════════════════════════════════════════════════════════════

const Certificate = mongoose.models.Certificate || mongoose.model('Certificate', certificateSchema);
export default Certificate;