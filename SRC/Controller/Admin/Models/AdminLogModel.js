// Models/AdminLogModel.js

import mongoose from 'mongoose';

// ═══════════════════════════════════════════════════════════════
// CONSTANTS
// Single source of truth — used in pre-save hook AND instance method
// ═══════════════════════════════════════════════════════════════

const CRITICAL_ACTIONS = [
  'DELETE_ADMIN',
  'BAN_ADMIN',
  'DELETE_USER',
  'UPDATE_ADMIN_PERMISSIONS',
  'SYSTEM_MAINTENANCE',
  'BACKUP_DATA',
];

const VALID_ACTIONS = [
  // Authentication
  'LOGIN',
  'LOGOUT',
  'FAILED_LOGIN',

  // ✅ Employee Management (was missing — broke audit trail on approve/reject)
  'APPROVE_EMPLOYEE',
  'REJECT_EMPLOYEE',

  // Admin Management
  'APPROVE_ADMIN',
  'REJECT_ADMIN',
  'BAN_ADMIN',
  'SUSPEND_ADMIN',
  'DELETE_ADMIN',
  'UPDATE_ADMIN_ROLE',
  'UPDATE_ADMIN_PERMISSIONS',

  // User Management
  'APPROVE_USER',
  'REJECT_USER',
  'BAN_USER',
  'SUSPEND_USER',
  'UNBAN_USER',
  'DELETE_USER',
  'RESET_USER_PASSWORD',
  'UPDATE_USER_STATUS',
  'VERIFY_USER',
  'STRIKE_USER',

  // Content Moderation
  'DELETE_POST',
  'DELETE_COMMENT',
  'FLAG_CONTENT',
  'APPROVE_CONTENT',
  'REJECT_CONTENT',

  // Ticket Management
  'ASSIGN_TICKET',
  'RESOLVE_TICKET',
  'CLOSE_TICKET',
  'ESCALATE_TICKET',

  // Dispute Management
  'ASSIGN_DISPUTE',
  'RESOLVE_DISPUTE',
  'CLOSE_DISPUTE',

  // System Actions
  'UPDATE_SETTINGS',
  'VIEW_LOGS',
  'EXPORT_DATA',
  'BACKUP_DATA',
  'SYSTEM_MAINTENANCE',

  'OTHER',
];

const VALID_TARGET_TYPES = [
  'admin',
  'user',
  'employee',
  'client',
  'post',
  'comment',
  'ticket',
  'dispute',
  'system',
  'content',
  'other',
];

// ═══════════════════════════════════════════════════════════════
// SCHEMA
// ═══════════════════════════════════════════════════════════════

