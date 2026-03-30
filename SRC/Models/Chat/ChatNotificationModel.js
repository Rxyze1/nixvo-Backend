// Models/Chat/ChatNotificationModel.js

import mongoose from 'mongoose';
import { backupDocument } from '../../Service/Backup-DB/backupService.js';

const ChatNotificationSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true
    },
    
    conversationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Conversation',
      required: true,
      index: true
    },
    
    messageId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Message',
      required: true
    },
    
    senderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    
    type: {
      type: String,
      enum: ['new_message', 'mention', 'reply', 'reaction'],
      default: 'new_message'
    },
    
    isRead: {
      type: Boolean,
      default: false
    },
    
    readAt: Date,
    
    preview: {
      text: String,
      mediaType: String
    }
  },
  {
    timestamps: true
  }
);

// ═══════════════════════════════════════════════════════════════
// INDEXES
// ═══════════════════════════════════════════════════════════════

ChatNotificationSchema.index({ userId: 1, isRead: 1 });
ChatNotificationSchema.index({ conversationId: 1 });
ChatNotificationSchema.index({ createdAt: -1 });

// ═══════════════════════════════════════════════════════════════
// EXPORT
// ═══════════════════════════════════════════════════════════════


// ─────────────────────────────────────────────────────────────
// BACKUP HOOKS
// ─────────────────────────────────────────────────────────────

ChatNotificationSchema.pre('save', function () {
  this._wasNew = this.isNew;
});

ChatNotificationSchema.post('save', async function () {
  try {
    await backupDocument('chat_notifications', this._wasNew ? 'create' : 'update', this);
  } catch (err) {
    console.error('⚠️ [BACKUP] post.save failed (chat_notifications):', err.message);
  }
});

ChatNotificationSchema.post('findOneAndDelete', async function (doc) {
  if (!doc) return;
  try {
    await backupDocument('chat_notifications', 'delete', doc);
  } catch (err) {
    console.error('⚠️ [BACKUP] post.findOneAndDelete failed (chat_notifications):', err.message);
  }
});

ChatNotificationSchema.post('deleteOne', { document: true, query: false }, async function () {
  try {
    await backupDocument('chat_notifications', 'delete', this);
  } catch (err) {
    console.error('⚠️ [BACKUP] post.deleteOne failed (chat_notifications):', err.message);
  }
});

ChatNotificationSchema.post('findOneAndUpdate', async function (doc) {
  if (!doc) return;
  try {
    await backupDocument('chat_notifications', 'update', doc);
  } catch (err) {
    console.error('⚠️ [BACKUP] post.findOneAndUpdate failed (chat_notifications):', err.message);
  }
});

const ChatNotification = mongoose.models.ChatNotification || 
  mongoose.model('ChatNotification', ChatNotificationSchema);

export default ChatNotification;