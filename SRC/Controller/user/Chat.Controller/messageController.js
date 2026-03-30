// Controllers/Chat/messageController.js

import Message      from '../../../Models/Chat/MessageModel.js';
import Conversation from '../../../Models/Chat/ConversationModel.js';
import User         from '../../../Models/USER-Auth/User-Auth.-Model.js';
import chatValidationService from '../../../Service/Chat/chatValidationService.js';
import chatSecurityService   from '../../../Service/Chat/chatSecurityService.js';

 import Client   from '../../../Models/USER-Auth/Client-Model.js';
 import Employee from '../../../Models/USER-Auth/Employee-Model.js';

import {
  successResponse,
  createdResponse,
  notFoundResponse,
  forbiddenResponse,
  badRequestResponse,
  serverErrorResponse
} from '../../../Config/responseUtils.js';

import { getIO }                       from '../../../Utils/socket.js';
import multer                          from 'multer';
import sharp                           from 'sharp';
import { uploadToR2, deleteFromR2 }    from '../../../Config/r2Config.js';
import ffmpeg                          from 'fluent-ffmpeg';
import fs                              from 'fs/promises';
import fsSync                          from 'fs';
import path                            from 'path';

/**
 * ═══════════════════════════════════════════════════════════════
 *              💬 MESSAGE CONTROLLER - PRODUCTION
 *         Handles all message operations with R2 storage
 * ═══════════════════════════════════════════════════════════════
 */

// ═════════════════════════════════════════════════════════════
// CONSTANTS
// ═════════════════════════════════════════════════════════════

const MAX_TEXT_LENGTH        = 5000;
const MAX_IMAGE_SIZE         = 10  * 1024 * 1024;  // 10 MB
const MAX_VIDEO_SIZE         = 400 * 1024 * 1024;  // 400 MB
const MAX_FILE_SIZE          = 100 * 1024 * 1024;  // 100 MB
const MAX_IMAGES_PER_MESSAGE = 10;
const MAX_FILES_PER_MESSAGE  = 5;
const IMAGE_MAX_DIMENSION    = 2000;
const THUMBNAIL_SIZE         = 300;
const IMAGE_QUALITY          = 85;
const THUMBNAIL_QUALITY      = 70;

// TO ✅
const ALLOWED_EXTERNAL_SERVICES = [
  'drive.google.com',
  'docs.google.com',
  'dropbox.com',
  'onedrive.live.com',
  'wetransfer.com',
  'mega.nz',
  // 💰 Payment links
  'rzp.io',
  'phonepe.com',
  'paytm.com',
  'pay.google.com',
  'amazonpay.in',
  'mobikwik.com',
  'freecharge.in',
  'cred.club'
];
// ═════════════════════════════════════════════════════════════
// MULTER CONFIGURATION
// ═════════════════════════════════════════════════════════════

const storage = multer.memoryStorage();

const fileFilter = (req, file, cb) => {
  const allowedTypes = {
    image: ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/jpg'],
    video: ['video/mp4', 'video/quicktime', 'video/webm', 'video/x-m4v'],
    file: [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-powerpoint',
      'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      'text/plain',
      'text/csv',
      'application/zip',
      'application/x-zip-compressed',
      'application/x-rar-compressed'
    ]
  };

  const allAllowed = [...allowedTypes.image, ...allowedTypes.video, ...allowedTypes.file];

  if (allAllowed.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error(`Unsupported file type: ${file.mimetype}`), false);
  }
};

export const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize : MAX_VIDEO_SIZE,
    files    : MAX_IMAGES_PER_MESSAGE
  }
});

// ═════════════════════════════════════════════════════════════
// HELPER FUNCTIONS
// ═════════════════════════════════════════════════════════════

/**
 * Clean up temporary files — idempotent (checks existsSync before unlinking).
 */
const cleanupTempFiles = async (filePaths) => {
  await Promise.all(
    filePaths.map(async (filePath) => {
      try {
        if (fsSync.existsSync(filePath)) {
          await fs.unlink(filePath);
          console.log(`🗑️  Cleaned up: ${path.basename(filePath)}`);
        }
      } catch (error) {
        console.error(`⚠️  Failed to cleanup ${filePath}:`, error.message);
      }
    })
  );
};

/**
 * Check if text contains allowed external links.
 */
const containsAllowedExternalLinks = (text) => {
  const urlRegex = /(https?:\/\/[^\s]+)/g;
  const urls = text.match(urlRegex) || [];

  for (const url of urls) {
    const isAllowed = ALLOWED_EXTERNAL_SERVICES.some(service =>
      url.toLowerCase().includes(service)
    );
    if (isAllowed) return { allowed: true, urls };
  }

  return { allowed: false, urls };
};

/**
 * Validate conversation access and return populated conversation.
 */
const validateConversationAccess = async (conversationId, userId) => {
  const conversation = await Conversation.findById(conversationId)
    .populate('participants.userId', 'fullname username userType email profilePic status');

  if (!conversation)
    return { valid: false, error: 'Conversation not found', conversation: null };

  if (conversation.status === 'deleted' || conversation.status === 'blocked')
    return { valid: false, error: 'Conversation is not available', conversation: null };

  if (!conversation.isParticipant(userId))
    return { valid: false, error: 'You are not a participant in this conversation', conversation: null };

  const currentParticipant = conversation.participants.find(p => {
    const pUserId = p.userId._id || p.userId;
    return pUserId.toString() === userId.toString();
  });

  if (currentParticipant?.isDeleted)
    return { valid: false, error: 'You have deleted this conversation', conversation: null };

  return { valid: true, conversation };
};