const AdminLogSchema = new mongoose.Schema(
  {
    // ─── Admin ────────────────────────────────────────────────
    adminId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Admin ID is required'],
      // ✅ Removed: index:true — covered by compound index below
    },

    // ─── Action ───────────────────────────────────────────────
    action: {
      type: String,
      required: [true, 'Action type is required'],
      enum: {
        values: VALID_ACTIONS,
        message: 'Invalid action: {VALUE}',
      },
      // ✅ Removed: index:true — covered by compound index below
    },

    // ─── Target ───────────────────────────────────────────────
    targetType: {
      type: String,
      required: [true, 'Target type is required'],
      enum: {
        values: VALID_TARGET_TYPES,
        message: 'Invalid target type: {VALUE}',
      },
      // ✅ Removed: index:true — covered by compound index below
    },

    targetId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null, // ✅ Fixed: was required — broke SYSTEM_MAINTENANCE, BACKUP_DATA etc.
      // ✅ Removed: index:true — covered by compound index below
    },

    // ─── Details ──────────────────────────────────────────────
    details: {
      reason: {
        type: String,
        default: '',
        maxlength: [1000, 'Reason cannot exceed 1000 characters'],
        trim: true,
      },
      description: {
        type: String,
        default: '',
        maxlength: [2000, 'Description cannot exceed 2000 characters'],
        trim: true,
      },
      previousState: {
        type: mongoose.Schema.Types.Mixed,
        default: null,
      },
      newState: {
        type: mongoose.Schema.Types.Mixed,
        default: null,
      },
      ipAddress: {
        type: String,
        default: '',
        trim: true,
      },
      userAgent: {
        type: String,
        default: '',
        trim: true,
      },
      location: {
        country:     { type: String, default: '' },
        city:        { type: String, default: '' },
        coordinates: {
          latitude:  { type: Number, default: null },
          longitude: { type: Number, default: null },
        },
      },
      targetEmail: {
        type: String,
        default: '',
        trim: true,
        lowercase: true,
      },
      targetName: {
        type: String,
        default: '',
        trim: true,
      },
      approvedRole: {
        type: String,
        default: '',
      },
      permissions: {
        type: [String],
        default: [],
      },
      duration: {
        type: Number, // days
        default: null,
      },
      expiresAt: {
        type: Date,
        default: null,
      },
      // ✅ metadata absorbs any extra fields controllers pass
      // e.g. { email, verificationMethod, rejectionReason... }
      metadata: {
        type: mongoose.Schema.Types.Mixed,
        default: {},
      },
    },

    // ─── Timestamp ────────────────────────────────────────────
    timestamp: {
      type: Date,
      default: Date.now,
      // ✅ Removed: index:true — covered by every compound index below
    },

    // ─── Review Flags ─────────────────────────────────────────
    isReviewed: {
      type: Boolean,
      default: false,
    },
    reviewedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    reviewedAt: {
      type: Date,
      default: null,
    },
    reviewNotes: {
      type: String,
      default: '',
      trim: true,
    },
    isCritical: {
      type: Boolean,
      default: false,
    },
    isSuspicious: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
    collection: 'admin_logs',
    strict: false, // ✅ Allows controllers to store extra fields in details
                   //    without Mongoose silently dropping them
  }
);

// ═══════════════════════════════════════════════════════════════
// INDEXES
// ✅ Removed all redundant field-level index:true declarations above.
//    These compound indexes cover every query pattern.
// ═══════════════════════════════════════════════════════════════

AdminLogSchema.index({ adminId: 1,    timestamp: -1 }); // "logs for admin X"
AdminLogSchema.index({ action: 1,     timestamp: -1 }); // "all APPROVE_EMPLOYEE actions"
AdminLogSchema.index({ targetType: 1, targetId: 1   }); // "all actions on employee Y"
AdminLogSchema.index({ targetType: 1, timestamp: -1 }); // "all actions on employees"
AdminLogSchema.index({ isCritical: 1,  timestamp: -1 });
AdminLogSchema.index({ isSuspicious: 1, isReviewed: 1 });
AdminLogSchema.index({ 'details.targetEmail': 1 });

AdminLogSchema.index({
  action:                  'text',
  'details.reason':        'text',
  'details.description':   'text',
  'details.targetEmail':   'text',
  'details.targetName':    'text',
});

// ═══════════════════════════════════════════════════════════════
// PRE-SAVE HOOK
// ✅ Uses CRITICAL_ACTIONS constant — no duplication
// ═══════════════════════════════════════════════════════════════

// AdminLogSchema.pre('save', function (next) {  ← THIS
AdminLogSchema.pre('save', async function () {
  if (CRITICAL_ACTIONS.includes(this.action)) {
    this.isCritical = true;
  }
});

// ═══════════════════════════════════════════════════════════════
// STATIC METHODS
// ═══════════════════════════════════════════════════════════════

// ✅ Shorthand used in all controllers — never throws
AdminLogSchema.statics.log = async function (adminId, action, targetType, targetId, details = {}) {
  try {
    return await this.create({ adminId, action, targetType, targetId, details });
  } catch (err) {
    console.error('❌ AdminLog.log failed:', err.message);
    // Intentionally silent — logging must never crash the main request flow
  }
};

// ─────────────────────────────────────────────────────────────

