// services/Subscription/withdrawal.service.js
import Wallet from '../../Models/Subscription/WalletModel.js';
import Transaction from '../../Models/Subscription/TransactionModel.js';
import Employee from '../../Models/USER-Auth/Employee-Model.js';
import mongoose from 'mongoose';

const WITHDRAWAL_MIN = 250;
const WITHDRAWAL_MAX = 50000;
const DAILY_WITHDRAWAL_MAX = 100000;

/**
 * Check daily withdrawal limit
 */
export const checkDailyLimit = async (employeeId) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const totalTodayWithdrawals = await Transaction.aggregate([
      {
        $match: {
          employeeId: new mongoose.Types.ObjectId(employeeId), // ✅ fixed
          type: 'withdrawal',
          status: 'completed',
          createdAt: { $gte: today },
        },
      },
      {
        $group: {
          _id: null,
          total: { $sum: '$amount' },
        },
      },
    ]);

    const withdrawnToday = totalTodayWithdrawals[0]?.total || 0;
    return {
      withdrawnToday,
      remainingDaily: DAILY_WITHDRAWAL_MAX - withdrawnToday,
      canWithdraw: DAILY_WITHDRAWAL_MAX - withdrawnToday > 0,
    };
  } catch (error) {
    console.error('[checkDailyLimit] Error:', error.message);
    throw error;
  }
};

/**
 * Validate bank details
 */
const validateBankDetails = (bankDetails) => {
  if (!bankDetails) return { valid: false, error: 'Bank details missing' };

  const required = ['accountHolderName', 'accountNumber', 'ifscCode', 'bankName'];
  const missing = required.filter((field) => !bankDetails[field]);

  if (missing.length > 0) {
    return {
      valid: false,
      error: `Incomplete bank details: missing ${missing.join(', ')}`,
    };
  }

  if (!bankDetails.verified) {
    return { valid: false, error: 'Bank details not verified' };
  }

  return { valid: true };
};

/**
 * Initiate withdrawal — MANUAL PAYOUT (RazorpayX pending approval)
 * Status stays 'pending' — admin manually transfers and marks complete
 */