/**
 * Get the other participant for a direct conversation.
 */
const getRecipient = (conversation, currentUserId) => {
  if (conversation.type !== 'direct') return null;
  const recipientParticipant = conversation.getOtherParticipant(currentUserId);
  return recipientParticipant?.userId ?? null;
};

/**
 * Emit a socket event to a user room safely — never throws.
 */
const emitSocketEvent = (eventName, recipientId, data) => {
  try {
    const io = getIO();
    io.to(recipientId.toString()).emit(eventName, data);
    console.log(`📡 Socket event sent: ${eventName} → ${recipientId}`);
  } catch (error) {
    console.error(`⚠️  Socket emission failed for ${eventName}:`, error.message);
  }
};

/**
 * Broadcast an event to a conversation room, optionally excluding one user.
 */
const broadcastToConversation = (eventName, conversationId, data, excludeUserId = null) => {
  try {
    const io = getIO();
    if (excludeUserId) {
      io.to(conversationId.toString()).except(excludeUserId.toString()).emit(eventName, data);
    } else {
      io.to(conversationId.toString()).emit(eventName, data);
    }
    console.log(`📡 Broadcast: ${eventName} → conversation ${conversationId}`);
  } catch (error) {
    console.error(`⚠️  Broadcast failed for ${eventName}:`, error.message);
  }
};

// ═════════════════════════════════════════════════════════════
// ASYNC HANDLER
// ═════════════════════════════════════════════════════════════

const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch((error) => {
    console.error('❌ Controller Error:', error);
    console.error('Stack:', error.stack);
    return serverErrorResponse(res, error);
  });
};

// ═════════════════════════════════════════════════════════════
// 📤 SEND MESSAGE
// ═════════════════════════════════════════════════════════════

