// models/USER-Auth/Employee-Model.js

import mongoose from 'mongoose';
import { VALID_SKILLS } from '../../mini.Functions/skills.constants.js';
import { backupDocument } from '../../Service/Backup-DB/backupService.js';

const EmployeeSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true,
      index: true,
    },

    bio: {
      type: String,
      default: '',
      maxlength: 500,
      trim: true,
    },

    profilePic: {
      type: String,
      default: null,
    },

    profileCompleted: {
      type: Boolean,
      default: false,
      index: true,
    },

    profileBannerImage: {
      type: String,
      default: null,
    },

    skills: {
      type: [String],
      default: [],
      validate: [
        {
          validator: function (skills) {
            return skills.length <= 20;
          },
          message: 'Maximum 20 skills allowed',
        },
      ],
    },

    experience: {
      totalYears: {
        type: Number,
        default: 0,
        min: 0,
        max: 50,
      },
      description: {
        type: String,
        maxlength: 1000,
        trim: true,
      },
    },

    hourlyRate: {
      currency: {
        type: String,
        enum: ['INR', 'USD', 'EUR', 'GBP'],
        default: 'INR',
      },
      amount: {
        type: Number,
        default: 0,
        min: 0,
      },
    },

    portfolio: [
      {
        title: {
          type: String,
          required: true,
          maxlength: 100,
          trim: true,
        },
        description: {
          type: String,
          maxlength: 500,
          trim: true,
        },
        links: {
          type: [String],
          default: [],
        },
        images: {
          type: [String],
          default: [],
        },
        videos: {
          type: [String],
          default: [],
        },
        createdAt: {
          type: Date,
          default: Date.now,
        },
      },
    ],

    subscription: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Subscription',
      sparse: true,
      index: true,
    },

    verificationDetails: {
      status: {
        type: String,
        enum: ['pending', 'approved', 'rejected'],
        default: 'pending',
        index: true,
      },
      verifiedByAdmin: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
      },
      verificationDate: Date,
      rejectionReason: {
        type: String,
        maxlength: 500,
      },
      verificationMethod: {
        type: String,
        enum: ['call', 'manual', 'document'],
      },
    },

    blueVerified: {
      status: {
        type: Boolean,
        default: false,
        index: true,
      },
    },

    adminVerified: {
      status: {
        type: Boolean,
        default: false,
        index: true,
      },
      verifiedAt: Date,
    },

    hasBadge: {
      type: Boolean,
      default: false,
      index: true,
    },

    badgeType: {
      type: String,
      enum: ['none', 'blue-verified', 'admin-verified'],
      default: 'none',
    },

    badgeLabel: {
      type: String,
      enum: ['', 'Blue Verified', 'Admin Verified'],
      default: '',
    },

    bankDetails: {
      accountHolderName: {
        type: String,
        trim: true,
      },
      accountNumber: {
        type: String,
        select: false,
      },
      ifscCode: {
        type: String,
        uppercase: true,
      },
      bankName: String,
      verified: {
        type: Boolean,
        default: false,
      },
    },

    panCard: {
      panNumber: {
        type: String,
        uppercase: true,
        select: false,
      },
      verified: {
        type: Boolean,
        default: false,
      },
    },

    jobStats: {
      totalCompleted: {
        type: Number,
        default: 0,
        min: 0,
      },
      totalApplied: {
        type: Number,
        default: 0,
        min: 0,
      },
      completionRate: {
        type: Number,
        default: 0,
        min: 0,
        max: 100,
      },
    },

    followers: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
      },
    ],

    followersCount: {
      type: Number,
      default: 0,
      min: 0,
      index: true,
    },

    reviews: [
      {
        clientId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'Client',
          required: true,
        },
        jobId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'Job',
        },
        rating: {
          type: Number,
          min: 1,
          max: 5,
          required: true,
        },
        comment: {
          type: String,
          maxlength: 500,
          trim: true,
        },
        createdAt: {
          type: Date,
          default: Date.now,
        },
      },
    ],

    withdrawalHistory: [
      {
        amount: {
          type: Number,
          required: true,
          min: 0,
        },
        currency: {
          type: String,
          enum: ['INR', 'USD', 'EUR', 'GBP'],
          default: 'INR',
        },
        status: {
          type: String,
          enum: ['pending', 'completed', 'failed'],
          default: 'pending',
        },
        requestedAt: {
          type: Date,
          default: Date.now,
        },
        completedAt: Date,
        failureReason: String,
      },
    ],

    availability: {
      status: {
        type: String,
        enum: ['available', 'busy', 'unavailable'],
        default: 'available',
        index: true,
      },
      hoursPerWeek: {
        type: Number,
        min: 0,
        max: 168,
      },
    },
  },
  {
    timestamps: true,
  }
);

