// routes/chatRoutes.js

import express from 'express';
import { 
  sendMessage, 
  getMessages, 
  deleteMessage, 
  editMessage, 
  addReaction, 
  getMedia,
  upload 
} from '../../../Controller/user/Chat.Controller/messageController.js';

import {
  createOrGetConversation,
  getConversations,
  getConversation,
  deleteConversation,
  togglePin,
  toggleMute,
  markAsRead,
  searchConversations,
  getConversationStats
} from '../../../Controller/user/Chat.Controller/conversationController.js';

import {
  searchUsers,
  startDirectConversation,
} from '../../../Controller/user/Chat.Controller/searchUsers.controller.js';

import { protect }           from '../../../Middleware/authMiddleware.js';
import { handleUploadError } from '../../../Middleware/uploadMiddleware.js';

export const chatRoutes = express.Router();

// ═════════════════════════════════════════════════════════════
// 🔐 ALL ROUTES REQUIRE AUTHENTICATION
// ═════════════════════════════════════════════════════════════
chatRoutes.use(protect);

// ═════════════════════════════════════════════════════════════
// 🔍 SEARCH ROUTES
// ═════════════════════════════════════════════════════════════

// Search any user by name / username / email
// GET /api/chat/search/users?q=john&page=1&limit=20
chatRoutes.get('/search/users', searchUsers);

// Start or open a direct conversation with a user
// POST /api/chat/conversations/direct  { targetUserId }
chatRoutes.post('/conversations/direct', startDirectConversation);

// ═════════════════════════════════════════════════════════════
// 📋 CONVERSATION ROUTES
// ═════════════════════════════════════════════════════════════

// Create or get conversation
chatRoutes.post('/conversations', createOrGetConversation);

// Get all conversations
chatRoutes.get('/conversations', getConversations);

// Search conversations  ← must come before /:conversationId
chatRoutes.get('/conversations/search', searchConversations);

// Get conversation stats  ← must come before /:conversationId
chatRoutes.get('/conversations/stats', getConversationStats);

// Get single conversation
chatRoutes.get('/conversations/:conversationId', getConversation);

// Delete conversation
chatRoutes.delete('/conversations/:conversationId', deleteConversation);

// Pin/Unpin conversation
chatRoutes.patch('/conversations/:conversationId/pin', togglePin);

// Mute/Unmute conversation
chatRoutes.patch('/conversations/:conversationId/mute', toggleMute);

// Mark conversation as read
chatRoutes.patch('/conversations/:conversationId/read', markAsRead);

// ═════════════════════════════════════════════════════════════
// 💬 MESSAGE ROUTES
// ═════════════════════════════════════════════════════════════

// Send message (text, image, video, file)
chatRoutes.post('/messages',
  upload.array('files', 10),
  handleUploadError,
  sendMessage
);

// Get messages
chatRoutes.get('/messages/:conversationId', getMessages);

// Delete message
chatRoutes.delete('/messages/:messageId', deleteMessage);

// Edit message
chatRoutes.patch('/messages/:messageId', editMessage);

// Add reaction
chatRoutes.post('/messages/:messageId/reaction', addReaction);

// Get media in a conversation
chatRoutes.get('/conversations/:conversationId/media', getMedia);

// ═════════════════════════════════════════════════════════════
// EXPORT
// ═════════════════════════════════════════════════════════════

export default chatRoutes;