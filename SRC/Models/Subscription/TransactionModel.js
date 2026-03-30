// models/TransactionModel.js
import mongoose from 'mongoose';
import { backupDocument } from '../../Service/Backup-DB/backupService.js';

const transactionSchema = new mongoose.Schema(
  {
    employeeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Employee',
      required: true,
      index: true,
    },
    type: {
      type: String,
      enum: ['payment', 'withdrawal', 'refund', 'bonus'],
      required: true,
      index: true,
    },
    amount: {
      type: Number,
      required: true,
      min: 0,
    },
    // ──────────────────────────────────────────────────────────────
    // PAYMENT-SPECIFIC FIELDS (filled for type: 'payment')
    // ──────────────────────────────────────────────────────────────
    grossAmount: {
      type: Number,
      default: null,
      // grossAmount = commission + amount (net)
    },
    commission: {
      type: Number,
      default: 0,
      min: 0,
    },
    commissionRate: {
      type: Number,
      default: 0.22, // 22% - for audit trail
    },
    
    // ──────────────────────────────────────────────────────────────
    // PAYMENT TRACKING (CRITICAL FOR IDEMPOTENCY)
    // ──────────────────────────────────────────────────────────────
    razorpayPaymentId: {
      type: String,
      sparse: true, // Allow null but enforce uniqueness when present
      index: true,
    },
    razorpayPayoutId: {
      type: String,
      sparse: true,
      index: true,
    },

    status: {
      type: String,
      enum: ['pending', 'completed', 'failed'],
      default: 'pending',
      index: true,
    },

    jobId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Job',
      default: null,
      sparse: true,
      index: true,
    },

    // ──────────────────────────────────────────────────────────────
    // REFUND SUPPORT
    // ──────────────────────────────────────────────────────────────
    originalTransactionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Transaction',
      default: null,
      sparse: true,
      // Links refund transaction to original payment
    },

    description: {
      type: String,
      default: '',
    },

    failureReason: {
      type: String,
      default: null,
    },

    processedAt: {
      type: Date,
      default: null,
      // When payment was actually processed (better than createdAt)
    },
  },
  {
    timestamps: true,
  }
);

// ──────────────────────────────────────────────────────────────────
// INDEXES FOR PERFORMANCE & IDEMPOTENCY
// ──────────────────────────────────────────────────────────────────

// Query: Find duplicate payments
transactionSchema.index(
  { razorpayPaymentId: 1, employeeId: 1, type: 1, status: 1 },
  { 
    sparse: true,
    // This ensures we can't have same payment processed twice
  }
);

// Query: Get employee's payment history
transactionSchema.index({ employeeId: 1, createdAt: -1 });

// Query: Find transactions by type & status
transactionSchema.index({ type: 1, status: 1 });

// Query: Find by Razorpay IDs (for webhook callbacks)
transactionSchema.index({ razorpayPaymentId: 1 });
transactionSchema.index({ razorpayPayoutId: 1 });

// Query: Find refunds linked to original transactions
transactionSchema.index({ originalTransactionId: 1 });

// ──────────────────────────────────────────────────────────────────
// COMPOUND INDEX FOR IDEMPOTENCY CHECK
// ──────────────────────────────────────────────────────────────────
// This is the KEY INDEX - prevents duplicate payments!
transactionSchema.index(
  { razorpayPaymentId: 1, type: 1, status: 1 },
  { 
    sparse: true,
    unique: true, // ← CRITICAL: Only one "payment" can have same razorpayPaymentId
  }
);

// Helper method to check if payment was already processed
transactionSchema.statics.isPaymentProcessed = async function (razorpayPaymentId) {
  const doc = await this.findOne(
    {
      razorpayPaymentId,
      type: 'payment',
      status: 'completed',
    },
    { _id: 1 }
  );
  return !!doc;
};

// Helper method to get earnings summary
transactionSchema.statics.getEarningsSummary = async function (employeeId) {
  const result = await this.aggregate([
    {
      $match: {
        employeeId: new mongoose.Types.ObjectId(employeeId),
        type: 'payment',
        status: 'completed',
      },
    },
    {
      $group: {
  _id: null,
  totalEarned: { $sum: '$grossAmount' },   // ✅ CHANGED: Sum GROSS amount
  totalGross: { $sum: '$grossAmount' },
  totalCommission: { $sum: '$commission' },
  paymentCount: { $sum: 1 },
  lastPaymentDate: { $max: '$processedAt' },
},
    },
  ]);

  return result[0] || {
    totalEarned: 0,
    totalGross: 0,
    totalCommission: 0,
    paymentCount: 0,
    lastPaymentDate: null,
  };
};


// ─────────────────────────────────────────────────────────────
// BACKUP HOOKS
// ─────────────────────────────────────────────────────────────

transactionSchema.pre('save', function () {
  this._wasNew = this.isNew;
});

transactionSchema.post('save', async function () {
  try {
    await backupDocument('transactions', this._wasNew ? 'create' : 'update', this);
  } catch (err) {
    console.error('⚠️ [BACKUP] post.save failed (transactions):', err.message);
  }
});

transactionSchema.post('findOneAndDelete', async function (doc) {
  if (!doc) return;
  try {
    await backupDocument('transactions', 'delete', doc);
  } catch (err) {
    console.error('⚠️ [BACKUP] post.findOneAndDelete failed (transactions):', err.message);
  }
});

transactionSchema.post('deleteOne', { document: true, query: false }, async function () {
  try {
    await backupDocument('transactions', 'delete', this);
  } catch (err) {
    console.error('⚠️ [BACKUP] post.deleteOne failed (transactions):', err.message);
  }
});

transactionSchema.post('findOneAndUpdate', async function (doc) {
  if (!doc) return;
  try {
    await backupDocument('transactions', 'update', doc);
  } catch (err) {
    console.error('⚠️ [BACKUP] post.findOneAndUpdate failed (transactions):', err.message);
  }
});

const Transaction = mongoose.models.Transaction || mongoose.model('Transaction', transactionSchema);
export { Transaction };
export default Transaction;