AdminLogSchema.statics.getLogsByAdmin = async function (adminId, options = {}) {
  const {
    skip       = 0,
    action     = null,
    targetType = null,
    startDate  = null,
    endDate    = null,
  } = options;

  const cappedLimit = Math.min(parseInt(options.limit) || 50, 200); // ✅ Capped
  const query = { adminId };

  if (action)     query.action     = action;
  if (targetType) query.targetType = targetType;

  if (startDate || endDate) {
    query.timestamp = {};
    if (startDate) query.timestamp.$gte = new Date(startDate);
    if (endDate)   query.timestamp.$lte = new Date(endDate);
  }

  return this.find(query)
    .populate('adminId', 'fullname username email role')
    .sort({ timestamp: -1 })
    .limit(cappedLimit)
    .skip(skip)
    .lean();
};

// ─────────────────────────────────────────────────────────────

AdminLogSchema.statics.getLogsByTarget = async function (targetId, targetType, options = {}) {
  const cappedLimit = Math.min(parseInt(options.limit) || 50, 200); // ✅ Capped
  const skip = options.skip || 0;

  return this.find({ targetId, targetType })
    .populate('adminId', 'fullname username email role')
    .sort({ timestamp: -1 })
    .limit(cappedLimit)
    .skip(skip)
    .lean();
};

// ─────────────────────────────────────────────────────────────

AdminLogSchema.statics.getCriticalActions = async function (limit = 20) {
  const cappedLimit = Math.min(parseInt(limit), 100); // ✅ Capped

  return this.find({ isCritical: true })
    .populate('adminId', 'fullname username email role')
    .sort({ timestamp: -1 })
    .limit(cappedLimit)
    .lean();
};

// ─────────────────────────────────────────────────────────────

AdminLogSchema.statics.getSuspiciousActions = async function (limit = 20) {
  const cappedLimit = Math.min(parseInt(limit), 100); // ✅ Capped

  return this.find({ isSuspicious: true, isReviewed: false })
    .populate('adminId', 'fullname username email role')
    .sort({ timestamp: -1 })
    .limit(cappedLimit)
    .lean();
};

// ─────────────────────────────────────────────────────────────
// ✅ Fixed: was loading all docs into JS memory — now uses aggregation

AdminLogSchema.statics.getAdminActivitySummary = async function (adminId, startDate, endDate) {
  const match = { adminId: new mongoose.Types.ObjectId(adminId) };

  if (startDate || endDate) {
    match.timestamp = {};
    if (startDate) match.timestamp.$gte = new Date(startDate);
    if (endDate)   match.timestamp.$lte = new Date(endDate);
  }

  const [result] = await this.aggregate([
    { $match: match },
    {
      $facet: {
        totals: [
          {
            $group: {
              _id: null,
              totalActions:      { $sum: 1 },
              criticalActions:   { $sum: { $cond: ['$isCritical',   1, 0] } },
              suspiciousActions: { $sum: { $cond: ['$isSuspicious', 1, 0] } },
            },
          },
        ],
        byAction: [
          { $group: { _id: '$action',     count: { $sum: 1 } } },
          { $sort:  { count: -1 } },
        ],
        byTarget: [
          { $group: { _id: '$targetType', count: { $sum: 1 } } },
          { $sort:  { count: -1 } },
        ],
      },
    },
    {
      $project: {
        totalActions:      { $ifNull: [{ $arrayElemAt: ['$totals.totalActions',      0] }, 0] },
        criticalActions:   { $ifNull: [{ $arrayElemAt: ['$totals.criticalActions',   0] }, 0] },
        suspiciousActions: { $ifNull: [{ $arrayElemAt: ['$totals.suspiciousActions', 0] }, 0] },
        actionBreakdown:   '$byAction',
        targetBreakdown:   '$byTarget',
      },
    },
  ]);

  return result || {
    totalActions:      0,
    criticalActions:   0,
    suspiciousActions: 0,
    actionBreakdown:   [],
    targetBreakdown:   [],
  };
};

