// Models/Chat/MessageModel.js

import mongoose from 'mongoose';
import { backupDocument } from '../../Service/Backup-DB/backupService.js';
const MessageSchema = new mongoose.Schema(
  {
    // Conversation reference
    conversationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Conversation',
      required: true,
      index: true
    },

    // Sender info
    senderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true
    },
    senderType: {
      type: String,
      enum: ['employee', 'client', 'officials'],
      required: true
    },

    // Message type
    messageType: {
      type: String,
      enum: ['text', 'image', 'video', 'file', 'audio', 'voice', 'portfolio', 'project', 'system'],
      default: 'text',
      required: true
    },

    // ✅ FIXED: Text content (removed replyTo from here)
    content: {
      text: {
        type: String,
        maxlength: 5000
      }
    },

    // ✅ FIXED: Reply reference moved to root level
    replyTo: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Message',
      default: null
    },

    // ... rest of your schema (keep everything else the same)
    
    images: [
      {
        url: {
          type: String,
          required: true
        },
        key: {
          type: String,
          required: true
        },
        thumbnail: String,
        size: {
          type: Number,
          required: true,
          max: 10 * 1024 * 1024
        },
        mimeType: {
          type: String,
          required: true
        },
        width: Number,
        height: Number,
        caption: String,
        uploadedAt: {
          type: Date,
          default: Date.now
        }
      }
    ],

    videos: [
      {
        url: {
          type: String,
          required: true
        },
        key: {
          type: String,
          required: true
        },
        thumbnail: String,
        size: {
          type: Number,
          required: true,
          max: 400 * 1024 * 1024
        },
        mimeType: {
          type: String,
          required: true
        },
        duration: Number,
        width: Number,
        height: Number,
        caption: String,
        uploadedAt: {
          type: Date,
          default: Date.now
        },
        processingStatus: {
          type: String,
          enum: ['pending', 'processing', 'completed', 'failed'],
          default: 'completed'
        }
      }
    ],

    files: [
      {
        url: {
          type: String,
          required: true
        },
        key: {
          type: String,
          required: true
        },
        fileName: {
          type: String,
          required: true
        },
        size: {
          type: Number,
          required: true,
          max: 50 * 1024 * 1024
        },
        mimeType: {
          type: String,
          required: true
        },
        uploadedAt: {
          type: Date,
          default: Date.now
        }
      }
    ],

    voiceMessage: {
      url: String,
      key: String,
      duration: Number,
      size: {
        type: Number,
        max: 5 * 1024 * 1024
      },
      mimeType: String,
      waveform: [Number],
      uploadedAt: Date
    },

    sharedEntity: {
      type: {
        type: String,
        enum: ['portfolio', 'project', 'job', 'profile']
      },
      entityId: {
        type: mongoose.Schema.Types.ObjectId,
        refPath: 'sharedEntity.type'
      },
      preview: {
        title: String,
        description: String,
        image: String,
        url: String
      }
    },

    status: {
      type: String,
      enum: ['sending', 'sent', 'delivered', 'read', 'failed'],
      default: 'sent'
    },

    readBy: [
      {
        userId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'User'
        },
        readAt: {
          type: Date,
          default: Date.now
        }
      }
    ],

    isEdited: {
      type: Boolean,
      default: false
    },
    editedAt: Date,
    
    isDeleted: {
      type: Boolean,
      default: false
    },
    deletedAt: Date,
    deletedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },

    reactions: [
      {
        userId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'User'
        },
        emoji: {
          type: String,
          required: true
        },
        reactedAt: {
          type: Date,
          default: Date.now
        }
      }
    ],

    isFlagged: {
      type: Boolean,
      default: false
    },
    flagReason: String,
    flaggedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    flaggedAt: Date,

    systemMessage: {
      type: {
        type: String,
        enum: ['user_joined', 'user_left', 'group_created', 'group_updated', 'project_started', 'project_completed']
      },
      data: mongoose.Schema.Types.Mixed
    }
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
  }
);

// ═══════════════════════════════════════════════════════════════
// INDEXES
// ═══════════════════════════════════════════════════════════════

