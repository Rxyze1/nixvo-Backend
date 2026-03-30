// Models/USER-Auth/Employee/PortfolioModel.js

import mongoose from 'mongoose';
import { backupDocument } from '../../../Service/Backup-DB/backupService.js';

const portfolioSchema = new mongoose.Schema(
  {
    // ═══════════════════════════════════════════════════════════════
    // REFERENCES (CONNECT TO EXISTING MODELS)
    // ═══════════════════════════════════════════════════════════════
    
    employeeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Employee',
      required: true,
      index: true,
    },

    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },

    // ═══════════════════════════════════════════════════════════════
    // BASIC INFO
    // ═══════════════════════════════════════════════════════════════
    
    portfolioName: {
      type: String,
      required: [true, 'Portfolio name is required'],
      trim: true,
      minlength: [3, 'Portfolio name must be at least 3 characters'],
      maxlength: [100, 'Portfolio name cannot exceed 100 characters'],
    },

    bio: {
      type: String,
      required: [true, 'Portfolio bio is required'],
      trim: true,
      minlength: [20, 'Bio must be at least 20 characters'],
      maxlength: [1000, 'Bio cannot exceed 1000 characters'],
    },

    // ═══════════════════════════════════════════════════════════════
    // PRICING (HOURLY RATE - MULTI CURRENCY)
    // ═══════════════════════════════════════════════════════════════
    
    workPrice: {
      amount: {
        type: Number,
        required: [true, 'Hourly rate is required'],
        min: [0, 'Hourly rate cannot be negative'],
      },
      currency: {
        type: String,
        enum: ['INR', 'USD', 'EUR', 'GBP', 'CAD', 'AUD'],
        default: 'INR',
      },
    },

    // ═══════════════════════════════════════════════════════════════
    // SKILLS & TAGS
    // ═══════════════════════════════════════════════════════════════
    
    skills: [{
      type: String,
      trim: true,
      maxlength: 50,
    }],

    tags: [{
      type: String,
      trim: true,
      lowercase: true,
      maxlength: 30,
    }],

    // ═══════════════════════════════════════════════════════════════
    // BADGE TYPE (FREE VS PREMIUM)
    // ═══════════════════════════════════════════════════════════════
    
    badgeType: {
      type: String,
      enum: ['free', 'premium'],
      default: 'free',
    },

    // ═══════════════════════════════════════════════════════════════
    // IMAGES (R2 STORAGE)
    // Free: Max 6 | Premium: Max 24
    // ═══════════════════════════════════════════════════════════════
    
    images: [{
      url: {
        type: String,
        required: true,
      },
      filename: String,
      filesize: Number,
      mimetype: String,
      width: Number,
      height: Number,
      uploadedAt: {
        type: Date,
        default: Date.now,
      },
      
      // AI VALIDATION
      validation: {
        status: {
          type: String,
          enum: ['pending', 'approved', 'rejected'],
          default: 'pending',
        },
        scannedAt: Date,
        confidence: Number,
        violations: [{
          type: {
            type: String,
            enum: ['personal_info', 'contact_info', 'link', 'inappropriate', 'text_detected', 'other'],
          },
          description: String,
          severity: {
            type: String,
            enum: ['low', 'medium', 'high'],
          },
        }],
        reason: String,
        detectedText: String, // OCR detected text
        hasPersonalInfo: Boolean,
        hasContactInfo: Boolean,
        hasLinks: Boolean,
      },
    }],

    // ═══════════════════════════════════════════════════════════════
    // VIDEOS (R2 STORAGE - MAX 400MB PER VIDEO)
    // Free: Max 4 | Premium: Max 20
    // ═══════════════════════════════════════════════════════════════
    
    videos: [{
      url: {
        type: String,
        required: true,
      },
      filename: String,
      filesize: {
        type: Number,
        max: [400 * 1024 * 1024, 'Video cannot exceed 400MB'], // 400MB
      },
      mimetype: String,
      duration: Number, // in seconds
      resolution: String, // e.g., "1920x1080"
      uploadedAt: {
        type: Date,
        default: Date.now,
      },
      
      // AI VALIDATION (for video thumbnails or extracted frames)
      validation: {
        status: {
          type: String,
          enum: ['pending', 'approved', 'rejected'],
          default: 'pending',
        },
        scannedAt: Date,
        confidence: Number,
        violations: [{
          type: {
            type: String,
            enum: ['personal_info', 'contact_info', 'link', 'inappropriate', 'other'],
          },
          description: String,
          severity: {
            type: String,
            enum: ['low', 'medium', 'high'],
          },
        }],
        reason: String,
      },
    }],

    // ═══════════════════════════════════════════════════════════════
    // METADATA
    // ═══════════════════════════════════════════════════════════════
    
    isPublic: {
      type: Boolean,
      default: true,
    },

    viewCount: {
      type: Number,
      default: 0,
    },

    likeCount: {
      type: Number,
      default: 0,
    },

    status: {
      type: String,
      enum: ['draft', 'published', 'under_review', 'rejected'],
      default: 'draft',
    },

    // ═══════════════════════════════════════════════════════════════
    // ADMIN MODERATION
    // ═══════════════════════════════════════════════════════════════
    
    moderationStatus: {
      status: {
        type: String,
        enum: ['pending', 'approved', 'rejected', 'flagged'],
        default: 'pending',
      },
      moderatedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
      },
      moderatedAt: Date,
      rejectionReason: String,
      flags: [{
        type: {
          type: String,
          enum: ['inappropriate', 'spam', 'misleading', 'copyright', 'other'],
        },
        description: String,
        reportedBy: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'User',
        },
        reportedAt: {
          type: Date,
          default: Date.now,
        },
      }],
    },

  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// ═══════════════════════════════════════════════════════════════
