// Models/Chat/ConversationModel.js

import mongoose from 'mongoose';
import { backupDocument } from '../../Service/Backup-DB/backupService.js';

const ConversationSchema = new mongoose.Schema(
  {
    // Participants
    participants: [
      {
        userId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'User',
          required: true
        },
        userType: {
          type: String,
          enum: ['employee', 'client', 'officials'],
          required: true
        },
        lastReadAt: {
          type: Date,
          default: Date.now
        },
        isDeleted: {
          type: Boolean,
          default: false
        },
        deletedAt: Date,
        isMuted: {
          type: Boolean,
          default: false
        },
        isPinned: {
          type: Boolean,
          default: false
        },
        pinnedAt: Date
      }
    ],

    // Conversation type
    type: {
      type: String,
      enum: ['direct', 'group', 'support'],
      default: 'direct'
    },

    // Group details (if type is 'group')
    groupInfo: {
      name: String,
      description: String,
      avatar: String,
      admins: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
      }],
      createdBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
      }
    },

    // Last message info (for quick preview)
    lastMessage: {
      text: String,
      senderId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
      },
      sentAt: Date,
      messageType: {
        type: String,
        enum: ['text', 'image', 'video', 'file', 'audio', 'portfolio', 'project', 'voice']
      }
    },

    // Related entities
    relatedTo: {
      portfolioId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Portfolio'
      },
      projectId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Project'
      },
      jobId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Job'
      }
    },

    // Conversation metadata
    metadata: {
      totalMessages: {
        type: Number,
        default: 0
      },
      lastActivity: {
        type: Date,
        default: Date.now
      },
      priority: {
        type: String,
        enum: ['low', 'medium', 'high', 'urgent'],
        default: 'medium'
      },
      tags: [String],
      isArchived: {
        type: Boolean,
        default: false
      },
      archivedAt: Date,
      archivedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
      }
    },

    // Status
    status: {
      type: String,
      enum: ['active', 'archived', 'blocked', 'deleted'],
      default: 'active'
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

ConversationSchema.index({ 'participants.userId': 1 });
ConversationSchema.index({ 'metadata.lastActivity': -1 });
ConversationSchema.index({ status: 1 });
ConversationSchema.index({ 'participants.userId': 1, status: 1 });
ConversationSchema.index({ type: 1, status: 1 });

// ═══════════════════════════════════════════════════════════════
// INSTANCE METHODS
// ═══════════════════════════════════════════════════════════════

/**
 * ✅ Check if a user is a participant in this conversation
 * @param {ObjectId|String} userId - User ID to check
 * @returns {Boolean} - True if user is a participant and not deleted
 */
ConversationSchema.methods.isParticipant = function(userId) {
  if (!userId) return false;
  
  const userIdString = userId.toString();
  
  return this.participants.some(participant => {
    if (participant.isDeleted) return false;
    
    // ✅ Handle both populated and non-populated userId
    const participantUserId = participant.userId._id || participant.userId;
    return participantUserId.toString() === userIdString;
  });
};

/**
 * ✅ Get the other participant in a direct conversation
 * @param {ObjectId|String} userId - Current user ID
 * @returns {Object|null} - Other participant object or null
 */
ConversationSchema.methods.getOtherParticipant = function(userId) {
  if (!userId || this.type !== 'direct') return null;
  
  const userIdString = userId.toString();
  
  return this.participants.find(participant => {
    if (participant.isDeleted) return false;
    
    const participantUserId = participant.userId._id || participant.userId;
    return participantUserId.toString() !== userIdString;
  });
};

/**
 * ✅ Get all active participants (not deleted)
 * @returns {Array} - Array of active participants
 */
ConversationSchema.methods.getActiveParticipants = function() {
  return this.participants.filter(p => !p.isDeleted);
};

/**
 * ✅ Check if user is admin (for group chats)
 * @param {ObjectId|String} userId - User ID to check
 * @returns {Boolean} - True if user is admin
 */
ConversationSchema.methods.isAdmin = function(userId) {
  if (!userId || this.type !== 'group' || !this.groupInfo.admins) {
    return false;
  }
  
  const userIdString = userId.toString();
  
  return this.groupInfo.admins.some(adminId => 
    adminId.toString() === userIdString
  );
};

/**
 * ✅ Get unread message count for a user
 * @param {ObjectId|String} userId - User ID
 * @returns {Number} - Unread count
 */
ConversationSchema.methods.getUnreadCount = function(userId) {
  if (!userId) return 0;
  
  const userIdString = userId.toString();
  
  const participant = this.participants.find(p => {
    const pUserId = p.userId._id || p.userId;
    return pUserId.toString() === userIdString;
  });
  
  if (!participant) return 0;
  
  // If never read, return total messages
  if (!participant.lastReadAt) return this.metadata.totalMessages;
  
  // If lastMessage is newer than lastReadAt
  if (this.lastMessage && this.lastMessage.sentAt > participant.lastReadAt) {
    // This is an approximation - for exact count, query Message model
    return 1;
  }
  
  return 0;
};

/**
 * ✅ Mark conversation as read for a user
 * @param {ObjectId|String} userId - User ID
 * @returns {Promise<Conversation>} - Updated conversation
 */
ConversationSchema.methods.markAsRead = async function(userId) {
  if (!userId) return this;
  
  const userIdString = userId.toString();
  
  const participant = this.participants.find(p => {
    const pUserId = p.userId._id || p.userId;
    return pUserId.toString() === userIdString;
  });
  
  if (participant) {
    participant.lastReadAt = new Date();
    await this.save();
  }
  
  return this;
};

/**
 * ✅ Soft delete conversation for a user
 * @param {ObjectId|String} userId - User ID
 * @returns {Promise<Conversation>} - Updated conversation
 */
ConversationSchema.methods.deleteForUser = async function(userId) {
  if (!userId) return this;
  
  const userIdString = userId.toString();
  
  const participant = this.participants.find(p => {
    const pUserId = p.userId._id || p.userId;
    return pUserId.toString() === userIdString;
  });
  
  if (participant) {
    participant.isDeleted = true;
    participant.deletedAt = new Date();
    await this.save();
  }
  
  return this;
};

/**
 * ✅ Restore conversation for a user
 * @param {ObjectId|String} userId - User ID
 * @returns {Promise<Conversation>} - Updated conversation
 */
ConversationSchema.methods.restoreForUser = async function(userId) {
  if (!userId) return this;
  
  const userIdString = userId.toString();
  
  const participant = this.participants.find(p => {
    const pUserId = p.userId._id || p.userId;
    return pUserId.toString() === userIdString;
  });
  
  if (participant && participant.isDeleted) {
    participant.isDeleted = false;
    participant.deletedAt = null;
    await this.save();
  }
  
  return this;
};

/**
 * ✅ Toggle mute for a user
 * @param {ObjectId|String} userId - User ID
 * @returns {Promise<Conversation>} - Updated conversation
 */
ConversationSchema.methods.toggleMute = async function(userId) {
  if (!userId) return this;
  
  const userIdString = userId.toString();
  
  const participant = this.participants.find(p => {
    const pUserId = p.userId._id || p.userId;
    return pUserId.toString() === userIdString;
  });
  
  if (participant) {
    participant.isMuted = !participant.isMuted;
    await this.save();
  }
  
  return this;
};

/**
 * ✅ Toggle pin for a user
 * @param {ObjectId|String} userId - User ID
 * @returns {Promise<Conversation>} - Updated conversation
 */
ConversationSchema.methods.togglePin = async function(userId) {
  if (!userId) return this;
  
  const userIdString = userId.toString();
  
  const participant = this.participants.find(p => {
    const pUserId = p.userId._id || p.userId;
    return pUserId.toString() === userIdString;
  });
  
  if (participant) {
    participant.isPinned = !participant.isPinned;
    participant.pinnedAt = participant.isPinned ? new Date() : null;
    await this.save();
  }
  
  return this;
};

/**
 * ✅ Update last message info
 * @param {Object} messageData - Message data
 * @returns {Promise<Conversation>} - Updated conversation
 */
ConversationSchema.methods.updateLastMessage = async function(messageData) {
  this.lastMessage = {
    text: messageData.text || `Sent a ${messageData.messageType}`,
    senderId: messageData.senderId,
    sentAt: messageData.createdAt || new Date(),
    messageType: messageData.messageType
  };
  
  this.metadata.lastActivity = new Date();
  this.metadata.totalMessages += 1;
  
  await this.save();
  return this;
};

// ═══════════════════════════════════════════════════════════════
// STATIC METHODS
// ═══════════════════════════════════════════════════════════════

/**
 * ✅ Find or create a direct conversation between two users
 * @param {ObjectId|String} userId1 - First user ID
 * @param {ObjectId|String} userId2 - Second user ID
 * @param {Object} userData1 - First user data (userType, etc.)
 * @param {Object} userData2 - Second user data (userType, etc.)
 * @returns {Promise<Conversation>} - Conversation document
 */
ConversationSchema.statics.findOrCreateDirect = async function(userId1, userId2, userData1, userData2) {
  // Check if conversation exists
  let conversation = await this.findOne({
    type: 'direct',
    'participants.userId': { $all: [userId1, userId2] }
  }).populate('participants.userId', 'fullname username userType email profilePic');
  
  if (conversation) return conversation;
  
  // Create new conversation
  conversation = await this.create({
    type: 'direct',
    participants: [
      {
        userId: userId1,
        userType: userData1.userType,
        lastReadAt: new Date()
      },
      {
        userId: userId2,
        userType: userData2.userType,
        lastReadAt: new Date()
      }
    ],
    metadata: {
      totalMessages: 0,
      lastActivity: new Date()
    }
  });
  
  await conversation.populate('participants.userId', 'fullname username userType email profilePic');
  
  return conversation;
};

/**
 * ✅ Get all conversations for a user
 * @param {ObjectId|String} userId - User ID
 * @param {Object} options - Query options (status, type, limit, skip)
 * @returns {Promise<Array>} - Array of conversations
 */
ConversationSchema.statics.getUserConversations = async function(userId, options = {}) {
  const {
    status = 'active',
    type = null,
    limit = 50,
    skip = 0,
    includeDeleted = false
  } = options;
  
  const query = {
    'participants.userId': userId,
    status
  };
  
  if (type) query.type = type;
  
  if (!includeDeleted) {
    query['participants.isDeleted'] = false;
  }
  
  return this.find(query)
    .populate('participants.userId', 'fullname username userType email profilePic status')
    .sort({ 'metadata.lastActivity': -1 })
    .limit(limit)
    .skip(skip);
};

// ═══════════════════════════════════════════════════════════════
// EXPORT
// ═══════════════════════════════════════════════════════════════
// ─────────────────────────────────────────────────────────────
// BACKUP HOOKS
// ─────────────────────────────────────────────────────────────

ConversationSchema.pre('save', function () {
  this._wasNew = this.isNew;
});

ConversationSchema.post('save', async function () {
  try {
    await backupDocument('conversations', this._wasNew ? 'create' : 'update', this);
  } catch (err) {
    console.error('⚠️ [BACKUP] post.save failed (conversations):', err.message);
  }
});

ConversationSchema.post('findOneAndDelete', async function (doc) {
  if (!doc) return;
  try {
    await backupDocument('conversations', 'delete', doc);
  } catch (err) {
    console.error('⚠️ [BACKUP] post.findOneAndDelete failed (conversations):', err.message);
  }
});

ConversationSchema.post('deleteOne', { document: true, query: false }, async function () {
  try {
    await backupDocument('conversations', 'delete', this);
  } catch (err) {
    console.error('⚠️ [BACKUP] post.deleteOne failed (conversations):', err.message);
  }
});

ConversationSchema.post('findOneAndUpdate', async function (doc) {
  if (!doc) return;
  try {
    await backupDocument('conversations', 'update', doc);
  } catch (err) {
    console.error('⚠️ [BACKUP] post.findOneAndUpdate failed (conversations):', err.message);
  }
});


const Conversation = mongoose.models.Conversation || 
  mongoose.model('Conversation', ConversationSchema);

export default Conversation;