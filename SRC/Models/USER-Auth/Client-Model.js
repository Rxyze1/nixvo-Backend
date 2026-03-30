// models/USER-Auth/Client-Model.js

import mongoose from 'mongoose';
import { VALID_SKILLS } from '../../mini.Functions/skills.constants.js';
import { backupDocument } from '../../Service/Backup-DB/backupService.js';


const ClientSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true,
      index: true,
    },

    // ═══════════════════════════════════════════════════════════════
    // PROFILE
    // ═══════════════════════════════════════════════════════════════

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

    lookingSkillsFor: {
      type: String,
      enum: [...VALID_SKILLS, null],
      default: null,
      sparse: true,
    },

    // ═══════════════════════════════════════════════════════════════
    // JOB POSTS
    // ═══════════════════════════════════════════════════════════════

    posts: [
      {
        title: {
          type: String,
          required: true,
          minlength: 3,
          maxlength: 100,
          trim: true,
        },
        description: {
          type: String,
          required: true,
          minlength: 3,
          maxlength: 1000,
          trim: true,
        },
        category: {
          type: String,
          enum: [...VALID_SKILLS],
          default: 'all',
        },
        requiredSkills: {
          type: [String],
          validate: {
            validator: (skills) =>
              skills.every((skill) => VALID_SKILLS.includes(skill)),
            message: 'Invalid skill(s) in requiredSkills',
          },
          default: [],
        },
        uploadImages: {
          type: [String],
          default: [],
          validate: {
            validator: (images) => images.length <= 10,
            message: 'Maximum 10 images allowed per post',
          },
        },
        uploadVideos: {
          type: [String],
          default: [],
          validate: {
            validator: (videos) => videos.length <= 5,
            message: 'Maximum 5 videos allowed per post',
          },
        },
        status: {
          type: String,
          enum: ['draft', 'active', 'completed', 'cancelled'],
          default: 'draft',
        },
        budget: {
          amount: {
            type: Number,
            min: 0,
            default: 0,
          },
          currency: {
            type: String,
            enum: ['INR', 'USD', 'EUR', 'GBP'],
            default: 'INR',
          },
        },
        deadline: Date,
        createdAt: {
          type: Date,
          default: Date.now,
        },
        updatedAt: {
          type: Date,
          default: Date.now,
        },
      },
    ],

    // ═══════════════════════════════════════════════════════════════
    // SUBSCRIPTION
    // ═══════════════════════════════════════════════════════════════

    subscription: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Subscription',
      sparse: true,
    },

    isPremium: {
      type: Boolean,
      default: false,
      index: true,
    },

    // ═══════════════════════════════════════════════════════════════
    // PAYMENT METHODS
    // ═══════════════════════════════════════════════════════════════

    paymentMethods: [
      {
        _id: { type: mongoose.Schema.Types.ObjectId, auto: true },

        methodType: {
          type: String,
          enum: ['card', 'upi', 'bank_transfer'],
          required: true,
        },
        isDefault: {
          type: Boolean,
          default: false,
        },
        razorpayMethodId: String,
        verified: {
          type: Boolean,
          default: false,
        },
        addedAt: {
          type: Date,
          default: Date.now,
        },
      },
    ],

    // ═══════════════════════════════════════════════════════════════
    // BILLING ADDRESS
    // ═══════════════════════════════════════════════════════════════

    billingAddress: {
      fullname: String,
      email: String,
      phone: String,
      addressLine1: String,
      city: String,
      state: String,
      country: String,
      postalCode: String,
    },

    // ═══════════════════════════════════════════════════════════════
    // JOB STATS
    // ═══════════════════════════════════════════════════════════════

    jobStats: {
      totalPosted: { type: Number, default: 0, min: 0 },
      totalActive: { type: Number, default: 0, min: 0 },
      totalCompleted: { type: Number, default: 0, min: 0 },
      totalSpent: { type: Number, default: 0, min: 0 },
    },

    // ═══════════════════════════════════════════════════════════════
    // SOCIAL
    // ═══════════════════════════════════════════════════════════════

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
    },

    // ═══════════════════════════════════════════════════════════════
    // REVIEWS
    // ═══════════════════════════════════════════════════════════════

    reviews: [
      {
        _id: { type: mongoose.Schema.Types.ObjectId, auto: true },

        employeeId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'Employee',
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

    // ═══════════════════════════════════════════════════════════════
    // HIRING PREFERENCES
    // ═══════════════════════════════════════════════════════════════

    hiringPreferences: {
      preferredSkills: {
        type: [String],
        validate: {
          validator: (skills) =>
            skills.every((skill) => VALID_SKILLS.includes(skill)),
          message: 'Invalid skill(s) in preferredSkills',
        },
        default: [],
      },
      preferredRateRange: {
        min: { type: Number, default: 0 },
        max: { type: Number, default: 0 },
        currency: {
          type: String,
          enum: ['INR', 'USD', 'EUR', 'GBP'],
          default: 'INR',
        },
      },
    },

    // ═══════════════════════════════════════════════════════════════
    // AUTO-PAY
    // ═══════════════════════════════════════════════════════════════

    autoPay: {
      enabled: { type: Boolean, default: false },
      warningDaysBefore: { type: Number, default: 4, min: 1, max: 30 },
      lastPaymentDate: Date,
      nextPaymentDate: Date,
    },
  },
  { timestamps: true }
);