export const withdrawalRequest = async (employeeId, withdrawalAmount) => {
  const transactionRef = `wd_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

  try {
    console.log(`[${transactionRef}] Withdrawal request: ₹${withdrawalAmount} from ${employeeId}`);

    // ── VALIDATION ──────────────────────────────────────────────

    if (!withdrawalAmount || withdrawalAmount <= 0) {
      return { success: false, message: 'Invalid withdrawal amount' };
    }

    if (withdrawalAmount < WITHDRAWAL_MIN) {
      return {
        success: false,
        message: `Minimum withdrawal is ₹${WITHDRAWAL_MIN}`,
        code: 'MIN_LIMIT_EXCEEDED',
      };
    }

    if (withdrawalAmount > WITHDRAWAL_MAX) {
      return {
        success: false,
        message: `Maximum withdrawal is ₹${WITHDRAWAL_MAX} per transaction`,
        code: 'MAX_LIMIT_EXCEEDED',
      };
    }

    // ── WALLET CHECK ─────────────────────────────────────────────

    const wallet = await Wallet.findOne({ employeeId });
    if (!wallet) {
      return { success: false, message: 'Wallet not found' };
    }

    if (!wallet.isActive) {
      return { success: false, message: 'Wallet is frozen', code: 'WALLET_FROZEN' };
    }

    if (wallet.available < withdrawalAmount) {
      return {
        success: false,
        message: `Insufficient balance. Available: ₹${wallet.available}`,
        code: 'INSUFFICIENT_BALANCE',
        data: {
          available: wallet.available,
          requested: withdrawalAmount,
          shortfall: withdrawalAmount - wallet.available,
        },
      };
    }

    // ── DAILY LIMIT CHECK ────────────────────────────────────────

    const dailyCheck = await checkDailyLimit(employeeId);
    if (dailyCheck.remainingDaily < withdrawalAmount) {
      return {
        success: false,
        message: `Daily limit exceeded. Remaining today: ₹${dailyCheck.remainingDaily}`,
        code: 'DAILY_LIMIT_EXCEEDED',
      };
    }

    // ── EMPLOYEE + BANK DETAILS ──────────────────────────────────

    const employee = await Employee.findById(employeeId)
      .select('bankDetails')
      .populate({ path: 'userId', select: 'fullname razorpayFundAccountId' }); // ✅ fixed

    if (!employee) {
      return { success: false, message: 'Employee not found' };
    }

    const bankValidation = validateBankDetails(employee.bankDetails);
    if (!bankValidation.valid) {
      return {
        success: false,
        message: bankValidation.error,
        code: 'INVALID_BANK_DETAILS',
      };
    }

    // ── CREATE PENDING TRANSACTION ───────────────────────────────

    const transaction = await Transaction.create({
      employeeId,
      type: 'withdrawal',
      amount: withdrawalAmount,
      status: 'pending', // ← stays pending until admin pays manually
      description: `Withdrawal request to ${employee.bankDetails.bankName} — ${employee.userId?.fullname}`,
    });

    // ── UPDATE WALLET (move available → onHold) ──────────────────

    const updatedWallet = await Wallet.findOneAndUpdate(
      { employeeId },
      {
        $inc: {
          available: -withdrawalAmount,
          onHold:     withdrawalAmount,
        },
        $set: {
          lastWithdrawalDate:   new Date(),
          lastWithdrawalAmount: withdrawalAmount,
        },
      },
      { new: true }
    );

    console.log(`[${transactionRef}] ✅ Withdrawal pending — Transaction: ${transaction._id}`);

    return {
      success: true,
      message: 'Withdrawal request submitted. Funds will be transferred within 2-4 business days.',
      code: 'WITHDRAWAL_PENDING',
      data: {
        transactionId:  transaction._id,
        amount:         withdrawalAmount,
        status:         'pending',
        walletBalance:  updatedWallet.available,
        onHold:         updatedWallet.onHold,
        bankName:       employee.bankDetails.bankName,
        estimatedTime:  '2-4 business days',
      },
    };

  } catch (error) {
    console.error(`[${transactionRef}] ❌ Error:`, error.message);
    return {
      success: false,
      message: 'An unexpected error occurred during withdrawal',
      code: 'INTERNAL_ERROR',
    };
  }
};

/**
 * ✅ Called by webhook when RazorpayX payout.processed fires
 * OR called by admin manually marking withdrawal as complete
 */
export const markWithdrawalComplete = async (transactionId, razorpayPayoutId = null) => {
  try {
    const transaction = await Transaction.findById(transactionId);
    if (!transaction || transaction.type !== 'withdrawal') {
      throw new Error('Withdrawal transaction not found');
    }

    if (transaction.status === 'completed') {
      return { success: true, message: 'Already completed' };
    }

    // Move onHold → withdrawn
    await Wallet.findOneAndUpdate(
      { employeeId: transaction.employeeId },
      {
        $inc: {
          onHold:    -transaction.amount,
          withdrawn:  transaction.amount,
        },
      }
    );

    await Transaction.findByIdAndUpdate(transactionId, {
      status:           'completed',
      razorpayPayoutId: razorpayPayoutId || null,
      processedAt:      new Date(),
    });

    console.log(`[markWithdrawalComplete] ✅ Withdrawal completed: ${transactionId}`);
    return { success: true, message: 'Withdrawal marked as completed' };

  } catch (error) {
    console.error('[markWithdrawalComplete] Error:', error.message);
    throw error;
  }
};

/**
 * Called when payout fails — reverse onHold back to available
 */
export const markWithdrawalFailed = async (transactionId, reason = 'Payout failed') => {
  try {
    const transaction = await Transaction.findById(transactionId);
    if (!transaction || transaction.type !== 'withdrawal') {
      throw new Error('Withdrawal transaction not found');
    }

    // Reverse — onHold back to available
    await Wallet.findOneAndUpdate(
      { employeeId: transaction.employeeId },
      {
        $inc: {
          onHold:    -transaction.amount,
          available:  transaction.amount,
        },
      }
    );

    await Transaction.findByIdAndUpdate(transactionId, {
      status:        'failed',
      failureReason: reason,
    });

    console.log(`[markWithdrawalFailed] ❌ Withdrawal failed: ${transactionId}`);
    return { success: true, message: 'Withdrawal marked as failed' };

  } catch (error) {
    console.error('[markWithdrawalFailed] Error:', error.message);
    throw error;
  }
};

/**
 * Get withdrawal history
 */
export const getWithdrawalHistory = async (employeeId, limit = 10, skip = 0) => {
  try {
    const transactions = await Transaction.find({ employeeId, type: 'withdrawal' })
      .sort({ createdAt: -1 })
      .limit(limit)
      .skip(skip)
      .lean();

    const total = await Transaction.countDocuments({ employeeId, type: 'withdrawal' });

    return {
      success: true,
      data: {
        transactions,
        pagination: { total, limit, skip, pages: Math.ceil(total / limit) },
      },
    };
  } catch (error) {
    console.error('[getWithdrawalHistory] Error:', error.message);
    throw error;
  }
};