// ═══════════════════════════════════════════════════════════════
// VIRTUALS
// ═══════════════════════════════════════════════════════════════

EmployeeSchema.virtual('averageRating').get(function () {
  if (this.reviews.length === 0) return 0;
  const totalRating = this.reviews.reduce((sum, review) => sum + review.rating, 0);
  return parseFloat((totalRating / this.reviews.length).toFixed(1));
});

EmployeeSchema.virtual('reviewCount').get(function () {
  return this.reviews.length;
});

EmployeeSchema.set('toJSON', { virtuals: true });

// ═══════════════════════════════════════════════════════════════
// INDEXES
// ═══════════════════════════════════════════════════════════════

EmployeeSchema.index({ userId: 1 });
EmployeeSchema.index({ 'verificationDetails.status': 1 });
EmployeeSchema.index({ 'availability.status': 1 });
EmployeeSchema.index({ 'blueVerified.status': 1 });
EmployeeSchema.index({ 'adminVerified.status': 1 });
EmployeeSchema.index({ hasBadge: 1 });
EmployeeSchema.index({ subscription: 1 });
EmployeeSchema.index({ profileCompleted: 1 });
EmployeeSchema.index({ followersCount: -1 });
EmployeeSchema.index({ 'jobStats.completionRate': -1 });
EmployeeSchema.index({ badgeType: 1 });

// ═══════════════════════════════════════════════════════════════
// PRE-SAVE HOOK
// ═══════════════════════════════════════════════════════════════

EmployeeSchema.pre('save', async function () {
  try {
    const isAdminApproved = this.verificationDetails?.status === 'approved';

    // ✅ Properly verify subscription — not just ObjectId presence
    let hasPremiumSub = false;
    if (this.subscription) {
      const sub = await mongoose.model('Subscription')
        .findById(this.subscription)
        .lean();

      hasPremiumSub = sub
        && sub.plan !== 'free'
        && sub.subscriptionStatus === 'active'
        && new Date() < new Date(sub.planExpiresAt);
    }

    this.blueVerified.status  = !!hasPremiumSub;
    this.adminVerified.status = isAdminApproved;
    this.hasBadge = this.blueVerified.status || this.adminVerified.status;

    if (this.blueVerified.status) {
      this.badgeType  = 'blue-verified';
      this.badgeLabel = 'Blue Verified';
    } else if (this.adminVerified.status) {
      this.badgeType  = 'admin-verified';
      this.badgeLabel = 'Admin Verified';
    } else {
      this.badgeType  = 'none';
      this.badgeLabel = '';
    }
  } catch (error) {
    console.error('❌ Badge sync failed:', error.message);
    throw error;
  }
});

// ═══════════════════════════════════════════════════════════════
// INSTANCE METHODS
// ═══════════════════════════════════════════════════════════════

/**
 * ✅ Get average rating
 */
EmployeeSchema.methods.getAverageRating = function () {
  return this.averageRating;
};

/**
 * ✅ Get review count
 */
EmployeeSchema.methods.getReviewCount = function () {
  return this.reviewCount;
};

/**
 * ✅ Sync badge
 */
// ✅ Fix syncBadge() — proper subscription check
EmployeeSchema.methods.syncBadge = async function () {
  const isAdminApproved = this.verificationDetails?.status === 'approved';

  let hasPremiumSub = false;
  if (this.subscription) {
    const sub = await mongoose.model('Subscription')
      .findById(this.subscription)
      .lean();

    hasPremiumSub = sub
      && sub.plan !== 'free'
      && sub.subscriptionStatus === 'active'
      && new Date() < new Date(sub.planExpiresAt);
  }

  this.blueVerified.status  = !!hasPremiumSub;
  this.adminVerified.status = isAdminApproved;
  this.hasBadge = this.blueVerified.status || this.adminVerified.status;

  if (this.blueVerified.status) {
    this.badgeType  = 'blue-verified';
    this.badgeLabel = 'Blue Verified';
  } else if (this.adminVerified.status) {
    this.badgeType  = 'admin-verified';
    this.badgeLabel = 'Admin Verified';
  } else {
    this.badgeType  = 'none';
    this.badgeLabel = '';
  }

  return await this.save();
};
/**
 * ✅ Get verification details
 */
