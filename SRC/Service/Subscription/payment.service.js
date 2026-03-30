// services/Subscription/payment.service.js
import Wallet from '../../Models/Subscription/WalletModel.js';
import Transaction from '../../Models/Subscription/TransactionModel.js';
import mongoose from 'mongoose';

const PLATFORM_COMMISSION_RATE = 0.22; // 22%

/**
 * Validate payment input
 */
const validatePaymentInput = (employeeId, grossAmount, razorpayPaymentId) => {
  if (!employeeId || !mongoose.Types.ObjectId.isValid(employeeId)) {
    throw new Error('Invalid employeeId');
  }

  if (!grossAmount || typeof grossAmount !== 'number' || grossAmount <= 0) {
    throw new Error('Invalid grossAmount. Must be a positive number');
  }

  if (!razorpayPaymentId || typeof razorpayPaymentId !== 'string') {
    throw new Error('Invalid razorpayPaymentId');
  }

  // Razorpay uses paise (100 paise = 1 rupee)
  // grossAmount should be in rupees (we'll convert to paise internally)
  if (grossAmount > 10000000) {
    // More than ₹1 crore is suspicious
    throw new Error('Amount exceeds maximum limit');
  }
};

/**
 * Calculate payment split with precision
 * Ensures: grossAmount = commission + netAmount
 */
const calculatePaymentSplit = (grossAmount) => {
  // Use Math.floor to prevent overshooting
  const commission = Math.floor(grossAmount * PLATFORM_COMMISSION_RATE * 100) / 100;
  const netAmount = grossAmount - commission;

  return {
    commission: Math.round(commission * 100) / 100, // Convert to paise for storage
    netAmount: Math.round(netAmount * 100) / 100,
  };
};

/**
 * Process payment after Razorpay captures it
 * CLIENT PAYS ₹100 → COMMISSION ₹22 → EMPLOYEE GETS ₹78
 *
 * ⚠️  IDEMPOTENT: Safe to call multiple times with same razorpayPaymentId
 */
export const processPayment = async (
  employeeId,
  grossAmount,
  razorpayPaymentId,
  jobId = null
) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    validatePaymentInput(employeeId, grossAmount, razorpayPaymentId);

    console.log(
      `[processPayment] Processing: ₹${grossAmount} for employee ${employeeId} | Razorpay: ${razorpayPaymentId}`
    );

    // Check idempotency
    const existingTransaction = await Transaction.findOne(
      {
        razorpayPaymentId,
        type: 'payment',
        status: 'completed',
      },
      { _id: 1, employeeId: 1, amount: 1 }
    ).session(session);

    if (existingTransaction) {
      console.warn(
        `[processPayment] Idempotency: Payment ${razorpayPaymentId} already processed`
      );
      return {
        success: true,
        message: 'Payment already processed',
        code: 'PAYMENT_ALREADY_PROCESSED',
        data: {
          transactionId: existingTransaction._id,
          grossAmount,
          creditedAmount: existingTransaction.amount,
        },
      };
    }

    const { commission, netAmount } = calculatePaymentSplit(grossAmount);

    if (netAmount <= 0) {
      throw new Error('Net amount calculation resulted in zero or negative value');
    }

    console.log(
      `[processPayment] Split: Gross ₹${grossAmount} | Commission ₹${commission} | Net ₹${netAmount}`
    );

    // ✅ FIXED: Use grossAmount instead of netAmount
    const wallet = await Wallet.findOneAndUpdate(
      { employeeId },
      {
        $inc: {
          available: netAmount,        // ✅ Employee gets this in wallet
          totalEarned: grossAmount,    // ✅ FIXED: Track GROSS earnings
          totalCommissionPaid: commission, // ✅ Platform takes this
        },
        $set: {
          lastPaymentDate: new Date(),
          lastPaymentAmount: netAmount,
        },
      },
      {
        upsert: true,
        new: true,
        session,
      }
    );

    if (!wallet) {
      throw new Error('Failed to update wallet');
    }

    const transaction = await Transaction.create(
      [
        {
          employeeId,
          type: 'payment',
          amount: netAmount,
          grossAmount,
          commission,
          commissionRate: PLATFORM_COMMISSION_RATE,
          status: 'completed',
          razorpayPaymentId,
          jobId: jobId || null,
          description: jobId
            ? `Payment received for job ${jobId}`
            : 'Payment received',
          processedAt: new Date(),
        },
      ],
      { session }
    );

    await session.commitTransaction();

    console.log(
      `[processPayment] ✅ Payment processed successfully | Txn: ${transaction[0]._id} | Payment: ${razorpayPaymentId}`
    );

    return {
      success: true,
      message: 'Payment processed successfully',
      code: 'PAYMENT_PROCESSED',
      data: {
        transactionId: transaction[0]._id,
        grossAmount,
        commission,
        creditedAmount: netAmount,
        walletBalance: wallet.available,
        jobId: jobId || null,
      },
    };
  } catch (error) {
    await session.abortTransaction();
    console.error(`[processPayment] ❌ Error: ${error.message}`);

    return {
      success: false,
      message: `Payment processing failed: ${error.message}`,
      code: 'PAYMENT_FAILED',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    };
  } finally {
    session.endSession();
  }
};
/**
 * Get payment/transaction history
 */