// INDEXES
// ═══════════════════════════════════════════════════════════════

portfolioSchema.index({ employeeId: 1 });
portfolioSchema.index({ userId: 1 });
portfolioSchema.index({ status: 1 });
portfolioSchema.index({ badgeType: 1 });
portfolioSchema.index({ 'moderationStatus.status': 1 });
portfolioSchema.index({ skills: 1 });
portfolioSchema.index({ tags: 1 });
portfolioSchema.index({ createdAt: -1 });

// ═══════════════════════════════════════════════════════════════
// VIRTUALS
// ═══════════════════════════════════════════════════════════════

portfolioSchema.virtual('imageCount').get(function () {
  return this.images?.length || 0;
});

portfolioSchema.virtual('videoCount').get(function () {
  return this.videos?.length || 0;
});

portfolioSchema.virtual('canAddMoreImages').get(function () {
  const currentCount = this.imageCount;
  const maxImages = this.badgeType === 'premium' ? 24 : 6;
  return currentCount < maxImages;
});

portfolioSchema.virtual('canAddMoreVideos').get(function () {
  const currentCount = this.videoCount;
  const maxVideos = this.badgeType === 'premium' ? 20 : 4;
  return currentCount < maxVideos;
});

portfolioSchema.virtual('uploadLimits').get(function () {
  return {
    images: {
      current: this.imageCount,
      max: this.badgeType === 'premium' ? 24 : 6,
      remaining: (this.badgeType === 'premium' ? 24 : 6) - this.imageCount,
    },
    videos: {
      current: this.videoCount,
      max: this.badgeType === 'premium' ? 20 : 4,
      remaining: (this.badgeType === 'premium' ? 20 : 4) - this.videoCount,
    },
  };
});

// ═══════════════════════════════════════════════════════════════
// PRE-SAVE VALIDATION
// ═══════════════════════════════════════════════════════════════

// TO ✅ — replace with this
portfolioSchema.pre('save', async function () {
  // ── Auto-sync badgeType from employee subscription ────────
  if (this.employeeId) {
    try {
      const employee = await mongoose.model('Employee')
        .findById(this.employeeId)
        .select('blueVerified')
        .lean();

      this.badgeType = employee?.blueVerified?.status === true ? 'premium' : 'free';
    } catch (err) {
      console.error('⚠️ Portfolio badgeType sync failed:', err.message);
    }
  }

  // ── Validate image count ──────────────────────────────────
  const maxImages = this.badgeType === 'premium' ? 24 : 6;
  if (this.images && this.images.length > maxImages) {
    throw new Error(`${this.badgeType} users can upload max ${maxImages} images`);
  }

  // ── Validate video count ──────────────────────────────────
  const maxVideos = this.badgeType === 'premium' ? 20 : 4;
  if (this.videos && this.videos.length > maxVideos) {
    throw new Error(`${this.badgeType} users can upload max ${maxVideos} videos`);
  }

  // ── Validate video file sizes ─────────────────────────────
  if (this.videos && this.videos.length > 0) {
    for (const video of this.videos) {
      if (video.filesize && video.filesize > 400 * 1024 * 1024) {
        throw new Error(`Video "${video.filename}" exceeds 400MB limit`);
      }
    }
  }
});
// ═══════════════════════════════════════════════════════════════
// INSTANCE METHODS
// ═══════════════════════════════════════════════════════════════

