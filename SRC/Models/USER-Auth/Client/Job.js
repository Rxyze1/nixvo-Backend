// Models/Job.js

import mongoose from 'mongoose';
import { VALID_SKILLS } from '../../../mini.Functions/skills.constants.js';
import { backupDocument } from '../../../Service/Backup-DB/backupService.js';

// ═══════════════════════════════════════════════════════
// SUB-SCHEMAS
// ═══════════════════════════════════════════════════════

const textValidationSchema = new mongoose.Schema(
  {
    action: { type: String, enum: ['ALLOW', 'WARN', 'BLOCK'] },
    confidence: { type: Number, min: 0, max: 100, default: 0 },
    violations: [{ type: String }],
    reason: { type: String },
    source: { type: String },
    layer: { type: String },
    checkedAt: { type: Date },
  },
  { _id: false }
);

const mediaValidationSchema = new mongoose.Schema(
  {
    filename: { type: String },
    action: { type: String, enum: ['ALLOW', 'WARN', 'BLOCK'] },
    confidence: { type: Number, min: 0, max: 100, default: 0 },
    violations: [{ type: String }],
    reason: { type: String },
    checkedBy: [{ type: String }],
    scanTime: { type: String },
    checkedAt: { type: Date },
  },
  { _id: false }
);

const imageSchema = new mongoose.Schema(
  {
    url: { type: String },
    filename: { type: String },
    uploadedAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

const videoSchema = new mongoose.Schema(
  {
    url: { type: String },
    filename: { type: String },
    duration: { type: Number },
    uploadedAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

// ═══════════════════════════════════════════════════════
// MAIN SCHEMA
// ═══════════════════════════════════════════════════════

const jobSchema = new mongoose.Schema(
  {
    // ─────────────────────────────────────────────
    // CLIENT REFERENCE
    // ─────────────────────────────────────────────

    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },

    clientId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Client',
      required: true,
      index: true,
    },

    // ─────────────────────────────────────────────
    // JOB DETAILS
    // ─────────────────────────────────────────────

    jobTitle: {
      type: String,
      required: true,
      trim: true,
      minlength: 10,
      maxlength: 200,
    },

    description: {
      type: String,
      required: true,
      minlength: 50,
      maxlength: 5000,
    },

    price: {
      type: Number,
      required: true,
      min: 0,
    },

    currency: {
      type: String,
      default: 'INR',
      enum: ['INR', 'USD', 'EUR', 'GBP'],
    },

    needFor: {
      type: String,
      required: true,
      enum: ['long-term', 'short-term'],
      index: true,
    },

    tags: [{ type: String, trim: true, maxlength: 30 }],

    requiredSkills: [{ type: String, enum: VALID_SKILLS }],

    // ─────────────────────────────────────────────
    // MEDIA
    // ─────────────────────────────────────────────

    images: { type: [imageSchema], default: [] },
    videos: { type: [videoSchema], default: [] },

    // ─────────────────────────────────────────────
    // VALIDATION RESULTS
    // ─────────────────────────────────────────────

    validationResults: {
      jobTitle:    { type: textValidationSchema,   default: () => ({}) },
      description: { type: textValidationSchema,   default: () => ({}) },
      images:      { type: [mediaValidationSchema], default: [] },
      videos:      { type: [mediaValidationSchema], default: [] },
    },

    // ─────────────────────────────────────────────
    // JOB STATUS
    // ─────────────────────────────────────────────

    status: {
      type: String,
      enum: [
        'pending',
        'approved',
        'rejected',
        'open',
        'closing-soon',   // ← added
        'in-progress',
        'completed',
        'cancelled',
        'closed',
      ],
      default: 'open',
      index: true,
    },

    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },

    // ─────────────────────────────────────────────
    // CLOSING-SOON FIELDS                          ← added
    // ─────────────────────────────────────────────

    closingAt: {
      type: Date,
      default: null,
      index: true,
    },

    closedAt: {
      type: Date,
      default: null,
    },

    // ─────────────────────────────────────────────
    // APPLICATIONS
    // ─────────────────────────────────────────────

    applicationsCount: {
      type: Number,
      default: 0,
    },

    // ─────────────────────────────────────────────
    // HIRED EMPLOYEE
    // ─────────────────────────────────────────────

    selectedFreelancer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Employee',
    },

    hiredDetails: {
      applicationId:    { type: mongoose.Schema.Types.ObjectId, ref: 'Application' },
      hiredAt:          { type: Date },
      finalPrice:       { type: Number },
      startedAt:        { type: Date },
      completedAt:      { type: Date },
      expectedDelivery: { type: String },
    },

    // ─────────────────────────────────────────────
    // TIMESTAMPS & META
    // ─────────────────────────────────────────────

    postedAt: {
      type: Date,
      default: Date.now,
      index: true,
    },

    expiresAt: {
      type: Date,
      index: true,
    },

    viewsCount: {
      type: Number,
      default: 0,
    },

    lastUpdated: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  }
);

// ═══════════════════════════════════════════════════════
// INDEXES
// ═══════════════════════════════════════════════════════

jobSchema.index({ userId: 1, status: 1 });
jobSchema.index({ clientId: 1, status: 1 });
jobSchema.index({ requiredSkills: 1, isActive: 1 });
jobSchema.index({ needFor: 1, isActive: 1 });
jobSchema.index({ postedAt: -1 });
jobSchema.index({ selectedFreelancer: 1 });
jobSchema.index({ closingAt: 1, status: 1 });   // ← added: speeds up cron queries

// ═══════════════════════════════════════════════════════
// SCHEMA VALIDATORS
// ═══════════════════════════════════════════════════════

