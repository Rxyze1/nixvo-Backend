// Models/USER-Auth/User-Auth.Model.js

import mongoose from 'mongoose';
import bcrypt   from 'bcryptjs';
import { backupDocument } from '../../Service/Backup-DB/backupService.js';

// ─────────────────────────────────────────────────────────────
// SUB-SCHEMAS
// ─────────────────────────────────────────────────────────────
const adminMetadataSchema = new mongoose.Schema({
  appliedAt:       { type: Date },
  approvedAt:      { type: Date },
  approvedBy:      { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  rejectedAt:      { type: Date },
  rejectedBy:      { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  rejectionReason: { type: String, maxlength: 500 },
  permissions:     [{ type: String, trim: true }],
}, { _id: false });

const bankAccountSchema = new mongoose.Schema({
  accountHolderName: { type: String, trim: true },
  accountNumber:     { type: String, trim: true },
  ifsc:              { type: String, trim: true, uppercase: true },
  bankName:          { type: String, trim: true },
}, { _id: false });

// ─────────────────────────────────────────────────────────────
// USER SCHEMA
// ─────────────────────────────────────────────────────────────
const UserSchema = new mongoose.Schema(
  {
    // ── Identity ──
    fullname: {
      type:      String,
      required:  [true, 'Full name is required'],
      trim:      true,
      minlength: [2,   'Full name must be at least 2 characters'],
      maxlength: [100, 'Full name cannot exceed 100 characters'],
    },
    username: {
      type:      String,
      required:  [true, 'Username is required'],
      unique:    true,
      lowercase: true,
      trim:      true,
      minlength: [3,  'Username must be at least 3 characters'],
      maxlength: [30, 'Username cannot exceed 30 characters'],
      match: [
        /^[a-z0-9_-]+$/,
        'Username can only contain lowercase letters, numbers, hyphens, and underscores',
      ],
    },
    email: {
      type:      String,
      required:  [true, 'Email is required'],
      unique:    true,
      lowercase: true,
      trim:      true,
      match: [
        /^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/,
        'Please provide a valid email',
      ],
    },

    phone: {
      type:  String,
      // ← sparse removed — not a valid schema field option
      // sparse behaviour comes from the index definition below ✅
      trim:  true,
      match: [
        /^[+]?[(]?[0-9]{1,4}[)]?[-\s.]?[(]?[0-9]{1,4}[)]?[-\s.]?[0-9]{1,9}$/,
        'Please provide a valid phone number',
      ],
    },
    password: {
      type:      String,
      required:  [true, 'Password is required'],
      select:    false,
      minlength: [8, 'Password must be at least 8 characters'],
    },

    // ── User type — what this account IS ──
    // escrow.service  → checks userType for 'client' / 'employee'
    // payment.service → checks userType for 'employee' withdrawal guard
    userType: {
      type:     String,
      enum:     {
        values:  ['employee', 'client', 'officials'],
        message: 'userType must be employee, client, or officials',
      },
      required: [true, 'User type is required'],
    },
    
    // Inside UserSchema, add this new field:

    
 // ── Push Notifications ──
    expoPushToken:     { type: String, default: null },
    pushTokenUpdatedAt: { type: Date, default: null },
    pushTokenPlatform:  { type: String, enum: ['expo', 'web'], default: null },

    // ── Role — permission hierarchy only ──
    // admin/moderator controllers check this
    // NEVER check role for 'client' / 'employee' — use userType
    role: {
      type:    String,
      enum:    {
        values:  ['user', 'admin', 'staff', 'moderator', 'super_admin'],
        message: 'Invalid role specified',
      },
      default: 'user',
    },

    // ── Verification ──
    isEmailVerified: { type: Boolean, default: false },
    isAdminVerified: { type: Boolean, default: false },
    adminVerificationStatus: {

      type:    String,
      enum:    {
        values:  ['pending', 'approved', 'rejected'],
        message: 'Invalid admin verification status',
      },
      default: 'pending',
    },


    adminMetadata: {
      type:    adminMetadataSchema,
      default: () => ({}),
    },

    // ── Auth tokens ──
    passwordResetToken:   { type: String, select: false },
    passwordResetExpires: { type: Date,   select: false },
    passwordChangedAt:    { type: Date },

    // ── Account status ──
    status: {
      type:    String,
      enum:    {
        values:  ['pending', 'active', 'suspended', 'banned', 'frozen', 'rejected'],
        message: 'Invalid user status',
      },
      default: 'active',
    },
    strikes: {
      count:       { type: Number, default: 0, min: 0, max: 3 },
      freezeUntil: { type: Date },
      _id:         false,
    },

    // ── Activity ──
    lastLogin:  { type: Date },
    lastActive: { type: Date },

    // ── Ratings ──
    ratings: {
      average: { type: Number, default: 0, min: 0, max: 5 },
      count:   { type: Number, default: 0, min: 0 },
      _id:     false,
    },

    // ── Stats ──
    stats: {
      totalJobsPosted:    { type: Number, default: 0, min: 0 },
      totalJobsCompleted: { type: Number, default: 0, min: 0 },
      totalApplications:  { type: Number, default: 0, min: 0 },
      _id:                false,
    },




    // ✅ ONLY reference to Subscription
  subscriptionId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Subscription',
    default: null,
  },





    // ── Bank + Payout — employee only ──
    // payment.service reads these when creating Razorpay payout
    bankAccount:           { type: bankAccountSchema, default: null },
    razorpayFundAccountId: { type: String, default: null },

    // ── Wallet REMOVED ──
    // WalletModel owns pending / available / withdrawn
    // See Models/Subscription/WalletModel.js
  },
  {
    timestamps: true,
    toJSON:     { virtuals: true },
    toObject:   { virtuals: true },
  }
);

// ─────────────────────────────────────────────────────────────
// INDEXES
// ─────────────────────────────────────────────────────────────
UserSchema.index({ userType: 1, status: 1 });
UserSchema.index({ email:    1 });
UserSchema.index({ username: 1 });
UserSchema.index({ createdAt: -1 });
UserSchema.index({ phone: 1 }, { sparse: true }); // ← sparse lives here only
// ✅ CORRECT
UserSchema.index({ subscriptionId: 1 }, { sparse: true });

// ─────────────────────────────────────────────────────────────
// PRE-SAVE — PASSWORD HASH → REMOVED
//
// ⚠️  DO NOT add a password hashing hook here.
//
// authController hashes passwords manually before every save:
//   verifySignupOTP → bcrypt.hash(otpDoc.password, 12)
//   verifyResetOTP  → bcrypt.hash(newPassword, 12)
//
// Adding a hook here causes DOUBLE HASHING:
//   controller hashes → hook hashes again →
//   comparePassword always returns false → every login breaks
// ─────────────────────────────────────────────────────────────

// ─────────────────────────────────────────────────────────────
// PRE-SAVE — INITIAL STATUS
// Only runs on document creation (isNew)
// Sets status, adminVerificationStatus, isAdminVerified
// based on userType
// ─────────────────────────────────────────────────────────────
// ✅ FIX — async style, Mongoose awaits the returned promise
UserSchema.pre('save', async function () {
  if (!this.isNew) return;

  this.lastActive = new Date();

  if (this.userType === 'client') {
    this.status                   = 'active';
    this.adminVerificationStatus  = 'approved';
    this.isAdminVerified          = true;
    this.adminMetadata.approvedAt = new Date();
  } else if (this.userType === 'employee') {
    // ✅ active so they can login and complete profile
    // status becomes pending AFTER profile completion in EmployeeProfileController
    this.status                  = 'active';
    this.adminVerificationStatus = 'pending';
    this.isAdminVerified         = false;
    this.adminMetadata.appliedAt = new Date();
  } 
});
// ─────────────────────────────────────────────────────────────
// VIRTUALS
// ─────────────────────────────────────────────────────────────

// payment.service passes user.name to razorpay.contacts.create
// model stores fullname → this virtual bridges the gap
UserSchema.virtual('name').get(function () {
  return this.fullname;
});




// TO ✅
UserSchema.virtual('canLogin').get(function () {
  // Hard-blocked statuses — pending allowed for employees (awaiting admin review)
  if (['banned', 'rejected'].includes(this.status)) {
    return false;
  }
  if (this.status === 'pending' && this.userType !== 'employee') {
    return false;
  }
  // Frozen — block only while freeze window is active
  if (this.status === 'frozen' && this.strikes?.freezeUntil) {
    if (this.strikes.freezeUntil > new Date()) return false;
  }
  return true;
});



UserSchema.virtual('isAccountSuspended').get(function () {
  return ['suspended', 'frozen', 'banned'].includes(this.status);
});




UserSchema.virtual('isBlueVerified').get(function () {
  // ✅ Returns TRUE only if:
  // 1. Has active subscription
  // 2. Plan is NOT 'free'
  // 3. Subscription status is 'active'
  // 4. Not expired
  
  if (!this.subscriptionId) return false;
  
  const sub = this.subscriptionId;
  
  // Check if subscription is populated (not just ObjectId)
  if (!sub.plan) return false;
  
  const isPremiumPlan = sub.plan && sub.plan !== 'free';
  const isActive = sub.subscriptionStatus === 'active';
  const isNotExpired = new Date() < new Date(sub.planExpiresAt);
  
  return isPremiumPlan && isActive && isNotExpired;
});









// ─────────────────────────────────────────────────────────────
// INSTANCE METHODS
// ─────────────────────────────────────────────────────────────
UserSchema.methods.comparePassword = async function (candidatePassword) {
  if (!candidatePassword) {
    throw new Error('Password candidate is required');
  }

  // If password wasn't selected, fetch it
  if (!this.password) {
    const user = await this.constructor
      .findById(this._id)
      .select('password');
    
    if (!user) {
      throw new Error('User not found');
    }

    return bcrypt.compare(candidatePassword, user.password);
  }

  return bcrypt.compare(candidatePassword, this.password);
};















// ─────────────────────────────────────────────────────────────
// INSTANCE METHOD — getPublicProfile
// ─────────────────────────────────────────────────────────────
// ─────────────────────────────────────────────────────────────
// INSTANCE METHOD — getPublicProfile
// ─────────────────────────────────────────────────────────────
// ─────────────────────────────────────────────────────────────
// ✅ INSTANCE METHOD
// ─────────────────────────────────────────────────────────────
UserSchema.methods.getPublicProfile = async function () {
  try {
    let user = this;

    // Always populate subscription if referenced
    if (this.subscriptionId) {
      user = await this.constructor
        .findById(this._id)
        .select('-password -passwordResetToken -passwordResetExpires')
        .populate({
          path: 'subscriptionId',
          select: 'plan subscriptionStatus planActivatedAt planExpiresAt',
          strictPopulate: false,
        });

      if (!user) {
        throw new Error('User not found during profile fetch');
      }
    }

    const subscriptionData = this._buildSubscriptionObject(user.subscriptionId);
    const blueBadge = this._buildBlueBadge(user.subscriptionId);

    return {
      id:              user._id?.toString(),
      fullname:        user.fullname,
      username:        user.username,
      blueVerified:    blueBadge,
      email:           user.email,
      phone:           user.phone || null,
      userType:        user.userType,
      role:            user.role,
      subscription:    subscriptionData,
      ratings:         user.ratings || { average: 0, count: 0 },
      isAdminVerified: user.isAdminVerified,
      isEmailVerified: user.isEmailVerified,
      status:          user.status,
      stats:           user.stats || {
        totalJobsPosted:    0,
        totalJobsCompleted: 0,
        totalApplications:  0,
      },
      createdAt:       user.createdAt,
    };
  } catch (error) {
    throw new Error(`Failed to build public profile: ${error.message}`);
  }
};


// ─────────────────────────────────────────────────────────────
// PRIVATE HELPER — Build subscription object safely
// ─────────────────────────────────────────────────────────────
UserSchema.methods._buildSubscriptionObject = function (subscriptionData) {
  if (!subscriptionData) {
    return null;
  }

  // Validate required fields exist before accessing
  const requiredFields = ['plan', 'subscriptionStatus', 'planActivatedAt', 'planExpiresAt'];
  const hasAllFields = requiredFields.every(field => field in subscriptionData);

  if (!hasAllFields) {
    console.warn(`[User] Subscription ${subscriptionData._id} missing required fields`);
    return null;
  }

  return {
    plan:            subscriptionData.plan,
    status:          subscriptionData.subscriptionStatus,
    planActivatedAt: subscriptionData.planActivatedAt,
    planExpiresAt:   subscriptionData.planExpiresAt,
  };
};

// ─────────────────────────────────────────────────────────────
// STATIC METHOD — Better for batch operations & testing
// ─────────────────────────────────────────────────────────────
// ─────────────────────────────────────────────────────────────
// STATIC METHOD — Better for batch operations & testing
// ─────────────────────────────────────────────────────────────
// ─────────────────────────────────────────────────────────────
// ✅ STATIC METHOD
// ─────────────────────────────────────────────────────────────
UserSchema.statics.getPublicProfileById = async function (userId) {
  if (!userId) {
    throw new Error('userId is required');
  }

  try {
    const user = await this.findById(userId)
      .select('-password -passwordResetToken -passwordResetExpires')
      .populate({
        path: 'subscriptionId',
        select: 'plan subscriptionStatus planActivatedAt planExpiresAt',
        strictPopulate: false,
      });

    if (!user) {
      return null;
    }

    const subscription = user._buildSubscriptionObject(user.subscriptionId);
    const blueBadge = user._buildBlueBadge(user.subscriptionId);

    return {
      id:              user._id?.toString(),
      fullname:        user.fullname,
      username:        user.username,
      blueVerified:    blueBadge,
      email:           user.email,
      phone:           user.phone || null,
      userType:        user.userType,
      role:            user.role,
      subscription:    subscription,
      ratings:         user.ratings || { average: 0, count: 0 },
      isAdminVerified: user.isAdminVerified,
      isEmailVerified: user.isEmailVerified,
      status:          user.status,
      stats:           user.stats || {
        totalJobsPosted:    0,
        totalJobsCompleted: 0,
        totalApplications:  0,
      },
      createdAt:       user.createdAt,
    };
  } catch (error) {
    throw new Error(`Failed to fetch public profile: ${error.message}`);
  }
};





// ─────────────────────────────────────────────────────────────
// PRIVATE HELPER — Check if user is blue verified
// ─────────────────────────────────────────────────────────────
// ─────────────────────────────────────────────────────────────
// ✅ SINGLE SOURCE OF TRUTH
// ─────────────────────────────────────────────────────────────
UserSchema.methods._isBlueVerified = function (subscriptionData) {
  if (!subscriptionData) return false;
  
  // ✅ Safely check if subscription is populated
  if (typeof subscriptionData === 'string' || subscriptionData instanceof mongoose.Types.ObjectId) {
    return false; // Not populated, can't verify
  }
  
  const isPremiumPlan = subscriptionData.plan && subscriptionData.plan !== 'free';
  const isActive = subscriptionData.subscriptionStatus === 'active';
  const isNotExpired = new Date() < new Date(subscriptionData.planExpiresAt);
  
  return isPremiumPlan && isActive && isNotExpired;
};


const BADGES = {
  premium: {
    icon:  'verified',    // maps to whatever icon on frontend
    color: '#0066FF',
    label: 'Premium Member',
    bg:    '#EBF5FF',     // background chip color
  }
};

UserSchema.methods._buildBlueBadge = function (subscriptionData) {
  const isVerified = this._isBlueVerified(subscriptionData);

  return isVerified ? {
    status: true,
    ...BADGES.premium
  } : {
    status: false
  };
};


UserSchema.methods.addStrike = async function () {
  if (this.strikes.count >= 3) {
    return { success: false, message: 'Maximum strikes reached' };
  }

  this.strikes.count += 1;

  if (this.strikes.count === 3) {
    this.status = 'frozen';
    const freezeDate = new Date();
    freezeDate.setDate(freezeDate.getDate() + 7);
    this.strikes.freezeUntil = freezeDate;
  }

  try {
    await this.save();
    return { success: true, strikeCount: this.strikes.count };
  } catch (error) {
    throw new Error(`Failed to add strike: ${error.message}`);
  }
};



UserSchema.methods.updateLastLogin = function () {
  this.lastLogin  = new Date();
  this.lastActive = new Date();
  return this.save();
  // pre-save hook above returns early for non-new docs ✅
  // no password hashing hook → no risk ✅
};

// ─────────────────────────────────────────────────────────────
// EXPORT
// ─────────────────────────────────────────────────────────────



// ─────────────────────────────────────────────────────────────
// BACKUP HOOKS
// ─────────────────────────────────────────────────────────────

// ── Capture isNew BEFORE save changes it ─────────────────────
UserSchema.pre('save', function () {
  this._wasNew = this.isNew;
});

// ── Backup on create / update ─────────────────────────────────
UserSchema.post('save', async function () {
  try {
    await backupDocument('users', this._wasNew ? 'create' : 'update', this);
  } catch (err) {
    console.error('⚠️ [BACKUP] post.save failed (users):', err.message);
    // never throw — backup must never break main operation
  }
});

// ── Backup on findOneAndDelete ────────────────────────────────
UserSchema.post('findOneAndDelete', async function (doc) {
  if (!doc) return;
  try {
    await backupDocument('users', 'delete', doc);
  } catch (err) {
    console.error('⚠️ [BACKUP] post.findOneAndDelete failed (users):', err.message);
  }
});

// ── Backup on deleteOne (called on document instance) ─────────
UserSchema.post('deleteOne', { document: true, query: false }, async function () {
  try {
    await backupDocument('users', 'delete', this);
  } catch (err) {
    console.error('⚠️ [BACKUP] post.deleteOne failed (users):', err.message);
  }
});

// ── Backup on findOneAndUpdate ────────────────────────────────
// Only fires when { new: true } is passed in the query options
UserSchema.post('findOneAndUpdate', async function (doc) {
  if (!doc) return;
  try {
    await backupDocument('users', 'update', doc);
  } catch (err) {
    console.error('⚠️ [BACKUP] post.findOneAndUpdate failed (users):', err.message);
  }
});



const User = mongoose.models.User || mongoose.model('User', UserSchema);
export default User;