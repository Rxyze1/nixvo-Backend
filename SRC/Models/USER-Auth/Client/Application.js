// Models/USER-Auth/Client/Application.js

import mongoose from 'mongoose';
import { backupDocument } from '../../../Service/Backup-DB/backupService.js';

const applicationSchema = new mongoose.Schema({
  
  // ════════════════════════════════════════════════════════════════
  // JOB REFERENCE
  // ════════════════════════════════════════════════════════════════
  jobId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Job',
    required: [true, 'Job ID is required'],
    index: true
  },
  
  jobTitle: {
    type: String,
    required: [true, 'Job title is required'],
    trim: true
  },
  
  // ════════════════════════════════════════════════════════════════
  // APPLICANT REFERENCES
  // ════════════════════════════════════════════════════════════════
  applicantId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'Applicant user ID is required'],
    index: true
  },
  
  employeeId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Employee',
    required: [true, 'Employee profile ID is required'],
    index: true
  },
  
  // ════════════════════════════════════════════════════════════════
  // APPLICANT BASIC INFO (Cached for performance)
  // ════════════════════════════════════════════════════════════════
  applicantName: {
    type: String,
    required: [true, 'Applicant name is required'],
    trim: true
  },
  
  applicantEmail: {
    type: String,
    required: [true, 'Applicant email is required'],
    trim: true,
    lowercase: true
  },
  
  // ════════════════════════════════════════════════════════════════
  // APPLICATION DETAILS
  // ════════════════════════════════════════════════════════════════
  coverLetter: {
    type: String,
    required: [true, 'Cover letter is required'],
    minlength: [50, 'Cover letter must be at least 50 characters'],
    maxlength: [2000, 'Cover letter cannot exceed 2000 characters']
  },
  
  proposedBudget: {
    type: Number,
    required: [true, 'Proposed budget is required'],
    min: [0, 'Budget cannot be negative']
  },
  
  deliveryTime: {
    type: String,
    required: [true, 'Delivery time is required'],
    trim: true
  },
  
  // ════════════════════════════════════════════════════════════════
  // PORTFOLIO & RESUME
  // ════════════════════════════════════════════════════════════════
  portfolioLinks: [{
    type: String,
    trim: true,
    validate: {
      validator: function(v) {
        return !v || /^https?:\/\/.+/.test(v);
      },
      message: 'Portfolio link must be a valid URL'
    }
  }],
  
  resume: {
    filename: {
      type: String,
      trim: true
    },
    filepath: {
      type: String,
      trim: true
    },
    mimetype: {
      type: String,
      trim: true
    },
    filesize: {
      type: Number,
      min: 0
    },
    uploadedAt: {
      type: Date,
      default: Date.now
    }
  },
  
  // ════════════════════════════════════════════════════════════════
  // STATUS & WORKFLOW
  // ════════════════════════════════════════════════════════════════
  status: {
    type: String,
    enum: {
      values: ['pending', 'accepted', 'rejected', 'withdrawn'],
      message: '{VALUE} is not a valid status'
    },
    default: 'pending',
    index: true
  },
  
  // ════════════════════════════════════════════════════════════════
  // CLIENT FEEDBACK & DECISION
  // ════════════════════════════════════════════════════════════════
  clientFeedback: {
    message: {
      type: String,
      maxlength: [1000, 'Feedback message cannot exceed 1000 characters']
    },
    decidedAt: Date,
    decidedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    }
  },
  
  // ════════════════════════════════════════════════════════════════
  // EMPLOYEE PROFILE SNAPSHOT (Cached at application time)
  // ════════════════════════════════════════════════════════════════
  employeeProfile: {
    skills: [{
      type: String,
      trim: true
    }],
    bio: {
      type: String,
      maxlength: 500
    },
    experience: {
      type: String,
      maxlength: 1000
    },
    rating: {
      type: Number,
      min: 0,
      max: 5,
      default: 0
    },
    completedProjects: {
      type: Number,
      min: 0,
      default: 0
    },
    profilePicture: String,
    hourlyRate: {
      amount: {
        type: Number,
        min: 0
      },
      currency: {
        type: String,
        default: 'USD',
        uppercase: true
      }
    },
    verifiedBadge: {
      type: Boolean,
      default: false
    }
  },
  
  // ════════════════════════════════════════════════════════════════
  // TIMESTAMPS
  // ════════════════════════════════════════════════════════════════
  appliedAt: {
    type: Date,
    default: Date.now,
    index: true
  },
  
  viewedByClient: {
    type: Boolean,
    default: false
  },
  
  viewedAt: Date
  
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// ════════════════════════════════════════════════════════════════
// VIRTUALS
// ════════════════════════════════════════════════════════════════

// Check if application is still pending
applicationSchema.virtual('isPending').get(function() {
  return this.status === 'pending';
});

// Check if application has been viewed
applicationSchema.virtual('isViewed').get(function() {
  return this.viewedByClient === true;
});

// Days since application
applicationSchema.virtual('daysOld').get(function() {
  return Math.floor((Date.now() - this.appliedAt) / (1000 * 60 * 60 * 24));
});

// ════════════════════════════════════════════════════════════════
// INDEXES FOR PERFORMANCE
// ════════════════════════════════════════════════════════════════

