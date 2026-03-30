// Models/Notification.js

import mongoose from 'mongoose';
import { backupDocument } from '../../Service/Backup-DB/backupService.js';

const notificationSchema = new mongoose.Schema({

  // ═══════════════════════════════════════════════════
  // RECIPIENT
  // ═══════════════════════════════════════════════════

  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },

  // ═══════════════════════════════════════════════════
  // TYPE
  // ═══════════════════════════════════════════════════

  type: {
    type: String,
    enum: [
      'job_match',
      'new_application',
      'application_accepted',
      'application_rejected',
      'job_completed',
      'job_cancelled',
      'job_closing_soon',
      'message',                    // ✅ NEW
      'follow',                     // ✅ NEW
      'review_received',            // ✅ NEW
      'payment_received',           // ✅ NEW
    ],
    required: true,
    index: true
  },

  // ═══════════════════════════════════════════════════
  // CONTENT
  // ═══════════════════════════════════════════════════

  title: {
    type: String,
    required: true,
    maxlength: 200
  },

  message: {
    type: String,
    required: true,
    maxlength: 500
  },

  // ═══════════════════════════════════════════════════
  // RELATED DATA
  // ═══════════════════════════════════════════════════

  data: {
    jobId:         { type: mongoose.Schema.Types.ObjectId, ref: 'Job' },
    clientId:      { type: mongoose.Schema.Types.ObjectId, ref: 'Client' },
    employeeId:    { type: mongoose.Schema.Types.ObjectId, ref: 'Employee' },
    applicationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Application' },
    conversationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Conversation' }, // ✅ NEW
    senderId:      { type: mongoose.Schema.Types.ObjectId, ref: 'User' },         // ✅ NEW
  },

  // ═══════════════════════════════════════════════════
  // PUSH NOTIFICATION STATUS
  // ═══════════════════════════════════════════════════

  pushSent: {
    type: Boolean,
    default: false
  },

  pushError: {
    type: String,
    default: null
  },

  // ═══════════════════════════════════════════════════
  // READ STATUS
  // ═══════════════════════════════════════════════════

  isRead: {
    type: Boolean,
    default: false,
    index: true
  },

  readAt: {
    type: Date,
    default: null
  }

}, {
  timestamps: true
});

// ═══════════════════════════════════════════════════
// INDEXES
// ═══════════════════════════════════════════════════

notificationSchema.index({ userId: 1, isRead: 1 });
notificationSchema.index({ userId: 1, createdAt: -1 });
notificationSchema.index(
  { createdAt: 1 },
  { expireAfterSeconds: 60 * 24 * 60 * 60 }
);

// ═══════════════════════════════════════════════════
// INSTANCE METHODS
// ═══════════════════════════════════════════════════

notificationSchema.methods.markRead = function () {
  this.isRead = true;
  this.readAt = new Date();
  return this.save();
};

// ═══════════════════════════════════════════════════
// STATIC METHODS
// ═══════════════════════════════════════════════════

notificationSchema.statics.getUnreadCount = function (userId) {
  return this.countDocuments({ userId, isRead: false });
};

notificationSchema.statics.markAllRead = function (userId) {
  return this.updateMany(
    { userId, isRead: false },
    { $set: { isRead: true, readAt: new Date() } }
  );
};

// ─────────────────────────────────────────────────────────────
// BACKUP HOOKS
// ─────────────────────────────────────────────────────────────

notificationSchema.pre('save', function () {
  this._wasNew = this.isNew;
});

notificationSchema.post('save', async function () {
  try {
    await backupDocument('notifications', this._wasNew ? 'create' : 'update', this);
  } catch (err) {
    console.error('⚠️ [BACKUP] post.save failed (notifications):', err.message);
  }
});

notificationSchema.post('findOneAndDelete', async function (doc) {
  if (!doc) return;
  try {
    await backupDocument('notifications', 'delete', doc);
  } catch (err) {
    console.error('⚠️ [BACKUP] post.findOneAndDelete failed:', err.message);
  }
});

notificationSchema.post('deleteOne', { document: true, query: false }, async function () {
  try {
    await backupDocument('notifications', 'delete', this);
  } catch (err) {
    console.error('⚠️ [BACKUP] post.deleteOne failed:', err.message);
  }
});

notificationSchema.post('findOneAndUpdate', async function (doc) {
  if (!doc) return;
  try {
    await backupDocument('notifications', 'update', doc);
  } catch (err) {
    console.error('⚠️ [BACKUP] post.findOneAndUpdate failed:', err.message);
  }
});

const Notification = mongoose.models.Notification || mongoose.model('Notification', notificationSchema);
export default Notification;