portfolioSchema.methods.canUploadImage = function () {
  const maxImages = this.badgeType === 'premium' ? 24 : 6;
  return this.images.length < maxImages;
};

portfolioSchema.methods.canUploadVideo = function () {
  const maxVideos = this.badgeType === 'premium' ? 20 : 4;
  return this.videos.length < maxVideos;
};

portfolioSchema.methods.incrementView = async function () {
  this.viewCount += 1;
  return this.save();
};

portfolioSchema.methods.addImage = function (imageData) {
  if (!this.canUploadImage()) {
    throw new Error(`Upload limit reached. ${this.badgeType} users can only upload ${this.badgeType === 'premium' ? 24 : 6} images.`);
  }
  this.images.push(imageData);
  return this.save();
};

portfolioSchema.methods.addVideo = function (videoData) {
  if (!this.canUploadVideo()) {
    throw new Error(`Upload limit reached. ${this.badgeType} users can only upload ${this.badgeType === 'premium' ? 20 : 4} videos.`);
  }
  
  if (videoData.filesize > 400 * 1024 * 1024) {
    throw new Error('Video size cannot exceed 400MB');
  }
  
  this.videos.push(videoData);
  return this.save();
};

portfolioSchema.methods.removeImage = function (imageId) {
  this.images = this.images.filter(img => img._id.toString() !== imageId.toString());
  return this.save();
};

portfolioSchema.methods.removeVideo = function (videoId) {
  this.videos = this.videos.filter(vid => vid._id.toString() !== videoId.toString());
  return this.save();
};

// ═══════════════════════════════════════════════════════════════
// STATIC METHODS
// ═══════════════════════════════════════════════════════════════

portfolioSchema.statics.findByEmployee = function (employeeId) {
  return this.find({ employeeId, status: 'published' })
    .populate('userId', 'fullname username profilePicture')
    .populate('employeeId', 'bio skills verifiedBadge')
    .sort({ createdAt: -1 });
};

portfolioSchema.statics.getUploadLimits = function (badgeType) {
  return {
    images: badgeType === 'premium' ? 24 : 6,
    videos: badgeType === 'premium' ? 20 : 4,
    maxVideoSize: 400 * 1024 * 1024, // 400MB in bytes
  };
};

// ═══════════════════════════════════════════════════════════════
// EXPORT
// ═══════════════════════════════════════════════════════════════


// ─────────────────────────────────────────────────────────────
// BACKUP HOOKS
// ─────────────────────────────────────────────────────────────


portfolioSchema.pre('save', function () {
  this._wasNew = this.isNew;
});

portfolioSchema.post('save', async function () {
  try {
    await backupDocument('portfolios', this._wasNew ? 'create' : 'update', this);
  } catch (err) {
    console.error('⚠️ [BACKUP] post.save failed (portfolios):', err.message);
  }
});

portfolioSchema.post('findOneAndDelete', async function (doc) {
  if (!doc) return;
  try {
    await backupDocument('portfolios', 'delete', doc);
  } catch (err) {
    console.error('⚠️ [BACKUP] post.findOneAndDelete failed (portfolios):', err.message);
  }
});

portfolioSchema.post('deleteOne', { document: true, query: false }, async function () {
  try {
    await backupDocument('portfolios', 'delete', this);
  } catch (err) {
    console.error('⚠️ [BACKUP] post.deleteOne failed (portfolios):', err.message);
  }
});

portfolioSchema.post('findOneAndUpdate', async function (doc) {
  if (!doc) return;
  try {
    await backupDocument('portfolios', 'update', doc);
  } catch (err) {
    console.error('⚠️ [BACKUP] post.findOneAndUpdate failed (portfolios):', err.message);
  }
});

const Portfolio = mongoose.models.Portfolio || mongoose.model('Portfolio', portfolioSchema);

export default Portfolio;