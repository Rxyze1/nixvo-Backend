// models/USER-Auth/Official-Model.js

import mongoose from 'mongoose';
import { backupDocument } from '../../Service/Backup-DB/backupService.js';

const OfficialSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true,
    },

    // ═══════════════════════════════════════════════════════════
    // PROFILE
    // ═══════════════════════════════════════════════════════════

    profilePic: {           // ✅ Fixed typo from 'prifilePic'
      type: String,
      default: '',
      trim: true,
    },

    bannerImage: {
      type: String,
      default: '',
      trim: true,
    },

    // ═══════════════════════════════════════════════════════════
    // ACTIVITY LOG
    // Capped at 100 entries via \$slice in logAdminActivity()
    // ═══════════════════════════════════════════════════════════

    activityLog: [
      {
        action: {
          type: String,
          required: true,
          trim: true,
        },
        targetUserId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'User',        // ✅ Added ref
        },
        reason: {
          type: String,
          trim: true,
          maxlength: [500, 'Reason cannot exceed 500 characters'],
        },
        timestamp: {
          type: Date,
          default: Date.now,
        },
        _id: false,
      },
    ],

    // ═══════════════════════════════════════════════════════════
    // ADMIN STATS
    // ═══════════════════════════════════════════════════════════

    adminStats: {
      usersVerified:    { type: Number, default: 0, min: 0 },
      ticketsResolved:  { type: Number, default: 0, min: 0 },
      disputesResolved: { type: Number, default: 0, min: 0 },
      usersStrikes:     { type: Number, default: 0, min: 0 },
      usersBanned:      { type: Number, default: 0, min: 0 },
      performanceRating:{ type: Number, default: 0, min: 0, max: 5 },
      _id: false,           // ✅ No unnecessary _id on plain subdoc
    },

    // ═══════════════════════════════════════════════════════════
    // ASSIGNMENTS
    // ═══════════════════════════════════════════════════════════

    assignedTickets: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Ticket',      // ✅ Added ref
      },
    ],

    assignedDisputes: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Dispute',     // ✅ Added ref
      },
    ],

    // ═══════════════════════════════════════════════════════════
    // WORK SCHEDULE
    // ═══════════════════════════════════════════════════════════

    workSchedule: {
      timezone: {
        type: String,
        default: 'UTC',
        trim: true,
      },
      workingHours: {
        start: {
          type: String,
          default: '09:00',
          match: [/^([01]\d|2[0-3]):([0-5]\d)$/, 'Use HH:MM format'], // ✅ Validated
        },
        end: {
          type: String,
          default: '17:00',
          match: [/^([01]\d|2[0-3]):([0-5]\d)$/, 'Use HH:MM format'], // ✅ Validated
        },
        _id: false,
      },
      _id: false,           // ✅ No _id on plain subdoc
    },

    // ═══════════════════════════════════════════════════════════
    // AUDIT
    // Note: lastLoginAt mirrors User.lastLogin — update both
    //       together in the login controller.
    // ═══════════════════════════════════════════════════════════

    audit: {
      lastLoginAt:          Date,
      lastActivityAt:       Date,
      failedLoginAttempts:  { type: Number, default: 0, min: 0 },
      accountLockedUntil:   Date,
      _id: false,           // ✅ No _id on plain subdoc
    },
  },
  { timestamps: true }
);

// ═══════════════════════════════════════════════════════════════
// INDEXES
// ═══════════════════════════════════════════════════════════════

// userId has unique:true so its index is auto-created — no duplicate needed
// Removed: OfficialSchema.index({ adminRole: 1 }) ← field doesn't exist

// ═══════════════════════════════════════════════════════════════
// INSTANCE METHODS
// ═══════════════════════════════════════════════════════════════

// Check if account is currently locked
OfficialSchema.methods.isLocked = function () {
  return !!(this.audit?.accountLockedUntil && this.audit.accountLockedUntil > new Date());
};

// Lock account for N minutes (default 15)
OfficialSchema.methods.lockAccount = function (durationMinutes = 15) {
  this.audit.accountLockedUntil = new Date(Date.now() + durationMinutes * 60 * 1000);
  this.audit.failedLoginAttempts = 0;
  return this.save();
};

// Reset failed login state after successful login
OfficialSchema.methods.resetFailedLogins = function () {
  this.audit.failedLoginAttempts = 0;
  this.audit.accountLockedUntil  = null;
  this.audit.lastLoginAt         = new Date();
  return this.save();
};

// Increment a specific stat counter
OfficialSchema.methods.incrementStat = function (statField) {
  if (this.adminStats[statField] !== undefined) {
    this.adminStats[statField] += 1;
  }
  return this.save();
};

// ═══════════════════════════════════════════════════════════════
// EXPORT
// ═══════════════════════════════════════════════════════════════



// ─────────────────────────────────────────────────────────────
// BACKUP HOOKS
// ─────────────────────────────────────────────────────────────


// ─── Pre-Save Hooks ───────────────────────────────────────────

OfficialSchema.pre('save', async function () {
  this._wasNew = this.isNew;
});
// ─── Post-Save Hooks ───────────────────────────────────────────
// ✅ Post-hooks are async-aware, don't need next()

OfficialSchema.post('save', async function () {
  try {
    await backupDocument('officials', this._wasNew ? 'create' : 'update', this);
  } catch (err) {
    console.error('⚠️ [BACKUP] post.save failed (officials):', err.message);
  }
});

OfficialSchema.post('findOneAndDelete', async function (doc) {
  if (!doc) return;
  try {
    await backupDocument('officials', 'delete', doc);
  } catch (err) {
    console.error('⚠️ [BACKUP] post.findOneAndDelete failed (officials):', err.message);
  }
});

OfficialSchema.post('deleteOne', { document: true, query: false }, async function () {
  try {
    await backupDocument('officials', 'delete', this);
  } catch (err) {
    console.error('⚠️ [BACKUP] post.deleteOne failed (officials):', err.message);
  }
});

OfficialSchema.post('findOneAndUpdate', async function (doc) {
  if (!doc) return;
  try {
    await backupDocument('officials', 'update', doc);
  } catch (err) {
    console.error('⚠️ [BACKUP] post.findOneAndUpdate failed (officials):', err.message);
  }
});

const Official = mongoose.models.Official || mongoose.model('Official', OfficialSchema);
export default Official;