jobSchema.path('images').validate(function (images) {
  return images.length <= 10;
}, 'Maximum 10 images allowed');

jobSchema.path('videos').validate(function (videos) {
  return videos.length <= 3;
}, 'Maximum 3 videos allowed');

// ═══════════════════════════════════════════════════════
// METHODS
// ═══════════════════════════════════════════════════════

jobSchema.methods.incrementViews = function () {
  this.viewsCount += 1;
  this.lastUpdated = Date.now();
  return this.save();
};

jobSchema.methods.hireEmployee = function (applicationId, employeeId, finalPrice, expectedDelivery) {
  this.selectedFreelancer = employeeId;
  this.hiredDetails = {
    applicationId,
    hiredAt:          Date.now(),
    finalPrice,
    startedAt:        Date.now(),
    expectedDelivery,
  };
  this.status   = 'in-progress';
  this.isActive = false;
  this.lastUpdated = Date.now();
  return this.save();
};

jobSchema.methods.completeJob = function () {
  if (!this.selectedFreelancer) {
    throw new Error('No employee hired for this job');
  }
  this.status = 'completed';
  this.isActive = false;
  this.hiredDetails.completedAt = Date.now();
  this.lastUpdated = Date.now();
  return this.save();
};

jobSchema.methods.closeJob = function () {
  this.status   = 'closed';
  this.isActive = false;
  this.closedAt = new Date();        // ← now sets closedAt
  this.lastUpdated = Date.now();
  return this.save();
};

jobSchema.methods.cancelJob = function () {
  this.status   = 'cancelled';
  this.isActive = false;
  this.lastUpdated = Date.now();
  return this.save();
};

jobSchema.methods.reopenJob = function () {
  if (this.status === 'completed' || this.status === 'cancelled') {
    throw new Error('Cannot reopen completed or cancelled jobs');
  }
  this.status             = 'open';
  this.isActive           = true;
  this.closingAt          = null;    // ← reset closing window
  this.closedAt           = null;    // ← reset closed date
  this.selectedFreelancer = null;
  this.hiredDetails       = undefined;
  this.lastUpdated        = Date.now();
  return this.save();
};

// ═══════════════════════════════════════════════════════
// STATICS
// ═══════════════════════════════════════════════════════

jobSchema.statics.getActiveJobs = function (filters = {}) {
  return this.find({
    isActive: true,
    status: { $in: ['open', 'closing-soon', 'approved'] },  // ← closing-soon included
    ...filters,
  })
    .populate('userId',   'fullname username email ratings')
    .populate('clientId', 'bio profilePic lookingSkillsFor')
    .sort({ postedAt: -1 });
};

jobSchema.statics.getJobsByClient = function (clientId, status = null) {
  const query = { clientId };
  if (status) query.status = status;
  return this.find(query)
    .populate('selectedFreelancer', 'fullname username profilePic skills ratings')
    .sort({ postedAt: -1 });
};

jobSchema.statics.searchJobs = function (searchTerm, filters = {}) {
  return this.find({
    $or: [
      { jobTitle:    { $regex: searchTerm, $options: 'i' } },
      { description: { $regex: searchTerm, $options: 'i' } },
      { tags:        { $in: [new RegExp(searchTerm, 'i')] } },
    ],
    isActive: true,
    status: { $in: ['open', 'closing-soon', 'approved'] },  // ← closing-soon included
    ...filters,
  })
    .populate('userId', 'fullname username ratings')
    .sort({ postedAt: -1 });
};

jobSchema.statics.getJobsWithApplications = function (clientId) {
  return this.aggregate([
    { $match: { clientId: new mongoose.Types.ObjectId(clientId) } },
    {
      $lookup: {
        from: 'applications',
        localField: '_id',
        foreignField: 'jobId',
        as: 'applicationsList',
      },
    },
    {
      $addFields: {
        pendingCount: {
          $size: {
            $filter: {
              input: '$applicationsList',
              as: 'app',
              cond: { $eq: ['$$app.status', 'pending'] },
            },
          },
        },
        acceptedCount: {
          $size: {
            $filter: {
              input: '$applicationsList',
              as: 'app',
              cond: { $eq: ['$$app.status', 'accepted'] },
            },
          },
        },
      },
    },
    { $sort: { postedAt: -1 } },
  ]);
};

// ═══════════════════════════════════════════════════════
// EXPORT
// ═══════════════════════════════════════════════════════


// ─────────────────────────────────────────────────────────────
// BACKUP HOOKS
// ─────────────────────────────────────────────────────────────


jobSchema.pre('save', function () {
  this._wasNew = this.isNew;
});

jobSchema.post('save', async function () {
  try {
    await backupDocument('jobs', this._wasNew ? 'create' : 'update', this);
  } catch (err) {
    console.error('⚠️ [BACKUP] post.save failed (jobs):', err.message);
  }
});

jobSchema.post('findOneAndDelete', async function (doc) {
  if (!doc) return;
  try {
    await backupDocument('jobs', 'delete', doc);
  } catch (err) {
    console.error('⚠️ [BACKUP] post.findOneAndDelete failed (jobs):', err.message);
  }
});

jobSchema.post('deleteOne', { document: true, query: false }, async function () {
  try {
    await backupDocument('jobs', 'delete', this);
  } catch (err) {
    console.error('⚠️ [BACKUP] post.deleteOne failed (jobs):', err.message);
  }
});

jobSchema.post('findOneAndUpdate', async function (doc) {
  if (!doc) return;
  try {
    await backupDocument('jobs', 'update', doc);
  } catch (err) {
    console.error('⚠️ [BACKUP] post.findOneAndUpdate failed (jobs):', err.message);
  }
});

export const Job = mongoose.model('Job', jobSchema);
export default Job;