export const sendMessage = asyncHandler(async (req, res) => {
  const currentUserId = req.user._id;
  const currentUser   = req.user;
  const { conversationId, text, replyToId } = req.body;

  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('📤 [SEND MESSAGE - SMART MODE]');
  console.log(`👤 Sender: ${currentUser.fullname} (${currentUser.userType})`);
  console.log(`💬 Conversation: ${conversationId}`);
  console.log(`📝 Text: ${text ? `"${text.substring(0, 50)}..."` : 'None'}`);
  console.log(`📎 Files: ${req.files?.length || 0}`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  // ── Smart type detection ─────────────────────────────────
  let messageType = 'text';
  const detectedFiles = { images: [], videos: [], documents: [] };

  if (req.files && req.files.length > 0) {
    for (const file of req.files) {
      console.log(`   📄 ${file.originalname} | ${file.mimetype} | ${(file.size / 1024 / 1024).toFixed(2)}MB`);
      if      (file.mimetype.startsWith('image/')) detectedFiles.images.push(file);
      else if (file.mimetype.startsWith('video/')) detectedFiles.videos.push(file);
      else                                          detectedFiles.documents.push(file);
    }

    if      (detectedFiles.images.length    > 0) messageType = 'image';
    else if (detectedFiles.videos.length    > 0) messageType = 'video';
    else if (detectedFiles.documents.length > 0) messageType = 'file';

    console.log(`✅ Detected type: ${messageType.toUpperCase()}`);
  } else if (!text?.trim()) {
    return badRequestResponse(res, '❌ Please provide either a message or files');
  }

  // ── Validate conversation access ─────────────────────────
  const { valid, error, conversation } = await validateConversationAccess(conversationId, currentUserId);
  if (!valid) return forbiddenResponse(res, `❌ ${error}`);

  console.log('✅ Conversation access validated');

  // ── Validate recipient (direct chats) ───────────────────
  const recipient = getRecipient(conversation, currentUserId);

  if (conversation.type === 'direct') {
    if (!recipient) return serverErrorResponse(res, null, 'Could not identify recipient');

    console.log(`👥 Recipient: ${recipient.fullname}`);

    const canChat = await chatValidationService.canUsersChat(currentUserId, recipient._id);
    if (!canChat.allowed) return forbiddenResponse(res, canChat.reason);
  }

  // ── Initialise message data ──────────────────────────────
  let messageData = {
    conversationId,
    senderId:   currentUserId,
    senderType: currentUser.userType,
    messageType,
    status:     'sending',
    isDeleted:  false
  };

  const warnings  = [];
  const tempFiles = [];

  try {

    // ── TEXT ────────────────────────────────────────────────
    if (messageType === 'text') {
      if (!text?.trim())
        return badRequestResponse(res, '❌ Message text is required');
      if (text.length > MAX_TEXT_LENGTH)
        return badRequestResponse(res, `❌ Message too long (max ${MAX_TEXT_LENGTH} characters)`);

      const linkCheck  = containsAllowedExternalLinks(text);
      const validation = await chatSecurityService.validateTextMessage(text);

      if (validation.blocked && !linkCheck.allowed) return badRequestResponse(res, validation.reason);
      if (validation.warning) warnings.push(validation.warning);

      messageData.content = { text: text.trim() };

      if (replyToId) {
        const replyToMessage = await Message.findById(replyToId);
        if (!replyToMessage)
          return badRequestResponse(res, '❌ Reply message not found');
        if (replyToMessage.conversationId.toString() !== conversationId)
          return badRequestResponse(res, '❌ Cannot reply to message from different conversation');

        messageData.replyTo = {
          messageId:   replyToMessage._id,
          senderId:    replyToMessage.senderId,
          content:     replyToMessage.content,
          messageType: replyToMessage.messageType,
          createdAt:   replyToMessage.createdAt
        };
      }
    }

    // ── IMAGES ──────────────────────────────────────────────
    else if (messageType === 'image') {
      const imageFiles = detectedFiles.images;
      if (imageFiles.length === 0)
        return badRequestResponse(res, '❌ No valid images found');
      if (imageFiles.length > MAX_IMAGES_PER_MESSAGE)
        return badRequestResponse(res, `❌ Maximum ${MAX_IMAGES_PER_MESSAGE} images per message`);

      const uploadedImages = [];

      for (const file of imageFiles) {
        if (file.size > MAX_IMAGE_SIZE)
          return badRequestResponse(res, `❌ Image "${file.originalname}" exceeds ${MAX_IMAGE_SIZE / 1024 / 1024}MB`);

        const imageValidation = await chatSecurityService.validateImageMessage(file.buffer, text);
        if (imageValidation.blocked) return badRequestResponse(res, imageValidation.reason);
        if (imageValidation.warnings?.length) warnings.push(...imageValidation.warnings);

        const compressedBuffer = await sharp(file.buffer)
          .resize(IMAGE_MAX_DIMENSION, IMAGE_MAX_DIMENSION, { fit: 'inside', withoutEnlargement: true })
          .jpeg({ quality: IMAGE_QUALITY, mozjpeg: true })
          .toBuffer();

        const thumbnailBuffer = await sharp(file.buffer)
          .resize(THUMBNAIL_SIZE, THUMBNAIL_SIZE, { fit: 'cover' })
          .jpeg({ quality: THUMBNAIL_QUALITY })
          .toBuffer();

        const timestamp     = Date.now();
        const sanitizedName = file.originalname.replace(/[^a-zA-Z0-9.-]/g, '_');
        const mainKey       = `chat/images/${currentUserId}/${timestamp}-${sanitizedName}`;
        const thumbKey      = `chat/images/thumbnails/${currentUserId}/${timestamp}-thumb-${sanitizedName}`;

        const [mainUrl, thumbUrl] = await Promise.all([
          uploadToR2(compressedBuffer, mainKey,  file.mimetype),
          uploadToR2(thumbnailBuffer,  thumbKey, 'image/jpeg')
        ]);

        const metadata = await sharp(file.buffer).metadata();

        uploadedImages.push({
          url: mainUrl,  key: mainKey,
          thumbnail: thumbUrl, thumbnailKey: thumbKey,
          size: compressedBuffer.length, originalSize: file.size,
          mimeType: file.mimetype,
          width: metadata.width, height: metadata.height,
          format: metadata.format,
          caption: text || null,
          uploadedAt: new Date()
        });
      }

      messageData.images = uploadedImages;
      if (text?.trim()) messageData.content = { text: text.trim() };
    }

    // ── VIDEO ───────────────────────────────────────────────
    else if (messageType === 'video') {
      const videoFile = detectedFiles.videos[0];
      if (!videoFile)
        return badRequestResponse(res, '❌ No valid video found');
      if (videoFile.size > MAX_VIDEO_SIZE)
        return badRequestResponse(res, `❌ Video exceeds ${MAX_VIDEO_SIZE / 1024 / 1024}MB`);

      const tempDir       = process.env.TEMP_DIR || '/tmp';
      const tempPath      = path.join(tempDir, `temp-video-${Date.now()}-${videoFile.originalname}`);
      const thumbnailPath = path.join(tempDir, `thumb-${Date.now()}.jpg`);

      tempFiles.push(tempPath, thumbnailPath);
      await fs.writeFile(tempPath, videoFile.buffer);

      let duration = 0;
      try {
        duration = await new Promise((resolve, reject) => {
          ffmpeg.ffprobe(tempPath, (err, meta) => {
            if (err) reject(err);
            else     resolve(meta.format.duration || 0);
          });
        });
      } catch (e) {
        console.warn('⚠️  Could not get video duration:', e.message);
      }

      const videoValidation = await chatSecurityService.validateVideoMessage(
        videoFile.buffer, text, { duration }
      );
      if (videoValidation.blocked) return badRequestResponse(res, videoValidation.reason);
      if (videoValidation.warnings?.length) warnings.push(...videoValidation.warnings);

      let thumbnailBuffer = null;
      try {
        await new Promise((resolve, reject) => {
          ffmpeg(tempPath)
            .screenshots({
              timestamps: [duration > 1 ? '00:00:01' : '00:00:00'],
              filename: path.basename(thumbnailPath),
              folder:   path.dirname(thumbnailPath),
              size:     `${THUMBNAIL_SIZE}x${THUMBNAIL_SIZE}`
            })
            .on('end',   resolve)
            .on('error', reject);
        });
        if (fsSync.existsSync(thumbnailPath)) {
          thumbnailBuffer = await fs.readFile(thumbnailPath);
        }
      } catch (e) {
        console.warn('⚠️  Could not generate thumbnail:', e.message);
      }

      const timestamp     = Date.now();
      const sanitizedName = videoFile.originalname.replace(/[^a-zA-Z0-9.-]/g, '_');
      const videoKey      = `chat/videos/${currentUserId}/${timestamp}-${sanitizedName}`;
      const thumbKey      = `chat/videos/thumbnails/${currentUserId}/${timestamp}-thumb.jpg`;

      const videoUrl = await uploadToR2(videoFile.buffer, videoKey, videoFile.mimetype);
      const thumbUrl = thumbnailBuffer
        ? await uploadToR2(thumbnailBuffer, thumbKey, 'image/jpeg')
        : null;

      messageData.videos = [{
        url: videoUrl,  key: videoKey,
        thumbnail: thumbUrl, thumbnailKey: thumbUrl ? thumbKey : null,
        size: videoFile.size, mimeType: videoFile.mimetype,
        duration: Math.round(duration),
        caption:  text || null,
        uploadedAt: new Date(),
        processingStatus: 'completed'
      }];

      if (text?.trim()) messageData.content = { text: text.trim() };
    }

    // ── FILES ───────────────────────────────────────────────
    else if (messageType === 'file') {
      const documentFiles = detectedFiles.documents;
      if (documentFiles.length === 0)
        return badRequestResponse(res, '❌ No valid files found');
      if (documentFiles.length > MAX_FILES_PER_MESSAGE)
        return badRequestResponse(res, `❌ Maximum ${MAX_FILES_PER_MESSAGE} files per message`);

      const uploadedFiles = [];

      for (const file of documentFiles) {
        if (file.size > MAX_FILE_SIZE)
          return badRequestResponse(res, `❌ File "${file.originalname}" exceeds ${MAX_FILE_SIZE / 1024 / 1024}MB`);

        const fileValidation = await chatSecurityService.validateFileMessage(
          file.buffer, file.originalname, file.mimetype
        );
        if (fileValidation.blocked) return badRequestResponse(res, fileValidation.reason);
        if (fileValidation.warnings?.length) warnings.push(...fileValidation.warnings);

        const timestamp     = Date.now();
        const sanitizedName = file.originalname.replace(/[^a-zA-Z0-9.-]/g, '_');
        const fileKey       = `chat/files/${currentUserId}/${timestamp}-${sanitizedName}`;
        const fileUrl       = await uploadToR2(file.buffer, fileKey, file.mimetype);

        uploadedFiles.push({
          url: fileUrl, key: fileKey,
          fileName: file.originalname,
          size: file.size, mimeType: file.mimetype,
          uploadedAt: new Date()
        });
      }

      messageData.files = uploadedFiles;
      if (text?.trim()) messageData.content = { text: text.trim() };
    }

  } catch (processingError) {
    // ✅ FIX (Bug 3): Do NOT call cleanupTempFiles here.
    // The finally block below always runs — calling cleanup in BOTH catch
    // and finally means two unlink attempts on every error path.
    // cleanupTempFiles is idempotent (existsSync guard), so it won't crash,
    // but it adds unnecessary I/O. Keep cleanup in ONE place: finally.
    console.error('❌ Message processing error:', processingError);
    return serverErrorResponse(res, processingError, 'Failed to process message');
  } finally {
    // Runs on success AND on every error — single, authoritative cleanup point.
    if (tempFiles.length > 0) await cleanupTempFiles(tempFiles);
  }

  // ── Save to DB ───────────────────────────────────────────
  messageData.status      = 'sent';
  messageData.deliveredTo = [];
  messageData.readBy      = [];

  const message = await Message.create(messageData);
  await message.populate('senderId', 'fullname username userType email profilePic');

  console.log(`✅ Message saved: ${message._id}`);

  // ── Update conversation ──────────────────────────────────
  try {
    let lastMessageText = text?.trim() || '';
    if (!lastMessageText) {
      const previews = {
        image: `📷 ${detectedFiles.images.length > 1 ? `${detectedFiles.images.length} Photos` : 'Photo'}`,
        video: '🎥 Video',
        file:  `📎 ${detectedFiles.documents.length > 1 ? `${detectedFiles.documents.length} Files` : 'File'}`
      };
      lastMessageText = previews[messageType] || 'Message';
    }

    await conversation.updateLastMessage({
      text: lastMessageText, senderId: currentUserId,
      messageType, createdAt: message.createdAt
    });

    conversation.participants.forEach(participant => {
      const pUserId = participant.userId._id || participant.userId;
      if (pUserId.toString() !== currentUserId.toString() && !participant.isDeleted) {
        participant.unreadCount = (participant.unreadCount || 0) + 1;
      }
    });

    await conversation.save();
  } catch (convError) {
    console.error('⚠️  Failed to update conversation:', convError.message);
  }

  // ── Real-time notifications ──────────────────────────────
  const messagePayload = {
    message: message.toObject(),
    conversationId: conversation._id,
    conversation: {
      _id:         conversation._id,
      type:        conversation.type,
      lastMessage: conversation.lastMessage
    },
    ...(warnings.length > 0 && { warnings })
  };

  if (conversation.type === 'direct' && recipient) {
    emitSocketEvent('receive_message', recipient._id, {
      ...messagePayload,
      unreadCount: 1
    });
    emitSocketEvent('message_sent', currentUserId, {
      message: message.toObject(),
      conversationId: conversation._id
    });
  } else if (conversation.type === 'group') {
    broadcastToConversation('receive_message', conversation._id, messagePayload, currentUserId);
    emitSocketEvent('message_sent', currentUserId, {
      message: message.toObject(),
      conversationId: conversation._id
    });
  }

  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`✅ MESSAGE SENT: ${messageType.toUpperCase()}`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  return createdResponse(res, {
    message: message.toObject(),
    conversationId: conversation._id,
    detectedType: messageType,
    ...(warnings.length > 0 && { warnings })
  }, `✅ ${messageType.charAt(0).toUpperCase() + messageType.slice(1)} message sent successfully`);
});

// ═════════════════════════════════════════════════════════════
// 📥 GET MESSAGES
// ═════════════════════════════════════════════════════════════

export const getMessages = asyncHandler(async (req, res) => {
  const currentUserId      = req.user._id;
  const { conversationId } = req.params;
  const { page = 1, limit = 50, before } = req.query;

  console.log('\n📥 [GET MESSAGES]');
  console.log(`👤 User: ${req.user.fullname} | Conversation: ${conversationId} | Page: ${page}`);

  const { valid, error, conversation } = await validateConversationAccess(conversationId, currentUserId);
  if (!valid) return forbiddenResponse(res, `❌ ${error}`);

  const limitInt = Math.min(parseInt(limit), 100);

  // ✅ FIX (Bug 1): `before` cursor — use $lt, NOT $gt.
  //
  // "before" means "give me messages that came BEFORE this ID" i.e. older
  // messages for scroll-up / infinite-scroll-upward pagination.
  //
  // With ascending sort (createdAt: 1, oldest first):
  //   $lt  →  messages with smaller _id  →  older messages  ← CORRECT
  //   $gt  →  messages with larger  _id  →  newer messages  ← WRONG
  //
  // The previous version used $gt with a comment claiming it was the "fix",
  // but that loads NEWER messages, the opposite of what "before" means.
  const query = {
    conversationId,
    isDeleted: false,
    ...(before && { _id: { $lt: before } })   // ← $lt: older messages before the cursor
  };

  const messages = await Message.find(query)
    .populate('senderId', 'fullname username userType email profilePic')
    .populate({
      path: 'replyTo.messageId',
      select: 'content messageType senderId createdAt',
      populate: {
        path:   'senderId',
        select: 'fullname username profilePic userType'
      }
    })
    .sort({ createdAt: -1 })   // oldest → newest within the fetched window
    .limit(limitInt)
    .lean();

  console.log(`✅ Retrieved ${messages.length} messages`);
  messages.reverse();



// TO ✅
const enrichSenderIds = [...new Set(messages.map(m => (m.senderId?._id ?? m.senderId)?.toString()).filter(Boolean))];

const [sClients, sEmployees] = await Promise.all([
  Client.find({ userId: { $in: enrichSenderIds } }).select('userId profilePic isPremium').lean(),
  Employee.find({ userId: { $in: enrichSenderIds } }).select('userId profilePic hasBadge badgeType badgeLabel blueVerified adminVerified').lean(),
]);
const sPicMap = {}, sBadgeMap = {};

sClients.forEach(doc => {
  const id = doc.userId.toString();
  if (doc.profilePic) sPicMap[id] = doc.profilePic;
  sBadgeMap[id] = {
    isPremium:    doc.isPremium ?? false,
    blueVerified: doc.isPremium ? { status: true, icon: 'verified', color: '#0066FF', bg: '#EBF5FF', label: 'Premium Member' } : { status: false },
    tier: doc.isPremium ? 'premium' : 'free',
  };
});

sEmployees.forEach(doc => {
  const id = doc.userId.toString();
  if (doc.profilePic) sPicMap[id] = doc.profilePic;
  const isPremium = doc.blueVerified?.status === true;
  sBadgeMap[id] = {
    badge: doc.hasBadge ? {
      show: true, type: doc.badgeType, label: doc.badgeLabel,
      icon:  doc.badgeType === 'blue-verified' ? 'verified'     : doc.badgeType === 'admin-verified' ? 'shield-check' : 'badge',
      color: doc.badgeType === 'blue-verified' ? '#0066FF'       : doc.badgeType === 'admin-verified' ? '#00B37E'      : '#888',
      bg:    doc.badgeType === 'blue-verified' ? '#EBF5FF'       : doc.badgeType === 'admin-verified' ? '#E6FAF5'      : '#f0f0f0',
    } : { show: false },
    blueVerified:  isPremium ? { status: true, icon: 'verified', color: '#0066FF', bg: '#EBF5FF', label: 'Premium Member' } : { status: false },
    adminVerified: { status: doc.adminVerified?.status ?? false },
    tier: isPremium ? 'premium' : doc.adminVerified?.status ? 'verified' : 'free',
  };
});

const enrichedMessages = messages.map(msg => {
  const sid = (msg.senderId?._id ?? msg.senderId)?.toString();
  return {
    ...msg,
    senderId: msg.senderId ? {
      ...msg.senderId,
      profilePic: sPicMap[sid] ?? msg.senderId.profilePic ?? null,
      ...(sBadgeMap[sid] ?? {}),
    } : msg.senderId,
  };
});



  // ── Mark unread messages as read ─────────────────────────
  try {
    const unreadMessageIds = messages
      .filter(msg => {
        const senderId = msg.senderId?._id ?? msg.senderId;
        return (
          senderId?.toString() !== currentUserId.toString() &&
          msg.status !== 'read' &&
          !msg.readBy?.map(id => id.toString()).includes(currentUserId.toString())
        );
      })
      .map(msg => msg._id);

    if (unreadMessageIds.length > 0) {
      console.log(`📖 Marking ${unreadMessageIds.length} messages as read`);

      await Message.updateMany(
        { _id: { $in: unreadMessageIds }, conversationId },
        { $set: { status: 'read' }, $addToSet: { readBy: currentUserId } }
      );

      await conversation.markAsRead(currentUserId);

      const currentParticipant = conversation.participants.find(p => {
        const pUserId = p.userId._id || p.userId;
        return pUserId.toString() === currentUserId.toString();
      });

      if (currentParticipant) {
        currentParticipant.unreadCount = 0;
        await conversation.save();
      }

      // ✅ FIX (Bug 2): ObjectId reference comparison with Array.includes()
      // always returns false — ObjectIds are objects, and === checks reference
      // identity, not value equality.  Without this fix, senders NEVER receive
      // read-receipt socket events no matter how many messages are read.
      //
      // Fix: convert both sides to strings before comparing.
      const unreadIdStrings = unreadMessageIds.map(id => id.toString());

      const senderIds = [
        ...new Set(
          messages
            .filter(msg => unreadIdStrings.includes(msg._id.toString()))  // ← string comparison
            .map(msg => (msg.senderId?._id ?? msg.senderId).toString())
        )
      ];

      senderIds.forEach(senderId => {
        emitSocketEvent('messages_read', senderId, {
          conversationId,
          readBy : currentUserId,
          readAt : new Date()
        });
      });
    }
  } catch (readError) {
    console.error('⚠️  Failed to mark messages as read:', readError.message);
  }

  // ── Pagination ────────────────────────────────────────────
  const totalMessages = await Message.countDocuments({ conversationId, isDeleted: false });

  // ✅ FIX (Bug 4): Replace the flawed `fetchedUpTo` approach.
  //
  // Previous logic:
  //   fetchedUpTo = count of messages with createdAt <= last fetched message
  //   hasMore     = fetchedUpTo < totalMessages
  //
  // Problem: this tells you if there are NEWER messages after the window,
  // but our cursor (`before`) paginates BACKWARD (older messages). So we
  // need to know if there are older messages BEFORE the oldest one returned.
  //
  // Correct approach for backward cursor pagination:
  //   If we got a full page (messages.length === limitInt), assume there are
  //   more older messages. If we got fewer, we've reached the beginning.
  //
  // For the very first load (no `before` cursor), hasMore tells the client
  // whether scroll-up will yield more messages.
  const hasMore         = messages.length === limitInt;
  const oldestMessageId = messages.length > 0 ? messages[0]._id              : null;
  const newestMessageId = messages.length > 0 ? messages[messages.length - 1]._id : null;

  console.log(`📊 Total: ${totalMessages} | Fetched: ${messages.length} | hasMore: ${hasMore}\n`);

  return successResponse(res, {
    messages: enrichedMessages,
    pagination: {
      page:    parseInt(page),
      limit:   limitInt,
      total:   totalMessages,
      pages:   Math.ceil(totalMessages / limitInt),
      hasMore,
      before:  oldestMessageId,    // pass this as `before` to load older messages
      after:   newestMessageId     // newest message ID in this window
    }
  }, '✅ Messages retrieved successfully');
});

// ═════════════════════════════════════════════════════════════
// 🗑️ DELETE MESSAGE
// ═════════════════════════════════════════════════════════════

export const deleteMessage = asyncHandler(async (req, res) => {
  const currentUserId = req.user._id;
  const { messageId }  = req.params;

  const message = await Message.findById(messageId)
    .populate('senderId', 'fullname username');

  if (!message)          return notFoundResponse(res, '❌ Message not found');
  if (message.isDeleted) return badRequestResponse(res, '❌ Message already deleted');

  if (message.senderId._id.toString() !== currentUserId.toString())
    return forbiddenResponse(res, '❌ You can only delete your own messages');

  message.isDeleted = true;
  message.deletedAt = new Date();
  message.deletedBy = currentUserId;
  await message.save();

  broadcastToConversation('message_deleted', message.conversationId, {
    messageId:      message._id,
    conversationId: message.conversationId,
    deletedBy:      currentUserId,
    deletedAt:      message.deletedAt
  });

  return successResponse(res, {
    messageId: message._id,
    deletedAt: message.deletedAt
  }, '✅ Message deleted successfully');
});

// ═════════════════════════════════════════════════════════════
// ✏️ EDIT MESSAGE
// ═════════════════════════════════════════════════════════════

export const editMessage = asyncHandler(async (req, res) => {
  const currentUserId = req.user._id;
  const { messageId }  = req.params;
  const { text }       = req.body;

  if (!text?.trim())
    return badRequestResponse(res, '❌ Message text is required');
  if (text.length > MAX_TEXT_LENGTH)
    return badRequestResponse(res, `❌ Message too long (max ${MAX_TEXT_LENGTH} characters)`);

  const message = await Message.findById(messageId)
    .populate('senderId', 'fullname username');

  if (!message)          return notFoundResponse(res, '❌ Message not found');
  if (message.isDeleted) return badRequestResponse(res, '❌ Cannot edit deleted message');

  if (message.senderId._id.toString() !== currentUserId.toString())
    return forbiddenResponse(res, '❌ You can only edit your own messages');

  if (message.messageType !== 'text')
    return badRequestResponse(res, '❌ Only text messages can be edited');

  const linkCheck  = containsAllowedExternalLinks(text);
  const validation = await chatSecurityService.validateTextMessage(text);
  if (validation.blocked && !linkCheck.allowed) return badRequestResponse(res, validation.reason);

  message.content.text = text.trim();
  message.isEdited     = true;
  message.editedAt     = new Date();
  await message.save();

  broadcastToConversation('message_edited', message.conversationId, {
    messageId:      message._id,
    conversationId: message.conversationId,
    newText:        message.content.text,
    editedAt:       message.editedAt,
    editedBy:       currentUserId
  });

  return successResponse(res, {
    message: message.toObject(),
    ...(validation.warning && { warning: validation.warning })
  }, '✅ Message edited successfully');
});

// ═════════════════════════════════════════════════════════════
// 😊 ADD REACTION
// ═════════════════════════════════════════════════════════════

export const addReaction = asyncHandler(async (req, res) => {
  const currentUserId = req.user._id;
  const { messageId }  = req.params;
  const { emoji }      = req.body;

  if (!emoji || typeof emoji !== 'string' || emoji.length > 10)
    return badRequestResponse(res, '❌ Invalid emoji');

  const message = await Message.findById(messageId);
  if (!message)          return notFoundResponse(res, '❌ Message not found');
  if (message.isDeleted) return badRequestResponse(res, '❌ Cannot react to deleted message');

  const { valid } = await validateConversationAccess(message.conversationId, currentUserId);
  if (!valid) return forbiddenResponse(res, '❌ You are not a participant in this conversation');

  if (typeof message.addReaction === 'function') {
    await message.addReaction(currentUserId, emoji);
  } else {
    if (!message.reactions) message.reactions = [];

    const existing = message.reactions.find(r =>
      r.userId.toString() === currentUserId.toString() && r.emoji === emoji
    );
    if (existing) return badRequestResponse(res, '❌ You already reacted with this emoji');

    message.reactions.push({ userId: currentUserId, emoji, createdAt: new Date() });
    await message.save();
  }

  broadcastToConversation('reaction_added', message.conversationId, {
    messageId:      message._id,
    conversationId: message.conversationId,
    userId:         currentUserId,
    emoji,
    reactions:      message.reactions
  });

  return successResponse(res, { reactions: message.reactions }, '✅ Reaction added successfully');
});

// ═════════════════════════════════════════════════════════════
// 📊 GET MEDIA
// ═════════════════════════════════════════════════════════════

export const getMedia = asyncHandler(async (req, res) => {
  const currentUserId      = req.user._id;
  const { conversationId } = req.params;
  const { type = 'all', page = 1, limit = 20 } = req.query;

  const { valid, error } = await validateConversationAccess(conversationId, currentUserId);
  if (!valid) return forbiddenResponse(res, `❌ ${error}`);

  const typeMap = {
    all:    { $in: ['image', 'video', 'file'] },
    images: 'image',
    videos: 'video',
    files:  'file'
  };
  if (!typeMap[type])
    return badRequestResponse(res, '❌ Invalid type. Allowed: all, images, videos, files');

  const limitInt = Math.min(parseInt(limit), 100);
  const skip     = (parseInt(page) - 1) * limitInt;

  const query = { conversationId, isDeleted: false, messageType: typeMap[type] };

  const [media, total] = await Promise.all([
    Message.find(query)
      .populate('senderId', 'fullname username userType profilePic')
      .select('senderId messageType images videos files content createdAt')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limitInt)
      .lean(),
    Message.countDocuments(query)
  ]);

  // ── Enrich sender profilePic + badge ─────────────────────
  const mediaSenderIds = [...new Set(media.map(m => (m.senderId?._id ?? m.senderId)?.toString()).filter(Boolean))];

  const [mClients, mEmployees] = await Promise.all([
    Client.find({ userId: { $in: mediaSenderIds } }).select('userId profilePic isPremium').lean(),
    Employee.find({ userId: { $in: mediaSenderIds } }).select('userId profilePic hasBadge badgeType badgeLabel blueVerified adminVerified').lean(),
  ]);

  const mPicMap = {}, mBadgeMap = {};

  mClients.forEach(doc => {
    const id = doc.userId.toString();
    if (doc.profilePic) mPicMap[id] = doc.profilePic;
    mBadgeMap[id] = {
      isPremium:    doc.isPremium ?? false,
      blueVerified: doc.isPremium ? { status: true, icon: 'verified', color: '#0066FF', bg: '#EBF5FF', label: 'Premium Member' } : { status: false },
      tier: doc.isPremium ? 'premium' : 'free',
    };
  });

  mEmployees.forEach(doc => {
    const id = doc.userId.toString();
    if (doc.profilePic) mPicMap[id] = doc.profilePic;
    const isPremium = doc.blueVerified?.status === true;
    mBadgeMap[id] = {
      badge: doc.hasBadge ? {
        show: true, type: doc.badgeType, label: doc.badgeLabel,
        icon:  doc.badgeType === 'blue-verified' ? 'verified'     : doc.badgeType === 'admin-verified' ? 'shield-check' : 'badge',
        color: doc.badgeType === 'blue-verified' ? '#0066FF'       : doc.badgeType === 'admin-verified' ? '#00B37E'      : '#888',
        bg:    doc.badgeType === 'blue-verified' ? '#EBF5FF'       : doc.badgeType === 'admin-verified' ? '#E6FAF5'      : '#f0f0f0',
      } : { show: false },
      blueVerified:  isPremium ? { status: true, icon: 'verified', color: '#0066FF', bg: '#EBF5FF', label: 'Premium Member' } : { status: false },
      adminVerified: { status: doc.adminVerified?.status ?? false },
      tier: isPremium ? 'premium' : doc.adminVerified?.status ? 'verified' : 'free',
    };
  });

  const enrichedMedia = media.map(msg => {
    const sid = (msg.senderId?._id ?? msg.senderId)?.toString();
    return {
      ...msg,
      senderId: msg.senderId ? {
        ...msg.senderId,
        profilePic: mPicMap[sid] ?? msg.senderId.profilePic ?? null,
        ...(mBadgeMap[sid] ?? {}),
      } : msg.senderId,
    };
  });

  return successResponse(res, {
    media: enrichedMedia,
    pagination: {
      page:    parseInt(page),
      limit:   limitInt,
      total,
      pages:   Math.ceil(total / limitInt),
      hasMore: skip + media.length < total
    }
  }, '✅ Media retrieved successfully');
});

