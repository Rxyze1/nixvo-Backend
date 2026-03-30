// Models/USER-Auth/Employee/Application.js
import { backupDocument } from '../../../Service/Backup-DB/backupService.js';

import mongoose from 'mongoose';

const applicationSchema = new mongoose.Schema({
  
  // ════════════════════════════════════════════════════════════════
  // JOB & USER REFERENCES
  // ════════════════════════════════════════════════════════════════
  jobId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Job',
    required: [true, 'Job reference is required'],
    index: true
  },
  
  jobTitle: {
    type: String,
    required: true
  },
  
  // ════════════════════════════════════════════════════════════════
  // EMPLOYEE REFERENCES (Multiple for flexibility)
  // ════════════════════════════════════════════════════════════════
  employeeId: {  // User ID of the employee
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'Employee user ID is required'],
    index: true
  },
  
  employeeProfileId: {  // Employee Profile reference
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Employee',
    required: [true, 'Employee profile ID is required'],
    index: true
  },
  
  // ════════════════════════════════════════════════════════════════
  // CLIENT REFERENCE
  // ════════════════════════════════════════════════════════════════
  clientId: {  // Job owner
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'Client ID is required'],
    index: true
  },
  
  // ════════════════════════════════════════════════════════════════
  // CACHED EMPLOYEE DATA (For performance)
  // ════════════════════════════════════════════════════════════════
  applicantName: {
    type: String,
    required: true
  },
  
  applicantEmail: {
    type: String,
    required: true,
    lowercase: true
  },
  
  applicantUsername: String,
  
  applicantProfilePicture: String,
  
  // ════════════════════════════════════════════════════════════════
  // APPLICATION CONTENT
  // ════════════════════════════════════════════════════════════════
  coverLetter: {
    type: String,
    required: [true, 'Cover letter is required'],
    minlength: [50, 'Cover letter must be at least 50 characters'],
    maxlength: [5000, 'Cover letter cannot exceed 5000 characters']
  },
  
  proposedBudget: {
    type: Number,
    min: [0, 'Budget cannot be negative']
  },
  
  expectedSalary: {
    type: Number,
    min: [0, 'Salary cannot be negative']
  },
  
  deliveryTime: {
    type: String,
    trim: true
  },
  
  availableFrom: {
    type: Date
  },
  
  // ════════════════════════════════════════════════════════════════
  // PORTFOLIO & LINKS
  // ════════════════════════════════════════════════════════════════
  portfolioLinks: [{
    type: String,
    trim: true
  }],
  
  // ════════════════════════════════════════════════════════════════
  // RESUME
  // ════════════════════════════════════════════════════════════════
  resume: {
    url: String,
    filename: String,
    filepath: String,
    mimetype: String,
    size: Number,
    filesize: Number,  // Alias for compatibility
    uploadedAt: {
      type: Date,
      default: Date.now
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
    bio: String,
    experience: {
      totalYears: Number,
      description: String
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
      amount: Number,
      currency: {
        type: String,
        default: 'INR'
      }
    },
    verifiedBadge: {
      type: Boolean,
      default: false
    },
    portfolio: [{
      title: String,
      images: [String],
      links: [String]
    }]
  },
  
  // ════════════════════════════════════════════════════════════════
  // AI VALIDATION (Optional)
  // ════════════════════════════════════════════════════════════════
  validationResults: {
    coverLetter: {
      action: {
        type: String,
        enum: ['approved', 'flagged', 'rejected', 'pending']
      },
      confidence: {
        type: Number,
        min: 0,
        max: 100
      },
      violations: [String],
      checkedAt: Date
    },
    resume: {
      action: {
        type: String,
        enum: ['approved', 'flagged', 'rejected', 'pending']
      },
      confidence: {
        type: Number,
        min: 0,
        max: 100
      },
      violations: [String],
      checkedAt: Date
    }
  },
  
  // ════════════════════════════════════════════════════════════════
  // STATUS & WORKFLOW
  // ════════════════════════════════════════════════════════════════
  status: {
    type: String,
    enum: ['pending', 'reviewed', 'shortlisted', 'accepted', 'rejected', 'withdrawn'],
    default: 'pending',
    index: true
  },
  
  // ════════════════════════════════════════════════════════════════
  // CLIENT INTERACTION
  // ════════════════════════════════════════════════════════════════
  clientResponse: {
    message: String,
    respondedAt: Date,
    respondedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    }
  },
  
  clientFeedback: {
    message: String,
    decidedAt: Date,
    decidedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    }
  },
  
  // ════════════════════════════════════════════════════════════════
  // TRACKING & ANALYTICS
  // ════════════════════════════════════════════════════════════════
  viewedByClient: {
    type: Boolean,
    default: false
  },
  
  viewedAt: Date,
  
  viewCount: {
    type: Number,
    default: 0
  },
  
  // ════════════════════════════════════════════════════════════════
  // TIMESTAMPS
  // ════════════════════════════════════════════════════════════════
  appliedAt: {
    type: Date,
    default: Date.now,
    index: true
  },
  
  reviewedAt: Date,
  respondedAt: Date,
  acceptedAt: Date,
  rejectedAt: Date,
  
  // ════════════════════════════════════════════════════════════════
  // METADATA
  // ════════════════════════════════════════════════════════════════
  source: {
    type: String,
    enum: ['web', 'mobile', 'api'],
    default: 'web'
  },
  
  ipAddress: String,
  userAgent: String
  
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// ════════════════════════════════════════════════════════════════
// VIRTUALS
// ════════════════════════════════════════════════════════════════