export const getPaymentHistory = async (employeeId, limit = 20, skip = 0) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(employeeId)) {
      throw new Error('Invalid employeeId');
    }

    const transactions = await Transaction.find(
      {
        employeeId,
        type: 'payment',
        status: 'completed',
      },
      {
        _id: 1,
        grossAmount: 1,
        commission: 1,
        amount: 1,
        jobId: 1,
        razorpayPaymentId: 1,
        processedAt: 1,
        createdAt: 1,
      }
    )
      .sort({ createdAt: -1 })
      .limit(limit)
      .skip(skip)
      .lean();

    const total = await Transaction.countDocuments({
      employeeId,
      type: 'payment',
      status: 'completed',
    });

    return {
      success: true,
      data: {
        transactions,
        pagination: {
          total,
          limit,
          skip,
          pages: Math.ceil(total / limit),
        },
      },
    };
  } catch (error) {
    console.error('[getPaymentHistory] Error:', error.message);
    throw error;
  }
};

/**
 * Get wallet summary
 */
export const getWalletSummary = async (employeeId) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(employeeId)) {
      throw new Error('Invalid employeeId');
    }

    const wallet = await Wallet.findOne({ employeeId }).lean();

    if (!wallet) {
      return {
        success: true,
        data: {
          available: 0,
          onHold: 0,
          withdrawn: 0,
          totalEarned: 0,
          totalCommissionPaid: 0,
          lastPaymentDate: null,
        },
      };
    }

    return {
      success: true,
      data: {
        available: wallet.available,
        onHold: wallet.onHold || 0,
        withdrawn: wallet.withdrawn || 0,
        totalEarned: wallet.totalEarned,
        totalCommissionPaid: wallet.totalCommissionPaid || 0,
        lastPaymentDate: wallet.lastPaymentDate,
        lastPaymentAmount: wallet.lastPaymentAmount,
      },
    };
  } catch (error) {
    console.error('[getWalletSummary] Error:', error.message);
    throw error;
  }
};

/**
 * Refund a payment (when client disputes)
 */
export const refundPayment = async (razorpayPaymentId, refundReason = null) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    // Find the original transaction
    const transaction = await Transaction.findOne(
      { razorpayPaymentId, type: 'payment', status: 'completed' },
      { employeeId: 1, amount: 1, commission: 1, grossAmount: 1 }
    ).session(session);

    if (!transaction) {
      throw new Error('Original payment transaction not found');
    }

    // Reverse the wallet update
    await Wallet.findOneAndUpdate(
      { employeeId: transaction.employeeId },
      {
        $inc: {
  available: -transaction.amount,
  totalEarned: -transaction.grossAmount,    // ✅ CHANGED: Use grossAmount
  totalCommissionPaid: -transaction.commission,
},
      },
      { session }
    );

    // Create refund transaction record
    await Transaction.create(
      [
        {
          employeeId: transaction.employeeId,
          type: 'refund',
          amount: transaction.amount,
          status: 'completed',
          razorpayPaymentId,
          originalTransactionId: transaction._id,
          description: refundReason || 'Payment refunded',
          processedAt: new Date(),
        },
      ],
      { session }
    );

    await session.commitTransaction();

    console.log(`[refundPayment] ✅ Refund processed for ${razorpayPaymentId}`);

    return {
      success: true,
      message: 'Refund processed successfully',
    };
  } catch (error) {
    await session.abortTransaction();
    console.error(`[refundPayment] ❌ Error: ${error.message}`);
    throw error;
  } finally {
    session.endSession();
  }
};