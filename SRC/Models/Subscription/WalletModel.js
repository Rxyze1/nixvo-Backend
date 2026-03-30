// models/WalletModel.js
import mongoose from 'mongoose';
import { backupDocument } from '../../Service/Backup-DB/backupService.js';


const walletSchema = new mongoose.Schema(
  {
    employeeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Employee',
      required: true,
      unique: true,
      index: true,
    },

    // ──────────────────────────────────────────────────────────────
    // BALANCE FIELDS
    // ──────────────────────────────────────────────────────────────
    available: {
      type: Number,
      default: 0,
      min: 0,
    },
    onHold: {
      type: Number,
      default: 0,
      min: 0,
      // Money pending withdrawal approval
    },
    withdrawn: {
      type: Number,
      default: 0,
      min: 0,
      // Total money already withdrawn
    },

    // ──────────────────────────────────────────────────────────────
    // LIFETIME STATS
    // ──────────────────────────────────────────────────────────────
    totalEarned: {
      type: Number,
      default: 0,
      min: 0,
      // Gross earnings before commission
    },
    totalCommissionPaid: {
      type: Number,
      default: 0,
      min: 0,
      // Total commission deducted (22% of gross)
    },

    // ──────────────────────────────────────────────────────────────
    // PAYMENT TRACKING
    // ──────────────────────────────────────────────────────────────
    lastPaymentDate: {
      type: Date,
      default: null,
    },
    lastPaymentAmount: {
      type: Number,
      default: 0,
      min: 0,
    },

    // ──────────────────────────────────────────────────────────────
    // WITHDRAWAL TRACKING
    // ──────────────────────────────────────────────────────────────
    lastWithdrawalDate: {
      type: Date,
      default: null,
    },
    lastWithdrawalAmount: {
      type: Number,
      default: 0,
      min: 0,
    },

    // ──────────────────────────────────────────────────────────────
    // ACCOUNT STATUS
    // ──────────────────────────────────────────────────────────────
    isActive: {
      type: Boolean,
      default: true,
      index: true,
      // Can be set to false if employee is suspended
    },
    frozenReason: {
      type: String,
      default: null,
      // Why wallet is frozen (if applicable)
    },
  },
  {
    timestamps: true,
  }
);

// ──────────────────────────────────────────────────────────────────
// INDEXES
// ──────────────────────────────────────────────────────────────────
walletSchema.index({ employeeId: 1 });
walletSchema.index({ isActive: 1 });
walletSchema.index({ lastPaymentDate: -1 });

// ──────────────────────────────────────────────────────────────────
// HELPER METHODS
// ──────────────────────────────────────────────────────────────────

/**
 * Get total balance (available + onHold)
 */
walletSchema.methods.getTotalBalance = function () {
  return this.available + this.onHold;
};

/**
 * Get net earnings (after commission)
 */
walletSchema.methods.getNetEarnings = function () {
  return this.totalEarned - this.totalCommissionPaid;
};

/**
 * Get commission percentage
 */
walletSchema.methods.getCommissionPercentage = function () {
  if (this.totalEarned === 0) return 0;
  return ((this.totalCommissionPaid / this.totalEarned) * 100).toFixed(2);
};

/**
 * Static method: Create or get wallet
 */
walletSchema.statics.getOrCreate = async function (employeeId) {
  let wallet = await this.findOne({ employeeId });

  if (!wallet) {
    wallet = await this.create({
      employeeId,
      available: 0,
      onHold: 0,
      withdrawn: 0,
      totalEarned: 0,
      totalCommissionPaid: 0,
    });
  }

  return wallet;
};

/**
 * Static method: Get wallet summary for dashboard
 */
walletSchema.statics.getSummary = async function (employeeId) {
  const wallet = await this.findOne({ employeeId }).lean();

  if (!wallet) {
    return {
      available: 0,
      onHold: 0,
      withdrawn: 0,
      totalBalance: 0,
      totalEarned: 0,
      totalCommissionPaid: 0,
      netEarnings: 0,
      commissionPercentage: 0,
      lastPaymentDate: null,
      lastWithdrawalDate: null,
    };
  }

  const totalBalance = wallet.available + wallet.onHold;
  const netEarnings = wallet.totalEarned - wallet.totalCommissionPaid;
  const commissionPercentage =
    wallet.totalEarned > 0
      ? ((wallet.totalCommissionPaid / wallet.totalEarned) * 100).toFixed(2)
      : 0;

  return {
    available: wallet.available,
    onHold: wallet.onHold,
    withdrawn: wallet.withdrawn,
    totalBalance,
    totalEarned: wallet.totalEarned,
    totalCommissionPaid: wallet.totalCommissionPaid,
    netEarnings,
    commissionPercentage,
    lastPaymentDate: wallet.lastPaymentDate,
    lastWithdrawalDate: wallet.lastWithdrawalDate,
    isActive: wallet.isActive,
  };
};


// ─────────────────────────────────────────────────────────────
// BACKUP HOOKS
// ─────────────────────────────────────────────────────────────

walletSchema.pre('save', function () {
  this._wasNew = this.isNew;
});

walletSchema.post('save', async function () {
  try {
    await backupDocument('wallets', this._wasNew ? 'create' : 'update', this);
  } catch (err) {
    console.error('⚠️ [BACKUP] post.save failed (wallets):', err.message);
  }
});

walletSchema.post('findOneAndDelete', async function (doc) {
  if (!doc) return;
  try {
    await backupDocument('wallets', 'delete', doc);
  } catch (err) {
    console.error('⚠️ [BACKUP] post.findOneAndDelete failed (wallets):', err.message);
  }
});

walletSchema.post('deleteOne', { document: true, query: false }, async function () {
  try {
    await backupDocument('wallets', 'delete', this);
  } catch (err) {
    console.error('⚠️ [BACKUP] post.deleteOne failed (wallets):', err.message);
  }
});

walletSchema.post('findOneAndUpdate', async function (doc) {
  if (!doc) return;
  try {
    await backupDocument('wallets', 'update', doc);
  } catch (err) {
    console.error('⚠️ [BACKUP] post.findOneAndUpdate failed (wallets):', err.message);
  }
});

const Wallet = mongoose.models.Wallet || mongoose.model('Wallet', walletSchema);
export { Wallet };
export default Wallet;