// Compound indexes
applicationSchema.index({ jobId: 1, status: 1 });
applicationSchema.index({ applicantId: 1, status: 1 });
applicationSchema.index({ employeeId: 1, status: 1 });
applicationSchema.index({ jobId: 1, appliedAt: -1 });
applicationSchema.index({ status: 1, appliedAt: -1 });

// Prevent duplicate applications (same employee can't apply to same job twice)
applicationSchema.index(
  { jobId: 1, applicantId: 1 }, 
  { 
    unique: true,
    name: 'unique_job_applicant'
  }
);

// Text search on applicant name and email
applicationSchema.index({ 
  applicantName: 'text', 
  applicantEmail: 'text' 
});

// ════════════════════════════════════════════════════════════════
// PRE-SAVE MIDDLEWARE
// ════════════════════════════════════════════════════════════════

applicationSchema.pre('save', function(next) {
  // Auto-set decidedAt when status changes
  if (this.isModified('status') && (this.status === 'accepted' || this.status === 'rejected')) {
    if (this.clientFeedback && !this.clientFeedback.decidedAt) {
      this.clientFeedback.decidedAt = new Date();
    }
  }
  next();
});

// ════════════════════════════════════════════════════════════════
// STATIC METHODS
// ════════════════════════════════════════════════════════════════

// Get applications count for a job
applicationSchema.statics.getJobApplicationCount = async function(jobId) {
  return await this.countDocuments({ jobId });
};

// Get applications count by status for a job
applicationSchema.statics.getJobApplicationStats = async function(jobId) {
  const stats = await this.aggregate([
    { $match: { jobId: mongoose.Types.ObjectId(jobId) } },
    {
      $group: {
        _id: '$status',
        count: { $sum: 1 }
      }
    }
  ]);
  
  return {
    total: stats.reduce((sum, s) => sum + s.count, 0),
    pending: stats.find(s => s._id === 'pending')?.count || 0,
    accepted: stats.find(s => s._id === 'accepted')?.count || 0,
    rejected: stats.find(s => s._id === 'rejected')?.count || 0
  };
};

// Check if employee already applied
applicationSchema.statics.hasApplied = async function(jobId, applicantId) {
  const existing = await this.findOne({ jobId, applicantId });
  return !!existing;
};

// ════════════════════════════════════════════════════════════════
// INSTANCE METHODS
// ════════════════════════════════════════════════════════════════

// Accept application
applicationSchema.methods.accept = function(feedback) {
  this.status = 'accepted';
  if (feedback) {
    this.clientFeedback = {
      message: feedback.message || '',
      decidedAt: new Date(),
      decidedBy: feedback.decidedBy
    };
  }
  return this.save();
};

// Reject application
applicationSchema.methods.reject = function(feedback) {
  this.status = 'rejected';
  if (feedback) {
    this.clientFeedback = {
      message: feedback.message || '',
      decidedAt: new Date(),
      decidedBy: feedback.decidedBy
    };
  }
  return this.save();
};

// Mark as viewed
applicationSchema.methods.markAsViewed = function() {
  if (!this.viewedByClient) {
    this.viewedByClient = true;
    this.viewedAt = new Date();
    return this.save();
  }
  return Promise.resolve(this);
};

// ════════════════════════════════════════════════════════════════
// QUERY HELPERS
// ════════════════════════════════════════════════════════════════

applicationSchema.query.pending = function() {
  return this.where({ status: 'pending' });
};

applicationSchema.query.accepted = function() {
  return this.where({ status: 'accepted' });
};

applicationSchema.query.rejected = function() {
  return this.where({ status: 'rejected' });
};

applicationSchema.query.forJob = function(jobId) {
  return this.where({ jobId });
};

applicationSchema.query.byEmployee = function(employeeId) {
  return this.where({ employeeId });
};

applicationSchema.query.recent = function(days = 7) {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return this.where({ appliedAt: { $gte: date } });
};

// ════════════════════════════════════════════════════════════════
// EXPORT
// ════════════════════════════════════════════════════════════════


// ─────────────────────────────────────────────────────────────
// BACKUP HOOKS
// ─────────────────────────────────────────────────────────────


applicationSchema.pre('save', function () {
  this._wasNew = this.isNew;
});

applicationSchema.post('save', async function () {
  try {
    await backupDocument('applications', this._wasNew ? 'create' : 'update', this);
  } catch (err) {
    console.error('⚠️ [BACKUP] post.save failed (applications):', err.message);
  }
});

applicationSchema.post('findOneAndDelete', async function (doc) {
  if (!doc) return;
  try {
    await backupDocument('applications', 'delete', doc);
  } catch (err) {
    console.error('⚠️ [BACKUP] post.findOneAndDelete failed (applications):', err.message);
  }
});

applicationSchema.post('deleteOne', { document: true, query: false }, async function () {
  try {
    await backupDocument('applications', 'delete', this);
  } catch (err) {
    console.error('⚠️ [BACKUP] post.deleteOne failed (applications):', err.message);
  }
});

applicationSchema.post('findOneAndUpdate', async function (doc) {
  if (!doc) return;
  try {
    await backupDocument('applications', 'update', doc);
  } catch (err) {
    console.error('⚠️ [BACKUP] post.findOneAndUpdate failed (applications):', err.message);
  }
});

const Application = mongoose.models.Application || mongoose.model('Application', applicationSchema);

export default Application;