// ─────────────────────────────────────────────────────────────

AdminLogSchema.statics.markAsReviewed = async function (logId, reviewerId, notes = '') {
  return this.findByIdAndUpdate(
    logId,
    {
      isReviewed:  true,
      reviewedBy:  reviewerId,
      reviewedAt:  new Date(),
      reviewNotes: notes,
    },
    { new: true }
  );
};

// ─────────────────────────────────────────────────────────────

AdminLogSchema.statics.searchLogs = async function (searchTerm, options = {}) {
  const cappedLimit = Math.min(parseInt(options.limit) || 50, 200); // ✅ Capped
  const skip = options.skip || 0;

  return this.find(
    { $text: { $search: searchTerm } },
    { score: { $meta: 'textScore' } }
  )
    .populate('adminId', 'fullname username email role')
    .sort({ score: { $meta: 'textScore' }, timestamp: -1 })
    .limit(cappedLimit)
    .skip(skip)
    .lean();
};

// ─────────────────────────────────────────────────────────────

AdminLogSchema.statics.getLogsByDateRange = async function (startDate, endDate, options = {}) {
  const cappedLimit = Math.min(parseInt(options.limit) || 100, 500); // ✅ Capped
  const { skip = 0, action = null, targetType = null } = options;

  const query = {
    timestamp: {
      $gte: new Date(startDate),
      $lte: new Date(endDate),
    },
  };

  if (action)     query.action     = action;
  if (targetType) query.targetType = targetType;

  return this.find(query)
    .populate('adminId', 'fullname username email role')
    .sort({ timestamp: -1 })
    .limit(cappedLimit)
    .skip(skip)
    .lean();
};

// ─────────────────────────────────────────────────────────────

AdminLogSchema.statics.getActionStatistics = async function (startDate, endDate) {
  const matchStage = {};

  if (startDate || endDate) {
    matchStage.timestamp = {};
    if (startDate) matchStage.timestamp.$gte = new Date(startDate);
    if (endDate)   matchStage.timestamp.$lte = new Date(endDate);
  }

  return this.aggregate([
    ...(Object.keys(matchStage).length > 0 ? [{ $match: matchStage }] : []),
    {
      $group: {
        _id:    '$action',
        count:  { $sum: 1 },
        admins: { $addToSet: '$adminId' },
      },
    },
    {
      $project: {
        action:       '$_id',
        count:        1,
        uniqueAdmins: { $size: '$admins' },
        _id:          0,
      },
    },
    { $sort: { count: -1 } },
  ]);
};

// ═══════════════════════════════════════════════════════════════
// INSTANCE METHODS
// ═══════════════════════════════════════════════════════════════

// ✅ Uses shared CRITICAL_ACTIONS constant — no duplication
AdminLogSchema.methods.checkIfCritical = function () {
  return CRITICAL_ACTIONS.includes(this.action);
};

AdminLogSchema.methods.flagAsSuspicious = async function () {
  this.isSuspicious = true;
  return this.save();
};

// ═══════════════════════════════════════════════════════════════
// VIRTUALS
// ═══════════════════════════════════════════════════════════════

AdminLogSchema.virtual('age').get(function () {
  return this.timestamp ? Date.now() - this.timestamp.getTime() : null; // ✅ Null check
});

AdminLogSchema.virtual('ageInDays').get(function () {
  return this.age !== null ? Math.floor(this.age / (1000 * 60 * 60 * 24)) : null; // ✅ Null check
});

AdminLogSchema.set('toObject', { virtuals: true });
AdminLogSchema.set('toJSON',   { virtuals: true });

// ═══════════════════════════════════════════════════════════════
// EXPORT
// ✅ mongoose.models guard prevents hot-reload crash in development
// ═══════════════════════════════════════════════════════════════

const AdminLog = mongoose.models.AdminLog || mongoose.model('AdminLog', AdminLogSchema);

export default AdminLog;