EmployeeSchema.methods.getVerificationDetails = function () {
  return {
    blueVerified: this.blueVerified,
    adminVerified: this.adminVerified,
    hasBadge: this.hasBadge,
    badgeType: this.badgeType,
    badgeLabel: this.badgeLabel,
    verificationStatus: this.verificationDetails.status,
  };
};

/**
 * ✅ Get full profile
 */
EmployeeSchema.methods.getFullProfile = async function () {
  await this.populate([
    {
      path: 'userId',
      select: 'fullname username email userType status',
    },
    {
      path: 'subscription',
      select: 'plan subscriptionStatus planActivatedAt planExpiresAt',
    },
    {
      path: 'verificationDetails.verifiedByAdmin',
      select: 'fullname username',
    },
    {
      path: 'reviews.clientId',
      select: 'fullname profilePic',
    },
    {
      path: 'followers',
      select: 'fullname profilePic',
    },
  ]);

  return this;
};

/**
 * ✅ Get public profile
 */
EmployeeSchema.methods.getPublicProfile = async function () {
  await this.getFullProfile();

  const publicData = this.toObject();

  delete publicData.bankDetails;
  delete publicData.panCard;
  delete publicData.withdrawalHistory;
  delete publicData.__v;

  return publicData;
};

/**
 * ✅ Add review
 */
EmployeeSchema.methods.addReview = async function (clientId, jobId, rating, comment) {
  if (rating < 1 || rating > 5) {
    throw new Error('Rating must be between 1 and 5');
  }

  this.reviews.push({
    clientId,
    jobId,
    rating,
    comment: comment?.trim() || '',
  });

  return await this.save();
};

/**
 * ✅ Add follower
 */
EmployeeSchema.methods.addFollower = async function (userId) {
  if (!this.followers.includes(userId)) {
    this.followers.push(userId);
    this.followersCount += 1;
  }
  return await this.save();
};

/**
 * ✅ Remove follower
 */
EmployeeSchema.methods.removeFollower = async function (userId) {
  this.followers = this.followers.filter(id => !id.equals(userId));
  this.followersCount = this.followers.length;
  return await this.save();
};

// ═══════════════════════════════════════════════════════════════
// STATIC METHODS
// ═══════════════════════════════════════════════════════════════

EmployeeSchema.statics.findBySkill = function (skill, limit = 10) {
  return this.find({
    skills: skill,
    hasBadge: true,
    profileCompleted: true,
    'availability.status': 'available',
  })
    .sort({ followersCount: -1 })
    .limit(limit);
};

EmployeeSchema.statics.findVerified = function (limit = 50) {
  return this.find({
    hasBadge: true,
    profileCompleted: true,
  })
    .populate('userId', 'fullname username email')
    .sort({ followersCount: -1 })
    .limit(limit);
};

// ═══════════════════════════════════════════════════════════════
// EXPORT
// ═══════════════════════════════════════════════════════════════


// ─────────────────────────────────────────────────────────────
// BACKUP HOOKS
// ─────────────────────────────────────────────────────────────


EmployeeSchema.pre('save', function () {
  this._wasNew = this.isNew;
});

EmployeeSchema.post('save', async function () {
  try {
    await backupDocument('employees', this._wasNew ? 'create' : 'update', this);
  } catch (err) {
    console.error('⚠️ [BACKUP] post.save failed (employees):', err.message);
  }
});

EmployeeSchema.post('findOneAndDelete', async function (doc) {
  if (!doc) return;
  try {
    await backupDocument('employees', 'delete', doc);
  } catch (err) {
    console.error('⚠️ [BACKUP] post.findOneAndDelete failed (employees):', err.message);
  }
});

EmployeeSchema.post('deleteOne', { document: true, query: false }, async function () {
  try {
    await backupDocument('employees', 'delete', this);
  } catch (err) {
    console.error('⚠️ [BACKUP] post.deleteOne failed (employees):', err.message);
  }
});

EmployeeSchema.post('findOneAndUpdate', async function (doc) {
  if (!doc) return;
  try {
    await backupDocument('employees', 'update', doc);
  } catch (err) {
    console.error('⚠️ [BACKUP] post.findOneAndUpdate failed (employees):', err.message);
  }
});

const Employee =
  mongoose.models.Employee || mongoose.model('Employee', EmployeeSchema);

export default Employee;