applicationSchema.virtual('isPending').get(function() {
  return this.status === 'pending';
});

applicationSchema.virtual('isAccepted').get(function() {
  return this.status === 'accepted';
});

applicationSchema.virtual('isRejected').get(function() {
  return this.status === 'rejected';
});

applicationSchema.virtual('daysOld').get(function() {
  return Math.floor((Date.now() - this.appliedAt) / (1000 * 60 * 60 * 24));
});

applicationSchema.virtual('hasResume').get(function() {
  return !!(this.resume && (this.resume.url || this.resume.filepath));
});

// ════════════════════════════════════════════════════════════════
// INDEXES
// ════════════════════════════════════════════════════════════════

// Prevent duplicate applications
applicationSchema.index({ jobId: 1, employeeId: 1 }, { unique: true });

// Query optimization
applicationSchema.index({ clientId: 1, status: 1 });
applicationSchema.index({ employeeId: 1, status: 1 });
applicationSchema.index({ jobId: 1, status: 1 });
applicationSchema.index({ jobId: 1, appliedAt: -1 });
applicationSchema.index({ status: 1, appliedAt: -1 });
applicationSchema.index({ clientId: 1, viewedByClient: 1 });

// Text search
applicationSchema.index({ 
  applicantName: 'text', 
  applicantEmail: 'text',
  coverLetter: 'text'
});

// ════════════════════════════════════════════════════════════════
// PRE-SAVE MIDDLEWARE
// ════════════════════════════════════════════════════════════════

// ════════════════════════════════════════════════════════════════
// PRE-SAVE MIDDLEWARE
// ════════════════════════════════════════════════════════════════

applicationSchema.pre('save', async function() {
  // Auto-set timestamps based on status changes
  if (this.isModified('status')) {
    const now = new Date();
    
    if (this.status === 'reviewed' && !this.reviewedAt) {
      this.reviewedAt = now;
    }
    
    if (this.status === 'accepted' && !this.acceptedAt) {
      this.acceptedAt = now;
      this.respondedAt = now;
    }
    
    if (this.status === 'rejected' && !this.rejectedAt) {
      this.rejectedAt = now;
      this.respondedAt = now;
    }
  }
  
  // ✅ No need for next() in async functions
});
// ════════════════════════════════════════════════════════════════
// STATIC METHODS
// ════════════════════════════════════════════════════════════════

applicationSchema.statics.getApplicationStats = async function(jobId) {
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
    reviewed: stats.find(s => s._id === 'reviewed')?.count || 0,
    shortlisted: stats.find(s => s._id === 'shortlisted')?.count || 0,
    accepted: stats.find(s => s._id === 'accepted')?.count || 0,
    rejected: stats.find(s => s._id === 'rejected')?.count || 0
  };
};

applicationSchema.statics.hasApplied = async function(jobId, employeeId) {
  const existing = await this.findOne({ jobId, employeeId });
  return !!existing;
};

// ════════════════════════════════════════════════════════════════
// INSTANCE METHODS
// ════════════════════════════════════════════════════════════════

applicationSchema.methods.accept = function(feedback) {
  this.status = 'accepted';
  this.acceptedAt = new Date();
  if (feedback) {
    this.clientFeedback = {
      message: feedback.message || '',
      decidedAt: new Date(),
      decidedBy: feedback.decidedBy
    };
  }
  return this.save();
};

applicationSchema.methods.reject = function(feedback) {
  this.status = 'rejected';
  this.rejectedAt = new Date();
  if (feedback) {
    this.clientFeedback = {
      message: feedback.message || '',
      decidedAt: new Date(),
      decidedBy: feedback.decidedBy
    };
  }
  return this.save();
};

applicationSchema.methods.markAsViewed = function() {
  if (!this.viewedByClient) {
    this.viewedByClient = true;
    this.viewedAt = new Date();
    this.viewCount = (this.viewCount || 0) + 1;
    return this.save();
  }
  this.viewCount = (this.viewCount || 0) + 1;
  return this.save();
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

applicationSchema.query.forEmployee = function(employeeId) {
  return this.where({ employeeId });
};

applicationSchema.query.forClient = function(clientId) {
  return this.where({ clientId });
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