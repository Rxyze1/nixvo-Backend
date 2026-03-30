// Services/Chat/chatSecurityService.js

import messageValidationService from '../Security/messageValidationService.js';
import ImageValidator from '../Security/ImageValidator.js';

/**
 * ════════════════════════════════════════════════════════════════
 *              🛡️ CHAT SECURITY SERVICE
 *     Orchestrates all chat validation (text, images, videos, files)
 * ════════════════════════════════════════════════════════════════
 */

class ChatSecurityService {
  
  constructor() {
    this.imageValidator = new ImageValidator();
    console.log('🛡️ Chat Security Service initialized');
    console.log('   ✅ Message Validator: Loaded');
    console.log('   ✅ Image Validator: Loaded');
  }

  // ═══════════════════════════════════════════════════════════════
  // 📝 VALIDATE TEXT MESSAGE
  // ═══════════════════════════════════════════════════════════════
  
  async validateTextMessage(text) {
    console.log('\n📝 [Chat Security] Validating text message...');
    
    try {
      // ✅ Use the dedicated message validation service
      const result = await messageValidationService.validateMessage(text);
      
      // Transform response to match expected format
      return {
        allowed: result.allowed,
        blocked: result.blocked,
        reason: result.reason,
        warning: result.warning,
        action: result.action,
        layer: result.layer,
        hasLinks: result.hasLinks,
        allowedLinks: result.cloudLinks,
        unknownLinks: result.unknownLinks,
        blockedLinks: result.blockedLinks,
        contactInfo: result.contactInfo,
        confidence: result.aiValidation?.confidence,
        validationDetails: result.aiValidation,
        cached: result.cached
      };
      
    } catch (error) {
      console.error('❌ Chat validation error:', error);
      
      // Fail-safe: Allow but flag for review
      return {
        allowed: true,
        blocked: false,
        warning: '⚠️ Message sent but flagged for review',
        reason: 'Validation error - message allowed but logged',
        error: error.message,
        needsReview: true,
        action: 'ALLOW_WITH_FLAG'
      };
    }
  }

  // ═══════════════════════════════════════════════════════════════
  // 🖼️ VALIDATE IMAGE MESSAGE
  // ═══════════════════════════════════════════════════════════════
  
  async validateImageMessage(imageBuffer, caption = null) {
    console.log('\n🖼️ [Chat Security] Validating image message...');
    
    try {
      const results = {
        image: null,
        caption: null,
        overall: {
          allowed: true,
          blocked: false,
          warnings: []
        }
      };
      
      // ═════════════════════════════════════════════════════════════
      // STEP 1: Validate image content
      // ═════════════════════════════════════════════════════════════
      console.log('📸 Validating image content...');
      const imageValidation = await this.imageValidator.validate(imageBuffer, {
        isProfilePic: false,
        context: 'chat'
      });
      
      results.image = imageValidation;
      
      console.log(`📊 Image validation:`, {
        blocked: imageValidation.blocked,
        confidence: imageValidation.confidence,
        hasText: !!imageValidation.ocrResult?.text
      });
      
      // ⚠️ Image has text but not blocked (low confidence)
      if (imageValidation.ocrResult?.text && 
          imageValidation.confidence > 30 && 
          !imageValidation.blocked) {
        results.overall.warnings.push(
          '⚠️ Image contains text. For your security, avoid sharing personal contact information.'
        );
      }
      
      // ❌ Image blocked
      if (imageValidation.blocked) {
        console.log('🚫 Image blocked by validator');
        return {
          allowed: false,
          blocked: true,
          reason: imageValidation.reason,
          warning: '🚫 Image contains prohibited content (contact information or inappropriate content)',
          action: 'BLOCK',
          layer: 'image_validation',
          details: results
        };
      }
      
      // ═════════════════════════════════════════════════════════════
      // STEP 2: Validate caption if provided
      // ═════════════════════════════════════════════════════════════
      if (caption && caption.trim()) {
        console.log('📝 Validating image caption...');
        const captionValidation = await this.validateTextMessage(caption);
        results.caption = captionValidation;
        
        // ❌ Caption blocked
        if (captionValidation.blocked) {
          console.log('🚫 Caption blocked');
          return {
            allowed: false,
            blocked: true,
            reason: 'Image caption contains prohibited content',
            warning: captionValidation.warning,
            action: 'BLOCK',
            layer: 'caption_validation',
            details: results
          };
        }
        
        // Add caption warnings
        if (captionValidation.warning) {
          results.overall.warnings.push(captionValidation.warning);
        }
      }
      
      // ✅ ALLOW - image and caption are safe
      console.log('✅ Image approved');
      
      return {
        allowed: true,
        blocked: false,
        warnings: results.overall.warnings,
        reason: 'Image approved',
        action: 'ALLOW',
        layer: 'all_checks_passed',
        details: results
      };
      
    } catch (error) {
      console.error('❌ Image validation error:', error);
      
      // Fail-safe: Allow but flag for review
      return {
        allowed: true,
        blocked: false,
        warning: '⚠️ Image sent but flagged for review',
        reason: 'Validation error - image allowed but logged',
        error: error.message,
        needsReview: true,
        action: 'ALLOW_WITH_FLAG'
      };
    }
  }