// ═══════════════════════════════════════════════════════════════
// INDEXES
// ═══════════════════════════════════════════════════════════════

ClientSchema.index({ userId: 1 });
ClientSchema.index({ 'posts.status': 1 });
ClientSchema.index({ 'posts.requiredSkills': 1 });
ClientSchema.index({ isPremium: 1 });
ClientSchema.index({ subscription: 1 });
ClientSchema.index({ profileCompleted: 1 });

// ═══════════════════════════════════════════════════════════════
// INSTANCE METHODS
// ═══════════════════════════════════════════════════════════════

ClientSchema.methods.getFullProfile = async function () {
  await this.populate([
    { path: 'userId', select: 'fullname username email userType status ratings' },
    { path: 'subscription', select: 'plan subscriptionStatus planExpiresAt' },
  ]);
  return this;
};

ClientSchema.methods.incrementJobStats = function (statType) {
  if (this.jobStats[statType] !== undefined) {
    this.jobStats[statType] += 1;
  }
  return mongoose.model('Client').updateOne(
    { _id: this._id },
    { $set: { jobStats: this.jobStats } }
  );
};

ClientSchema.methods.hasPremium = async function () {
  try {
    if (!this.subscription) return false;

    await this.populate({
      path: 'subscription',
      select: 'plan subscriptionStatus planExpiresAt',
    });

    const sub = this.subscription;
    if (!sub) return false;

   return (
  sub.plan !== 'free' &&
  sub.subscriptionStatus === 'active' &&
  new Date(sub.planExpiresAt) > new Date()
);
  } catch (error) {
    console.error('hasPremium check failed:', error);
    return false;
  }
};

ClientSchema.post('findOneAndUpdate', async function (doc) {
  try {
    if (!doc) return;

    if (
      this.getUpdate().$set?.subscription ||
      this.getUpdate().$unset?.subscription
    ) {
      const isPrem = await doc.hasPremium();
      if (doc.isPremium !== isPrem) {
        await mongoose.model('Client').updateOne(
          { _id: doc._id },
          { isPremium: isPrem }
        );
      }
    }
  } catch (error) {
    console.error('Error updating isPremium on findOneAndUpdate:', error);
  }
});

ClientSchema.pre('save', async function () {
  try {
    if (!this.isModified('subscription')) return;

    const isPrem = await this.hasPremium();
    if (this.isPremium !== isPrem) {
      this.isPremium = isPrem;
    }
  } catch (error) {
    console.error('Error updating isPremium cache:', error.message);
  }
});
// ═══════════════════════════════════════════════════════════════
// EXPORT
// ═══════════════════════════════════════════════════════════════






// ─────────────────────────────────────────────────────────────
// BACKUP HOOKS
// ─────────────────────────────────────────────────────────────

ClientSchema.pre('save', function () {
  this._wasNew = this.isNew;
});

ClientSchema.post('save', async function () {
  try {
    await backupDocument('clients', this._wasNew ? 'create' : 'update', this);
  } catch (err) {
    console.error('⚠️ [BACKUP] post.save failed (clients):', err.message);
  }
});

ClientSchema.post('findOneAndDelete', async function (doc) {
  if (!doc) return;
  try {
    await backupDocument('clients', 'delete', doc);
  } catch (err) {
    console.error('⚠️ [BACKUP] post.findOneAndDelete failed (clients):', err.message);
  }
});

ClientSchema.post('deleteOne', { document: true, query: false }, async function () {
  try {
    await backupDocument('clients', 'delete', this);
  } catch (err) {
    console.error('⚠️ [BACKUP] post.deleteOne failed (clients):', err.message);
  }
});

ClientSchema.post('findOneAndUpdate', { document: true }, async function (doc) {
  if (!doc) return;
  try {
    await backupDocument('clients', 'update', doc);
  } catch (err) {
    console.error('⚠️ [BACKUP] post.findOneAndUpdate failed (clients):', err.message);
  }
});


const Client =
  mongoose.models.Client || mongoose.model('Client', ClientSchema);
export default Client;