// ═════════════════════════════════════════════════════════════
// 🔍 SEARCH MESSAGES
// ═════════════════════════════════════════════════════════════

export const searchMessages = asyncHandler(async (req, res) => {
  const currentUserId      = req.user._id;
  const { conversationId } = req.params;
  const { query, page = 1, limit = 20 } = req.query;

  if (!query || query.trim().length < 2)
    return badRequestResponse(res, '❌ Search query must be at least 2 characters');

  const { valid, error } = await validateConversationAccess(conversationId, currentUserId);
  if (!valid) return forbiddenResponse(res, `❌ ${error}`);

  const limitInt = Math.min(parseInt(limit), 100);
  const skip     = (parseInt(page) - 1) * limitInt;

  const searchQuery = {
    conversationId,
    isDeleted:      false,
    'content.text': { $regex: query.trim(), $options: 'i' }
  };

  const [messages, total] = await Promise.all([
    Message.find(searchQuery)
      .populate('senderId', 'fullname username userType profilePic')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limitInt)
      .lean(),
    Message.countDocuments(searchQuery)
  ]);

  // ── Enrich sender profilePic + badge ─────────────────────
  const searchMsgSenderIds = [...new Set(messages.map(m => (m.senderId?._id ?? m.senderId)?.toString()).filter(Boolean))];

  const [smClients, smEmployees] = await Promise.all([
    Client.find({ userId: { $in: searchMsgSenderIds } }).select('userId profilePic isPremium').lean(),
    Employee.find({ userId: { $in: searchMsgSenderIds } }).select('userId profilePic hasBadge badgeType badgeLabel blueVerified adminVerified').lean(),
  ]);

  const smPicMap = {}, smBadgeMap = {};

  smClients.forEach(doc => {
    const id = doc.userId.toString();
    if (doc.profilePic) smPicMap[id] = doc.profilePic;
    smBadgeMap[id] = {
      isPremium:    doc.isPremium ?? false,
      blueVerified: doc.isPremium ? { status: true, icon: 'verified', color: '#0066FF', bg: '#EBF5FF', label: 'Premium Member' } : { status: false },
      tier: doc.isPremium ? 'premium' : 'free',
    };
  });

  smEmployees.forEach(doc => {
    const id = doc.userId.toString();
    if (doc.profilePic) smPicMap[id] = doc.profilePic;
    const isPremium = doc.blueVerified?.status === true;
    smBadgeMap[id] = {
      badge: doc.hasBadge ? {
        show: true, type: doc.badgeType, label: doc.badgeLabel,
        icon:  doc.badgeType === 'blue-verified' ? 'verified'     : doc.badgeType === 'admin-verified' ? 'shield-check' : 'badge',
        color: doc.badgeType === 'blue-verified' ? '#0066FF'       : doc.badgeType === 'admin-verified' ? '#00B37E'      : '#888',
        bg:    doc.badgeType === 'blue-verified' ? '#EBF5FF'       : doc.badgeType === 'admin-verified' ? '#E6FAF5'      : '#f0f0f0',
      } : { show: false },
      blueVerified:  isPremium ? { status: true, icon: 'verified', color: '#0066FF', bg: '#EBF5FF', label: 'Premium Member' } : { status: false },
      adminVerified: { status: doc.adminVerified?.status ?? false },
      tier: isPremium ? 'premium' : doc.adminVerified?.status ? 'verified' : 'free',
    };
  });

  const enrichedSearchMessages = messages.map(msg => {
    const sid = (msg.senderId?._id ?? msg.senderId)?.toString();
    return {
      ...msg,
      senderId: msg.senderId ? {
        ...msg.senderId,
        profilePic: smPicMap[sid] ?? msg.senderId.profilePic ?? null,
        ...(smBadgeMap[sid] ?? {}),
      } : msg.senderId,
    };
  });

  return successResponse(res, {
    messages: enrichedSearchMessages,
    query: query.trim(),
    pagination: {
      page:  parseInt(page),
      limit: limitInt,
      total,
      pages: Math.ceil(total / limitInt)
    }
  }, `✅ Found ${total} matching messages`);
});