  // ═══════════════════════════════════════════════════════════════
  // 🎥 VALIDATE VIDEO MESSAGE
  // ═══════════════════════════════════════════════════════════════
  
  async validateVideoMessage(videoBuffer, caption = null, metadata = {}) {
    console.log('\n🎥 [Chat Security] Validating video message...');
    
    try {
      const results = {
        video: {
          size: videoBuffer.length,
          duration: metadata.duration || 0,
          sizeValid: true,
          durationValid: true
        },
        caption: null,
        overall: {
          allowed: true,
          blocked: false,
          warnings: []
        }
      };
      
      // ═════════════════════════════════════════════════════════════
      // STEP 1: Check video size (Max 400MB)
      // ═════════════════════════════════════════════════════════════
      const MAX_VIDEO_SIZE = 400 * 1024 * 1024; // 400MB
      
      if (videoBuffer.length > MAX_VIDEO_SIZE) {
        return {
          allowed: false,
          blocked: true,
          reason: `Video exceeds maximum size of 400MB (${(videoBuffer.length / (1024 * 1024)).toFixed(2)}MB)`,
          warning: '🚫 Video file too large',
          action: 'BLOCK',
          layer: 'size_validation'
        };
      }
      
      // ═════════════════════════════════════════════════════════════
      // STEP 2: Check video duration (Max 10 minutes)
      // ═════════════════════════════════════════════════════════════
      const MAX_DURATION = 600; // 10 minutes
      
      if (metadata.duration && metadata.duration > MAX_DURATION) {
        return {
          allowed: false,
          blocked: true,
          reason: `Video exceeds maximum duration of 10 minutes (${Math.round(metadata.duration / 60)}min)`,
          warning: '🚫 Video too long',
          action: 'BLOCK',
          layer: 'duration_validation'
        };
      }
      
      // ⚠️ Add warning for large videos
      const videoSizeMB = videoBuffer.length / (1024 * 1024);
      if (videoSizeMB > 100) {
        results.overall.warnings.push(
          `⚠️ Large video file (${videoSizeMB.toFixed(2)}MB). Upload may take time.`
        );
      }
      
      // ═════════════════════════════════════════════════════════════
      // STEP 3: Validate caption if provided
      // ═════════════════════════════════════════════════════════════
      if (caption && caption.trim()) {
        console.log('📝 Validating video caption...');
        const captionValidation = await this.validateTextMessage(caption);
        results.caption = captionValidation;
        
        // ❌ Caption blocked
        if (captionValidation.blocked) {
          return {
            allowed: false,
            blocked: true,
            reason: 'Video caption contains prohibited content',
            warning: captionValidation.warning,
            action: 'BLOCK',
            layer: 'caption_validation',
            details: results
          };
        }
        
        // Add caption warnings
        if (captionValidation.warning) {
          results.overall.warnings.push(captionValidation.warning);
        }
      }
      
      // ⚠️ General video warning
      results.overall.warnings.push(
        '⚠️ For your security, avoid sharing personal information in videos.'
      );
      
      // ✅ ALLOW - video passes all checks
      console.log('✅ Video approved');
      
      return {
        allowed: true,
        blocked: false,
        warnings: results.overall.warnings,
        reason: 'Video approved',
        action: 'ALLOW',
        layer: 'all_checks_passed',
        details: results
      };
      
    } catch (error) {
      console.error('❌ Video validation error:', error);
      
      // Fail-safe: Allow but flag for review
      return {
        allowed: true,
        blocked: false,
        warning: '⚠️ Video sent but flagged for review',
        reason: 'Validation error - video allowed but logged',
        error: error.message,
        needsReview: true,
        action: 'ALLOW_WITH_FLAG'
      };
    }
  }

  // ═══════════════════════════════════════════════════════════════
  // 📎 VALIDATE FILE MESSAGE
  // ═══════════════════════════════════════════════════════════════
  
