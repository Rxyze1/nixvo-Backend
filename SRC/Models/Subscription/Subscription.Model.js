// Models/Subscription/Subscription.Model.js

import mongoose from 'mongoose';
import { backupDocument } from '../../Service/Backup-DB/backupService.js';

// ─────────────────────────────────────────────────────────────
// SUB-SCHEMAS
// ─────────────────────────────────────────────────────────────
const planFeaturesSchema = new mongoose.Schema({
  maxJobsPerMonth:    { type: Number, default: 0 },
  maxApplications:    { type: Number, default: 0 },
  maxBidsPerJob:      { type: Number, default: 0 },
  escrowTransactions: { type: Boolean, default: true },
  premiumBadge:       { type: Boolean, default: false },
  prioritySupport:    { type: Boolean, default: false },
  advancedAnalytics:  { type: Boolean, default: false },
  customBranding:     { type: Boolean, default: false },
  apiAccess:          { type: Boolean, default: false },
  walletAccess:       { type: Boolean, default: true },
  bulkUpload:         { type: Boolean, default: false },
}, { _id: false });

const paymentRecordSchema = new mongoose.Schema({
  paymentId:        { type: String, required: true },
  orderId:          { type: String },
  amount:           { type: Number, required: true },
  currency:         { type: String, default: 'INR' },
  paymentMethod:    { type: String },
  status:           { type: String, enum: ['success', 'failed', 'pending'] },
  paidAt:           { type: Date },
  nextRetryAt:      { type: Date },
  failureReason:    { type: String },
  metadata:         { type: mongoose.Schema.Types.Mixed },
}, { _id: false });

// ─────────────────────────────────────────────────────────────
// SUBSCRIPTION SCHEMA
// ─────────────────────────────────────────────────────────────
const SubscriptionSchema = new mongoose.Schema(
  {
    userId: {
      type:     mongoose.Schema.Types.ObjectId,
      ref:      'User',
      required: [true, 'User ID is required'],
      index:    true,
      unique:   true,
    },

plan: {
  type:    String,
  enum:    ['free', 'basic', 'professional', 'enterprise', 'premium'], // ✅ add premium
  default: 'free',
},

subscriptionStatus: {
  type:    String,
  enum:    ['pending', 'authenticated', 'active', 'inactive', 'expired', 'cancelled', 'suspended', 'halted'], // ✅ add authenticated + halted
  default: 'inactive',
},
    planPrice: {
      type:    Number,
      default: 0,
      min:     0,
    },

    billingCycle: {
      type:     String,
      enum:     ['monthly', 'yearly', 'lifetime'],
      default:  'monthly',
    },

    planActivatedAt:  { type: Date },
    planExpiresAt:    { type: Date },
    isAutoRenewEnabled: { type: Boolean, default: true },
    nextBillingDate:  { type: Date },

    features: {
      type:    planFeaturesSchema,
      default: () => ({}),
    },

    paymentHistory: [paymentRecordSchema],

    cancelledAt:       { type: Date },
    cancellationReason: { type: String, maxlength: 500 },
    cancelledBy:       { type: String, enum: ['user', 'admin', 'system'] },

    trialStartedAt:   { type: Date },
    trialEndsAt:      { type: Date },
    isTrialActive:    { type: Boolean, default: false },
    trialDaysUsed:    { type: Number, default: 0, min: 0 },
    trialConvertedAt: { type: Date },

    suspendedAt:      { type: Date },
    suspensionReason: { type: String, maxlength: 500 },
    suspendedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref:  'User',
    },

    downgradeHistory: [
      {
        fromPlan:    { type: String },
        toPlan:      { type: String },
        reason:      { type: String },
        downgradeAt: { type: Date },
      },
    ],

    appliedCouponCode: { type: String },
    couponDiscount:    { type: Number, default: 0, min: 0 },
    discountValidUntil: { type: Date },

    adminNotes: { type: String, maxlength: 1000 },
  },
  {
    timestamps: true,
    toJSON:     { virtuals: true },
    toObject:   { virtuals: true },
  }
);

// ─────────────────────────────────────────────────────────────
// INDEXES
// ─────────────────────────────────────────────────────────────
SubscriptionSchema.index({ userId: 1 });
SubscriptionSchema.index({ plan: 1, subscriptionStatus: 1 });
SubscriptionSchema.index({ planExpiresAt: 1 });
SubscriptionSchema.index({ createdAt: -1 });
SubscriptionSchema.index({ subscriptionStatus: 1 }, { sparse: true });
SubscriptionSchema.index({ cancelledAt: 1 }, { sparse: true });
SubscriptionSchema.index({ suspendedAt: 1 }, { sparse: true });

// ─────────────────────────────────────────────────────────────
// EXPORT
// ─────────────────────────────────────────────────────────────
// ─────────────────────────────────────────────────────────────
// BACKUP HOOKS
// ─────────────────────────────────────────────────────────────

SubscriptionSchema.pre('save', function () {
  this._wasNew = this.isNew;
});

SubscriptionSchema.post('save', async function () {
  try {
    await backupDocument('subscriptions', this._wasNew ? 'create' : 'update', this);
  } catch (err) {
    console.error('⚠️ [BACKUP] post.save failed (subscriptions):', err.message);
  }
});

SubscriptionSchema.post('findOneAndDelete', async function (doc) {
  if (!doc) return;
  try {
    await backupDocument('subscriptions', 'delete', doc);
  } catch (err) {
    console.error('⚠️ [BACKUP] post.findOneAndDelete failed (subscriptions):', err.message);
  }
});

SubscriptionSchema.post('deleteOne', { document: true, query: false }, async function () {
  try {
    await backupDocument('subscriptions', 'delete', this);
  } catch (err) {
    console.error('⚠️ [BACKUP] post.deleteOne failed (subscriptions):', err.message);
  }
});

SubscriptionSchema.post('findOneAndUpdate', async function (doc) {
  if (!doc) return;
  try {
    await backupDocument('subscriptions', 'update', doc);
  } catch (err) {
    console.error('⚠️ [BACKUP] post.findOneAndUpdate failed (subscriptions):', err.message);
  }
});

const Subscription = mongoose.models.Subscription || mongoose.model('Subscription', SubscriptionSchema);
export default Subscription;