MessageSchema.index({ conversationId: 1, createdAt: -1 });
MessageSchema.index({ senderId: 1 });
MessageSchema.index({ status: 1 });
MessageSchema.index({ conversationId: 1, isDeleted: 1 });
MessageSchema.index({ replyTo: 1 }); // ✅ NEW: Index for replies

// ═══════════════════════════════════════════════════════════════
// VIRTUALS
// ═══════════════════════════════════════════════════════════════

MessageSchema.virtual('hasMedia').get(function() {
  return (
    (this.images && this.images.length > 0) ||
    (this.videos && this.videos.length > 0) ||
    (this.files && this.files.length > 0) ||
    !!this.voiceMessage
  );
});

MessageSchema.virtual('mediaCount').get(function() {
  let count = 0;
  if (this.images) count += this.images.length;
  if (this.videos) count += this.videos.length;
  if (this.files) count += this.files.length;
  if (this.voiceMessage) count += 1;
  return count;
});

// ✅ NEW: Virtual for reply message
MessageSchema.virtual('replyToMessage', {
  ref: 'Message',
  localField: 'replyTo',
  foreignField: '_id',
  justOne: true
});

// ═══════════════════════════════════════════════════════════════
// INSTANCE METHODS
// ═══════════════════════════════════════════════════════════════

MessageSchema.methods.markAsRead = async function(userId) {
  if (!this.readBy.some(r => r.userId.toString() === userId.toString())) {
    this.readBy.push({ userId, readAt: new Date() });
    this.status = 'read';
    await this.save();
  }
};

MessageSchema.methods.addReaction = async function(userId, emoji) {
  const existingReaction = this.reactions.find(r => 
    r.userId.toString() === userId.toString()
  );
  
  if (existingReaction) {
    existingReaction.emoji = emoji;
    existingReaction.reactedAt = new Date();
  } else {
    this.reactions.push({ userId, emoji });
  }
  
  await this.save();
};

MessageSchema.methods.removeReaction = async function(userId) {
  this.reactions = this.reactions.filter(r => 
    r.userId.toString() !== userId.toString()
  );
  await this.save();
};

// ═══════════════════════════════════════════════════════════════
// STATIC METHODS
// ═══════════════════════════════════════════════════════════════

MessageSchema.statics.getMediaMessages = async function(conversationId, mediaType) {
  const filter = {
    conversationId,
    isDeleted: false
  };
  
  if (mediaType === 'images') filter['images.0'] = { $exists: true };
  if (mediaType === 'videos') filter['videos.0'] = { $exists: true };
  if (mediaType === 'files') filter['files.0'] = { $exists: true };
  
  return this.find(filter).sort({ createdAt: -1 });
};

// ═══════════════════════════════════════════════════════════════
// EXPORT
// ═══════════════════════════════════════════════════════════════

// ─────────────────────────────────────────────────────────────
// BACKUP HOOKS
// ─────────────────────────────────────────────────────────────

MessageSchema.pre('save', function () {
  this._wasNew = this.isNew;
});

MessageSchema.post('save', async function () {
  try {
    await backupDocument('messages', this._wasNew ? 'create' : 'update', this);
  } catch (err) {
    console.error('⚠️ [BACKUP] post.save failed (messages):', err.message);
  }
});

MessageSchema.post('findOneAndDelete', async function (doc) {
  if (!doc) return;
  try {
    await backupDocument('messages', 'delete', doc);
  } catch (err) {
    console.error('⚠️ [BACKUP] post.findOneAndDelete failed (messages):', err.message);
  }
});

MessageSchema.post('deleteOne', { document: true, query: false }, async function () {
  try {
    await backupDocument('messages', 'delete', this);
  } catch (err) {
    console.error('⚠️ [BACKUP] post.deleteOne failed (messages):', err.message);
  }
});

MessageSchema.post('findOneAndUpdate', async function (doc) {
  if (!doc) return;
  try {
    await backupDocument('messages', 'update', doc);
  } catch (err) {
    console.error('⚠️ [BACKUP] post.findOneAndUpdate failed (messages):', err.message);
  }
});

const Message = mongoose.models.Message || 
mongoose.model('Message', MessageSchema);

export default Message;