  async validateFileMessage(fileBuffer, fileName, mimeType) {
    console.log('\n📎 [Chat Security] Validating file message...');
    
    try {
      // ═════════════════════════════════════════════════════════════
      // STEP 1: Check file size (Max 100MB for documents)
      // ═════════════════════════════════════════════════════════════
      const MAX_FILE_SIZE = 100 * 1024 * 1024; // 100MB
      
      if (fileBuffer.length > MAX_FILE_SIZE) {
        return {
          allowed: false,
          blocked: true,
          reason: `File exceeds maximum size of 100MB (${(fileBuffer.length / (1024 * 1024)).toFixed(2)}MB)`,
          warning: '🚫 File too large',
          action: 'BLOCK',
          layer: 'size_validation'
        };
      }
      
      // ═════════════════════════════════════════════════════════════
      // STEP 2: Check file type
      // ═════════════════════════════════════════════════════════════
      const ALLOWED_TYPES = [
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
      ];
      
      if (!ALLOWED_TYPES.includes(mimeType)) {
        return {
          allowed: false,
          blocked: true,
          reason: `File type not allowed: ${mimeType}`,
          warning: '🚫 Unsupported file type',
          action: 'BLOCK',
          layer: 'type_validation'
        };
      }
      
      // ═════════════════════════════════════════════════════════════
      // STEP 3: Check file name for suspicious content
      // ═════════════════════════════════════════════════════════════
      const DANGEROUS_EXTENSIONS = [
        '.exe', '.bat', '.cmd', '.sh', '.app', '.dmg', 
        '.scr', '.vbs', '.js', '.jar', '.msi', '.dll',
        '.com', '.pif', '.cpl', '.hta', '.ws', '.wsf'
      ];
      
      const fileExt = fileName.substring(fileName.lastIndexOf('.')).toLowerCase();
      
      if (DANGEROUS_EXTENSIONS.includes(fileExt)) {
        return {
          allowed: false,
          blocked: true,
          reason: 'Executable files are not allowed for security reasons',
          warning: '🚫 Dangerous file type',
          action: 'BLOCK',
          layer: 'extension_validation'
        };
      }
      
      // ✅ ALLOW - file passes all checks
      console.log('✅ File approved');
      
      return {
        allowed: true,
        blocked: false,
        warnings: [
          '⚠️ Always verify the sender before opening files.',
          '⚠️ Scan files with antivirus before opening.'
        ],
        reason: 'File approved',
        action: 'ALLOW',
        layer: 'all_checks_passed',
        fileInfo: {
          name: fileName,
          size: fileBuffer.length,
          type: mimeType
        }
      };
      
    } catch (error) {
      console.error('❌ File validation error:', error);
      
      // Fail-safe: Allow but flag for review
      return {
        allowed: true,
        blocked: false,
        warning: '⚠️ File sent but flagged for review',
        reason: 'Validation error - file allowed but logged',
        error: error.message,
        needsReview: true,
        action: 'ALLOW_WITH_FLAG'
      };
    }
  }

  // ═══════════════════════════════════════════════════════════════
  // 📊 GET VALIDATION STATISTICS
  // ═══════════════════════════════════════════════════════════════
  
  getStats() {
    return {
      imageValidator: this.imageValidator.getStats(),
      messageValidator: messageValidationService.getStats()
    };
  }

  // ═══════════════════════════════════════════════════════════════
  // 🏥 HEALTH CHECK
  // ═══════════════════════════════════════════════════════════════
  
  async getHealth() {
    const messageValidatorHealth = await messageValidationService.getHealth();
    
    return {
      status: 'healthy',
      services: {
        imageValidator: this.imageValidator.getHealth(),
        messageValidator: messageValidatorHealth,
        linkDetection: { status: 'healthy', ready: true },
        contactDetection: { status: 'healthy', ready: true }
      },
      timestamp: new Date().toISOString()
    };
  }

  // ═══════════════════════════════════════════════════════════════
  // 🧹 CLEAR CACHE
  // ═══════════════════════════════════════════════════════════════
  
  clearCache() {
    messageValidationService.clearCache();
    console.log('🧹 Chat security cache cleared');
  }

  // ═══════════════════════════════════════════════════════════════
  // 🔄 SHUTDOWN
  // ═══════════════════════════════════════════════════════════════
  
  async shutdown() {
    console.log('[ChatSecurityService] Shutting down...');
    await this.imageValidator.shutdown();
    console.log('[ChatSecurityService] Shutdown complete');
  }
}

export default new ChatSecurityService();