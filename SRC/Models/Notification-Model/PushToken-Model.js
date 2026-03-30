// Models/PushToken-Model.js

import mongoose from 'mongoose';

const pushTokenSchema = new mongoose.Schema({

  // ═══════════════════════════════════════════════════
  // USER & DEVICE
  // ═══════════════════════════════════════════════════

  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },

  token: {
    type: String,
    required: true,
    unique: true,
    index: true,
    // Expo token format: ExponentPushToken[...]
  },

  platform: {
    type: String,
    enum: ['ios', 'android', 'web'],
    required: true
  },

  deviceName: {
    type: String,
    default: null
  },

  appVersion: {
    type: String,
    default: null
  },

  osVersion: {
    type: String,
    default: null
  },

  // ═══════════════════════════════════════════════════
  // STATUS
  // ═══════════════════════════════════════════════════

  isActive: {
    type: Boolean,
    default: true,
    index: true
  },

  deactivatedAt: {
    type: Date,
    default: null
  },

  deactivationReason: {
    type: String,
    enum: [
      'user_logout',
      'token_expired',
      'invalid_token',
      'device_uninstalled',
      'manual_removal',
      null
    ],
    default: null
  },

  // ═══════════════════════════════════════════════════
  // USAGE TRACKING
  // ═══════════════════════════════════════════════════

  lastUsedAt: {
    type: Date,
    default: new Date()
  },

  notificationsSent: {
    type: Number,
    default: 0
  },

  lastNotificationAt: {
    type: Date,
    default: null
  }

}, {
  timestamps: true
});

// ═══════════════════════════════════════════════════
// INDEXES
// ═══════════════════════════════════════════════════

pushTokenSchema.index({ userId: 1, isActive: 1 });
pushTokenSchema.index({ userId: 1, createdAt: -1 });

// Auto-delete inactive tokens older than 90 days
pushTokenSchema.index(
  { deactivatedAt: 1 },
  {
    expireAfterSeconds: 7776000, // 90 days
    partialFilterExpression: { isActive: false }
  }
);

// ═══════════════════════════════════════════════════
// STATIC METHODS
// ═══════════════════════════════════════════════════

pushTokenSchema.statics.registerToken = async function (userId, token, platform, metadata = {}) {
  try {
    // Reactivate if token exists but was deactivated
    const existing = await this.findOne({ token });
    if (existing && !existing.isActive) {
      existing.isActive = true;
      existing.deactivatedAt = null;
      existing.deactivationReason = null;
      existing.lastUsedAt = new Date();
      Object.assign(existing, metadata);
      return await existing.save();
    }

    if (existing) {
      existing.lastUsedAt = new Date();
      Object.assign(existing, metadata);
      return await existing.save();
    }

    // Create new token
    return await this.create({
      userId,
      token,
      platform,
      ...metadata,
      lastUsedAt: new Date()
    });

  } catch (error) {
    console.error('❌ registerToken error:', error.message);
    throw error;
  }
};

pushTokenSchema.statics.deactivateToken = async function (token, reason = 'token_expired') {
  try {
    return await this.findOneAndUpdate(
      { token },
      {
        isActive: false,
        deactivatedAt: new Date(),
        deactivationReason: reason
      },
      { new: true }
    );
  } catch (error) {
    console.error('❌ deactivateToken error:', error.message);
  }
};

pushTokenSchema.statics.getActiveTokens = async function (userId) {
  try {
    return await this.find({ userId, isActive: true }).lean();
  } catch (error) {
    console.error('❌ getActiveTokens error:', error.message);
    return [];
  }
};

pushTokenSchema.statics.removeUserTokens = async function (userId) {
  try {
    return await this.deleteMany({ userId });
  } catch (error) {
    console.error('❌ removeUserTokens error:', error.message);
  }
};

const PushToken = mongoose.models.PushToken || mongoose.model('PushToken', pushTokenSchema);
export default PushToken;