// Models/RefreshTokenModel.js

import mongoose from 'mongoose';

const refreshTokenSchema = new mongoose.Schema(
  {
    token: {
      type: String,
      required: true,
      unique: true,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    isRevoked: {
      type: Boolean,
      default: false,
    },
    expiresAt: {
      type: Date,
      required: true,
    },
  },
  {
    timestamps: true, // Adds createdAt automatically
  }
);

// ════════════════════════════════════════════════════════════════
// INDEXES
// ════════════════════════════════════════════════════════════════

// TTL Index: Auto-delete expired tokens
refreshTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

// Query optimization
refreshTokenSchema.index({ userId: 1, isRevoked: 1 });

// ════════════════════════════════════════════════════════════════
// METHODS
// ════════════════════════════════════════════════════════════════

refreshTokenSchema.methods.isValid = function () {
  return !this.isRevoked && this.expiresAt > new Date();
};

refreshTokenSchema.methods.revoke = async function () {
  this.isRevoked = true;
  return await this.save();
};

// ════════════════════════════════════════════════════════════════
// STATIC METHODS
// ════════════════════════════════════════════════════════════════

refreshTokenSchema.statics.findActiveForUser = function (userId) {
  return this.find({
    userId,
    isRevoked: false,
    expiresAt: { $gt: new Date() },
  });
};

refreshTokenSchema.statics.revokeAllForUser = function (userId) {
  return this.updateMany(
    { userId, isRevoked: false },
    { isRevoked: true }
  );
};

const RefreshToken =
  mongoose.models.RefreshToken ||
  mongoose.model('RefreshToken', refreshTokenSchema);

export default RefreshToken;