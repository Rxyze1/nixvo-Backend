// controllers/EmployeeProfileController.js

import Employee from '../../../Models/USER-Auth/Employee-Model.js';
import User from '../../../Models/USER-Auth/User-Auth.-Model.js';
import { v4 as uuidv4 } from 'uuid';
import mongoose from 'mongoose'; // ✅ ADD THIS
import { PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import r2Client from '../../../Config/r2Config.js';
import { validateContent } from '../../../Service/validationService.js';

import { sendEmployeeApproval } from '../../../Email/emailService.js';

const BUCKET_NAME = process.env.CLOUDFLARE_R2_BUCKET_NAME;
const BUCKET_URL = process.env.CLOUDFLARE_R2_PUBLIC_URL;

// ═══════════════════════════════════════════════════════════════
// HELPER: Validate MongoDB ObjectId
// ═══════════════════════════════════════════════════════════════

const isValidObjectId = (id) => {
  return mongoose.Types.ObjectId.isValid(id); // ✅ FIXED
};
// ═══════════════════════════════════════════════════════════════
// HELPER: Upload Image to R2
// ═══════════════════════════════════════════════════════════════

const uploadImageToR2 = async (file, folder) => {
  if (!file) return null;

  const ext = file.originalname.split('.').pop();
  const filename = `${folder}/${uuidv4()}.${ext}`;

  const params = {
    Bucket: BUCKET_NAME,
    Key: filename,
    Body: file.buffer,
    ContentType: file.mimetype,
  };

  await r2Client.send(new PutObjectCommand(params));
  return `${BUCKET_URL}/${filename}`;
};

// ═══════════════════════════════════════════════════════════════
// HELPER: Delete Image from R2
// ═══════════════════════════════════════════════════════════════

const deleteImageFromR2 = async (imageUrl) => {
  if (!imageUrl) return;

  try {
    const key = imageUrl.replace(BUCKET_URL + '/', '');
    const params = {
      Bucket: BUCKET_NAME,
      Key: key,
    };
    await r2Client.send(new DeleteObjectCommand(params));
    console.log('🗑️ Deleted from R2:', key);
  } catch (error) {
    console.error('⚠️ Delete error:', error.message);
  }
};

// ═══════════════════════════════════════════════════════════════
// 🎯 CREATE/UPDATE EMPLOYEE PROFILE
// ═══════════════════════════════════════════════════════════════

/**
 * CREATE/UPDATE EMPLOYEE PROFILE
 * POST /api/employee/profile/update
 * 
 * Updates employee's professional profile with:
 * - Bio, Skills, Experience
 * - Availability, Hourly Rate
 * - Profile Picture, Banner Image
 * 
 * @param {Object} req - Express request object
 * @param {string} req.userId - From JWT token (extracted by auth middleware)
 * @param {Object} req.body - Profile fields
 * @param {Object} req.files - Uploaded images (profilePic, profileBannerImage)
 * @returns {Object} Updated profile data
 */
export const createOrUpdateEmployeeProfile = async (req, res) => {
  try {
    const userId = req.userId;
    const {
      bio,
      skills,
      experienceYears,
      experienceDescription,
      availabilityStatus,
      hoursPerWeek,
      hourlyRateCurrency,
      hourlyRateAmount,
    } = req.body;
    const files = req.files;

    console.log('📝 EMPLOYEE PROFILE UPDATE');
    console.log('  User ID:', userId);
    console.log('  Files:', files ? Object.keys(files) : 'none');

    // ═══════════════════════════════════════════════════════════════
    // STEP 1: VALIDATE USER
    // ═══════════════════════════════════════════════════════════════

    const user = await User.findById(userId);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: '❌ User not found',
      });
    }

    if (user.userType !== 'employee') {
      return res.status(403).json({
        success: false,
        message: '❌ Only employees can access this endpoint',
      });
    }

    if (user.status !== 'active' || !user.canLogin) {
      return res.status(403).json({
        success: false,
        message: '❌ Account is not active',
        details: {
          status: user.status,
          canLogin: user.canLogin,
        },
      });
    }

    console.log('✅ User validation passed');

    // ═══════════════════════════════════════════════════════════════
    // STEP 2: VALIDATE BIO
    // ═══════════════════════════════════════════════════════════════

    if (bio !== undefined && bio !== null && bio !== '') {
      console.log('🧪 Validating bio...');

      if (bio.length < 3) {
        return res.status(400).json({
          success: false,
          message: '❌ Bio must be at least 3 characters',
        });
      }

      if (bio.length > 500) {
        return res.status(400).json({
          success: false,
          message: '❌ Bio must be less than 500 characters',
        });
      }

      // AI Content Validation
      const bioValidation = await validateContent(bio, 'bio');

      if (bioValidation.blocked) {
        return res.status(400).json({
          success: false,
          blocked: true,
          message: '❌ Bio contains inappropriate content',
          reason: bioValidation.reason,
          confidence: bioValidation.confidence,
        });
      }

      console.log('✅ Bio validation passed');
    }

    // ═══════════════════════════════════════════════════════════════
    // STEP 3: VALIDATE SKILLS
    // ═══════════════════════════════════════════════════════════════

    if (skills !== undefined) {
      console.log('🧪 Validating skills...');

      let parsedSkills = skills;

      if (typeof skills === 'string') {
        try {
          parsedSkills = JSON.parse(skills);
        } catch (error) {
          parsedSkills = skills.split(',').map((s) => s.trim());
        }
      }

      if (!Array.isArray(parsedSkills)) {
        return res.status(400).json({
          success: false,
          message: '❌ Skills must be an array',
        });
      }

      if (parsedSkills.length === 0) {
        return res.status(400).json({
          success: false,
          message: '❌ At least one skill is required',
        });
      }

      if (parsedSkills.length > 20) {
        return res.status(400).json({
          success: false,
          message: '❌ Maximum 20 skills allowed',
        });
      }

      req.body.skills = parsedSkills;
      console.log('✅ Skills validation passed:', parsedSkills.length, 'skills');
    }

    // ═══════════════════════════════════════════════════════════════
    // STEP 4: VALIDATE EXPERIENCE
    // ═══════════════════════════════════════════════════════════════

    if (experienceYears !== undefined) {
      console.log('🧪 Validating experience years...');

      const years = parseInt(experienceYears);

      if (isNaN(years) || years < 0 || years > 50) {
        return res.status(400).json({
          success: false,
          message: '❌ Experience must be between 0 and 50 years',
        });
      }

      req.body.experienceYears = years;
      console.log('✅ Experience years validated:', years);
    }

    if (
      experienceDescription !== undefined &&
      experienceDescription !== null &&
      experienceDescription !== ''
    ) {
      console.log('🧪 Validating experience description...');

      if (experienceDescription.length < 10) {
        return res.status(400).json({
          success: false,
          message: '❌ Experience description must be at least 10 characters',
        });
      }

      if (experienceDescription.length > 1000) {
        return res.status(400).json({
          success: false,
          message: '❌ Experience description must be less than 1000 characters',
        });
      }

      // AI Content Validation
      const expValidation = await validateContent(
        experienceDescription,
        'experience'
      );

      if (expValidation.blocked) {
        return res.status(400).json({
          success: false,
          blocked: true,
          message: '❌ Experience description contains inappropriate content',
          reason: expValidation.reason,
          confidence: expValidation.confidence,
        });
      }

      console.log('✅ Experience description validation passed');
    }

    // ═══════════════════════════════════════════════════════════════
    // STEP 5: VALIDATE AVAILABILITY
    // ═══════════════════════════════════════════════════════════════

    const validAvailability = ['available', 'busy', 'unavailable'];

    if (availabilityStatus !== undefined) {
      console.log('🧪 Validating availability status...');

      if (!validAvailability.includes(availabilityStatus)) {
        return res.status(400).json({
          success: false,
          message: '❌ Invalid availability status',
          validOptions: validAvailability,
        });
      }

      console.log('✅ Availability status validated:', availabilityStatus);
    }

    if (hoursPerWeek !== undefined) {
      console.log('🧪 Validating hours per week...');

      const hours = parseInt(hoursPerWeek);

      if (isNaN(hours) || hours < 0 || hours > 168) {
        return res.status(400).json({
          success: false,
          message: '❌ Hours per week must be between 0 and 168',
        });
      }

      req.body.hoursPerWeek = hours;
      console.log('✅ Hours per week validated:', hours);
    }

    // ═══════════════════════════════════════════════════════════════
    // STEP 6: VALIDATE HOURLY RATE
    // ═══════════════════════════════════════════════════════════════

    const validCurrencies = ['INR', 'USD', 'EUR', 'GBP'];

    if (hourlyRateCurrency !== undefined) {
      console.log('🧪 Validating currency...');

      if (!validCurrencies.includes(hourlyRateCurrency)) {
        return res.status(400).json({
          success: false,
          message: '❌ Invalid currency',
          validCurrencies: validCurrencies,
        });
      }

      console.log('✅ Currency validated:', hourlyRateCurrency);
    }

    if (hourlyRateAmount !== undefined) {
      console.log('🧪 Validating hourly rate amount...');

      const amount = parseFloat(hourlyRateAmount);

      if (isNaN(amount) || amount < 0) {
        return res.status(400).json({
          success: false,
          message: '❌ Hourly rate must be a positive number',
        });
      }

      req.body.hourlyRateAmount = amount;
      console.log('✅ Hourly rate amount validated:', amount);
    }

    // ═══════════════════════════════════════════════════════════════
    // STEP 7: CREATE OR GET EMPLOYEE PROFILE
    // ═══════════════════════════════════════════════════════════════

    let employee = await Employee.findOne({ userId });

    if (!employee) {
      console.log('📌 Creating new employee profile...');
      employee = new Employee({ userId });
    } else {
      console.log('📌 Updating existing employee profile...');
    }

    // ═══════════════════════════════════════════════════════════════
    // STEP 8: HANDLE IMAGE UPLOADS
    // ═══════════════════════════════════════════════════════════════

    const allowedImageMimes = ['image/jpeg', 'image/png', 'image/webp'];
    const maxImageSize = 10 * 1024 * 1024; // 10MB

    if (files) {
      console.log('📦 Processing image files...');

      // ✅ PROFILE PICTURE
      if (files.profilePic && files.profilePic[0]) {
        const file = files.profilePic[0];

        console.log('📸 Processing profile picture...');
        console.log(`  Name: ${file.originalname}`);
        console.log(`  Size: ${(file.size / 1024 / 1024).toFixed(2)} MB`);
        console.log(`  Type: ${file.mimetype}`);

        // Validate MIME type
        if (!allowedImageMimes.includes(file.mimetype)) {
          return res.status(400).json({
            success: false,
            message: `❌ ${file.originalname} is not a valid image (JPEG, PNG, WebP only)`,
          });
        }

        // Validate file size
        if (file.size > maxImageSize) {
          return res.status(400).json({
            success: false,
            message: `❌ ${file.originalname} exceeds maximum size (10MB max)`,
          });
        }

        try {
          // Delete old profile pic if exists
          if (employee.profilePic) {
            console.log('🗑️ Deleting old profile picture...');
            await deleteImageFromR2(employee.profilePic);
          }

          // Upload new profile pic
          const imageUrl = await uploadImageToR2(
            file,
            `employee-profiles/${userId}`
          );
          employee.profilePic = imageUrl;
          console.log('✅ Profile picture uploaded:', imageUrl);
        } catch (uploadError) {
          console.error('❌ Profile picture upload failed:', uploadError);
          return res.status(500).json({
            success: false,
            message: 'Failed to upload profile picture',
            error: uploadError.message,
          });
        }
      }

      // ✅ BANNER IMAGE
      if (files.profileBannerImage && files.profileBannerImage[0]) {
        const file = files.profileBannerImage[0];

        console.log('🏞️ Processing banner image...');
        console.log(`  Name: ${file.originalname}`);
        console.log(`  Size: ${(file.size / 1024 / 1024).toFixed(2)} MB`);
        console.log(`  Type: ${file.mimetype}`);

        // Validate MIME type
        if (!allowedImageMimes.includes(file.mimetype)) {
          return res.status(400).json({
            success: false,
            message: `❌ ${file.originalname} is not a valid image (JPEG, PNG, WebP only)`,
          });
        }

        // Validate file size
        if (file.size > maxImageSize) {
          return res.status(400).json({
            success: false,
            message: `❌ ${file.originalname} exceeds maximum size (10MB max)`,
          });
        }

        try {
          // Delete old banner if exists
          if (employee.profileBannerImage) {
            console.log('🗑️ Deleting old banner image...');
            await deleteImageFromR2(employee.profileBannerImage);
          }

          // Upload new banner
          const imageUrl = await uploadImageToR2(
            file,
            `employee-banners/${userId}`
          );
          employee.profileBannerImage = imageUrl;
          console.log('✅ Banner image uploaded:', imageUrl);
        } catch (uploadError) {
          console.error('❌ Banner image upload failed:', uploadError);
          return res.status(500).json({
            success: false,
            message: 'Failed to upload banner image',
            error: uploadError.message,
          });
        }
      }
    }

    // ═══════════════════════════════════════════════════════════════
    // STEP 9: UPDATE PROFILE FIELDS
    // ═══════════════════════════════════════════════════════════════

    console.log('📝 Updating profile fields...');

    if (bio !== undefined) {
      employee.bio = bio;
    }

    if (req.body.skills !== undefined) {
      employee.skills = req.body.skills;
    }

    // Experience (nested object)
    if (
      req.body.experienceYears !== undefined ||
      experienceDescription !== undefined
    ) {
      if (!employee.experience) {
        employee.experience = {};
      }

      if (req.body.experienceYears !== undefined) {
        employee.experience.totalYears = req.body.experienceYears;
      }

      if (experienceDescription !== undefined) {
        employee.experience.description = experienceDescription;
      }
    }

    // Availability (nested object)
    if (
      availabilityStatus !== undefined ||
      req.body.hoursPerWeek !== undefined
    ) {
      if (!employee.availability) {
        employee.availability = {};
      }

      if (availabilityStatus !== undefined) {
        employee.availability.status = availabilityStatus;
      }

      if (req.body.hoursPerWeek !== undefined) {
        employee.availability.hoursPerWeek = req.body.hoursPerWeek;
      }
    }

    // Hourly Rate (nested object)
    if (
      hourlyRateCurrency !== undefined ||
      req.body.hourlyRateAmount !== undefined
    ) {
      if (!employee.hourlyRate) {
        employee.hourlyRate = {};
      }

      if (hourlyRateCurrency !== undefined) {
        employee.hourlyRate.currency = hourlyRateCurrency;
      }

      if (req.body.hourlyRateAmount !== undefined) {
        employee.hourlyRate.amount = req.body.hourlyRateAmount;
      }
    }

    // ═══════════════════════════════════════════════════════════════
    // STEP 10: SAVE TO DATABASE
    // ═══════════════════════════════════════════════════════════════
    // ═══════════════════════════════════════════════════════════════
    // STEP 10: SAVE TO DATABASE + AUTO-VERIFY
    // ═══════════════════════════════════════════════════════════════

     const wasAlreadyCompleted = employee.profileCompleted;
     
     employee.profileCompleted = true;
     await employee.save();
     
     // ── On first completion → AUTO-APPROVE employee instantly ──
     if (!wasAlreadyCompleted) {
       // Update User document - keep active and mark as verified
       await User.findByIdAndUpdate(
         userId, 
         { 
           status: 'active',           // Keep active, NOT pending!
           isAdminVerified: true,      // Mark as verified
           adminVerifiedAt: new Date() // Record when auto-approved
         }
       );
       
       // Update Employee verification details
       employee.verificationDetails = {
         status: 'approved',
         verificationMethod: 'automatic',
         verificationDate: new Date(),
         rejectionReason: null
       };
       
       employee.adminVerified = {
         status: true,
         verifiedAt: new Date(),
         verifiedBy: 'system'
       };
       
       await employee.save();
       
       console.log('✅ Employee auto-verified and activated instantly!');
       
       // 📧 Optional: Send verification success email (uncomment to enable)
       try {
         const userForEmail = await User.findById(userId);
         await sendEmployeeApproval(userForEmail.email, userForEmail.fullname);
         console.log('📧 Verification email sent');
       } catch (emailError) {
         console.warn('⚠️ Failed to send verification email:', emailError.message);
       }
     }

    // ═══════════════════════════════════════════════════════════════
    // STEP 11: RETURN RESPONSE
    // ═══════════════════════════════════════════════════════════════

    return res.status(200).json({
      success: true,

      message: wasAlreadyCompleted
        ? '✅ Employee profile updated successfully'
        : '🎉 Profile completed! Your account is now active and verified.',

      data: {
        userId: employee.userId,
        bio: employee.bio,
        profilePic: employee.profilePic,
        profileBannerImage: employee.profileBannerImage,
        skills: employee.skills,
        experience: employee.experience,
        availability: employee.availability,
        hourlyRate: employee.hourlyRate,
        jobStats: employee.jobStats,
        followersCount: employee.followersCount,
        profileCompleted: employee.profileCompleted,
        
        // Updated flags for auto-approval
        autoApproved: !wasAlreadyCompleted,
        isInstantlyActive: true,
        awaitingAdminReview: false,

        badge: employee.hasBadge ? {
          show:   true,
          type:   employee.badgeType,
          label:  employee.badgeLabel,
          icon:   employee.badgeType === 'blue_verified'  ? 'verified'     :
                  employee.badgeType === 'admin_verified'  ? 'shield-check' : 'badge',
          color:  employee.badgeType === 'blue_verified'  ? '#0066FF'       :
                  employee.badgeType === 'admin_verified'  ? '#00B37E'       : '#888',
          bg:     employee.badgeType === 'blue_verified'  ? '#EBF5FF'       :
                  employee.badgeType === 'admin_verified'  ? '#E6FAF5'       : '#f0f0f0',
        } : { show: false },

        adminVerified: {
          status:     employee.adminVerified?.status ?? (!wasAlreadyCompleted),  // true for newly completed profiles
          verifiedAt: employee.adminVerified?.verifiedAt ?? (!wasAlreadyCompleted ? new Date() : null),
        },
        
        createdAt: employee.createdAt,
        updatedAt: employee.updatedAt,
      },
    });

  } catch (error) {
    console.error('❌ ERROR in createOrUpdateEmployeeProfile:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to update employee profile',
      error:
        process.env.NODE_ENV === 'development'
          ? error.message
          : 'Internal server error',
    });
  }
};

// ═══════════════════════════════════════════════════════════════
// 📋 GET EMPLOYEE PROFILE
// ═══════════════════════════════════════════════════════════════

/**
 * GET EMPLOYEE PROFILE
 * GET /api/employee/profile/:userId
 * 
 * Fetches employee profile (own or public)
 * - Public data: available to everyone
 * - Sensitive data: only visible to own profile (email, phone, bank details, etc.)
 * - Inactive profiles: not visible to others
 * 
 * @param {Object} req - Express request object
 * @param {string} req.params.userId - Employee's user ID to fetch
 * @param {string} req.userId - Requester's user ID from JWT (for permission check)
 * @returns {Object} Profile data (filtered based on permissions)
 */
export const getEmployeeProfile = async (req, res) => {
  try {
    const { userId } = req.params;
    const requesterId = req.userId;

    console.log('👁️ GET EMPLOYEE PROFILE');
    console.log(`  Requester: ${requesterId}`);
    console.log(`  Target: ${userId}`);

    // ═══════════════════════════════════════════════════════════════
    // STEP 1: VALIDATE USER ID FORMAT
    // ═══════════════════════════════════════════════════════════════

    if (!isValidObjectId(userId)) {
      return res.status(400).json({
        success: false,
        message: '❌ Invalid user ID format',
      });
    }

    // ═══════════════════════════════════════════════════════════════
    // STEP 2: CHECK USER EXISTS AND IS EMPLOYEE
    // ═══════════════════════════════════════════════════════════════

    const targetUser = await User.findById(userId);

    if (!targetUser) {
      return res.status(404).json({
        success: false,
        message: '❌ User not found',
      });
    }

    if (targetUser.userType !== 'employee') {
      return res.status(403).json({
        success: false,
        message: '❌ This endpoint is for employee profiles only',
      });
    }

    console.log(`✅ User exists and is employee`);

    // ═══════════════════════════════════════════════════════════════
    // STEP 3: CHECK IF VIEWING OWN PROFILE
    // ═══════════════════════════════════════════════════════════════

    const isOwnProfile = userId.toString() === requesterId.toString();

    // If viewing someone else's profile, they must be active
    if (
      !isOwnProfile &&
      (targetUser.status !== 'active' || !targetUser.canLogin)
    ) {
      console.log('⛔ Profile not available (inactive)');
      return res.status(403).json({
        success: false,
        message: '❌ This profile is not available',
      });
    }

    console.log(`  Own Profile: ${isOwnProfile}`);

    // ═══════════════════════════════════════════════════════════════
    // STEP 4: FETCH EMPLOYEE PROFILE
    // ═══════════════════════════════════════════════════════════════

    let employee = await Employee.findOne({ userId })
      .populate({
        path: 'subscription',
        select:
          'plan subscriptionStatus planActivatedAt planExpiresAt',
      })
      .populate({
        path: 'verificationDetails.verifiedByAdmin',
        select: 'fullname username',
      });

    if (!employee) {
      return res.status(404).json({
        success: false,
        message: '❌ Employee profile not found',
      });
    }

    console.log('✅ Employee profile fetched');

   

// ═══════════════════════════════════════════════════════════════
// STEP 5: SYNC BADGE + CHECK PREMIUM
// ═══════════════════════════════════════════════════════════════

let hasPremium = false;

try {
  console.log('🔄 Syncing verified badge...');

  await employee.syncBadge();

  // ✅ Re-fetch FIRST so subscription is populated and fresh
  employee = await Employee.findOne({ userId })
    .populate({
      path:   'subscription',
      select: 'plan subscriptionStatus planActivatedAt planExpiresAt',
    })
    .populate({
      path:   'verificationDetails.verifiedByAdmin',
      select: 'fullname username',
    });

  // ✅ Inline check — reliable, no method dependency
  const sub = employee.subscription;
  hasPremium = !!(
    sub &&
    sub.plan === 'premium' &&
    ['active', 'cancelled'].includes(sub.subscriptionStatus) &&
    new Date() < new Date(sub.planExpiresAt)
  );

  console.log('✅ Badge synced');
  console.log(`   hasBadge:  ${employee.hasBadge}`);
  console.log(`   badgeType: ${employee.badgeType}`);
  console.log(`   isPremium: ${hasPremium}`);
  console.log(`   sub.plan: ${sub?.plan}`);
  console.log(`   sub.status: ${sub?.subscriptionStatus}`);
  console.log(`   sub.expiresAt: ${sub?.planExpiresAt}`);

} catch (syncError) {
  console.warn('⚠️ Badge sync failed (non-critical):', syncError.message);
}






    // ═══════════════════════════════════════════════════════════════
    // STEP 7: BUILD RESPONSE - PUBLIC DATA
    // ═══════════════════════════════════════════════════════════════

    console.log('📦 Building response...');

    const profileData = {
      // Basic Info
      userId: employee.userId,
      profilePic: employee.profilePic,
      profileBannerImage: employee.profileBannerImage,
      bio: employee.bio,

      // Professional Info
      skills: employee.skills,
      experience: employee.experience,
      availability: employee.availability,
      hourlyRate: employee.hourlyRate,

      // Stats & Social
      jobStats: employee.jobStats,
      followersCount: employee.followersCount,
      reviewStats: {
        averageRating: parseFloat(employee.getAverageRating() || 0),
        reviewCount: employee.reviews ? employee.reviews.length : 0,
      },
// TO ✅ — replace all three with badge object + keep blueVerified
badge: employee.hasBadge ? {
  show:   true,
  type:   employee.badgeType,
  label:  employee.badgeLabel,
  icon:   employee.badgeType === 'blue_verified'  ? 'verified'     :
          employee.badgeType === 'admin_verified'  ? 'shield-check' : 'badge',
  color:  employee.badgeType === 'blue_verified'  ? '#0066FF'       :
          employee.badgeType === 'admin_verified'  ? '#00B37E'       : '#888',
  bg:     employee.badgeType === 'blue_verified'  ? '#EBF5FF'       :
          employee.badgeType === 'admin_verified'  ? '#E6FAF5'       : '#f0f0f0',
} : { show: false },
blueVerified: hasPremium
  ? { status: true, icon: 'verified', color: '#0066FF', bg: '#EBF5FF', label: 'Premium Member' }
  : { status: false },

adminVerified: {
  status:     employee.adminVerified?.status ?? false,
  verifiedAt: employee.adminVerified?.verifiedAt ?? null,
},
      verificationStatus: {
        status: employee.verificationDetails?.status || 'pending',
        method: employee.verificationDetails?.verificationMethod || null,
        date: employee.verificationDetails?.verificationDate || null,
      },

      // Portfolio
      portfolio: employee.portfolio || [],
      profileCompleted: employee.profileCompleted,

      // User Info (Public)
      user: {
        fullname: targetUser.fullname,
        username: targetUser.username,
        status: targetUser.status,
        isEmailVerified: targetUser.isEmailVerified,
        isAdminVerified: targetUser.isAdminVerified,
      },

      // Timestamps
      createdAt: employee.createdAt,
      updatedAt: employee.updatedAt,
    };

    // ═══════════════════════════════════════════════════════════════
    // STEP 8: ADD SENSITIVE DATA (OWN PROFILE ONLY)
    // ═══════════════════════════════════════════════════════════════

    if (isOwnProfile) {
      console.log('🔐 Adding sensitive data (own profile)...');

      // Email & Phone
      profileData.user.email = targetUser.email;
      profileData.user.phone = targetUser.phone;

      // Subscription Info
      if (employee.subscription) {
        profileData.subscription = {
          _id: employee.subscription._id,
          plan: employee.subscription.plan,
          status: employee.subscription.subscriptionStatus,
          activatedAt: employee.subscription.planActivatedAt,
          expiresAt: employee.subscription.planExpiresAt,
          // TO ✅
hasPremium,
isPremium: hasPremium,
        };
      } else {
        profileData.subscription = null;
      }

      // Bank Details (Masked)
      profileData.bankDetails = employee.bankDetails
        ? {
            accountHolderName: employee.bankDetails.accountHolderName,
            accountNumber: employee.bankDetails.accountNumber
              ? `****${employee.bankDetails.accountNumber.slice(-4)}`
              : null,
            ifscCode: employee.bankDetails.ifscCode,
            bankName: employee.bankDetails.bankName,
            verified: employee.bankDetails.verified,
          }
        : null;

      // PAN Card (Masked)
      profileData.panCard = employee.panCard
        ? {
            panNumber: employee.panCard.panNumber
              ? `${employee.panCard.panNumber.slice(0, 5)}****${employee.panCard.panNumber.slice(-4)}`
              : null,
            verified: employee.panCard.verified,
          }
        : null;

      // Reviews & Withdrawal History
      profileData.reviews = employee.reviews || [];
      profileData.withdrawalHistory = employee.withdrawalHistory || [];

      // Payment Status
      profileData.paymentStatus = {
        bankDetailsVerified: employee.bankDetails?.verified || false,
        panCardVerified: employee.panCard?.verified || false,
        hasRazorpayFundAccount: !!targetUser.razorpayFundAccountId,
        canWithdraw:
          (employee.bankDetails?.verified || false) &&
          (employee.panCard?.verified || false) &&
          !!targetUser.razorpayFundAccountId,
      };

  // TO ✅ — clean, no duplication
       profileData.verificationDetails = {


  status:          employee.verificationDetails?.status || 'pending',
  method:          employee.verificationDetails?.verificationMethod || null,
  date:            employee.verificationDetails?.verificationDate || null,
  rejectionReason: employee.verificationDetails?.rejectionReason || null,
  
  verifiedByAdmin: employee.verificationDetails?.verifiedByAdmin
    ? {
        fullname: employee.verificationDetails.verifiedByAdmin.fullname,
        username: employee.verificationDetails.verifiedByAdmin.username,
      }
    : null,

  // ── Verification flags ────────────────────────────────
  blueVerified: {
    status:     hasPremium,              // ← uses actual premium check
    icon:       'verified',
    color:      '#0066FF',
  },
  adminVerified: {
    status:     employee.adminVerified?.status ?? false,
    icon:       'shield-check',
    color:      '#00B37E',
  },
  emailVerified: {
    status:     targetUser.isEmailVerified,
    icon:       'mail',
    color:      '#00B37E',
  },
  phoneVerified: {
    status:     !!targetUser.phone,
    icon:       'phone',
    color:      '#FF6B35',
  },

  };
}

    // ═══════════════════════════════════════════════════════════════
    // STEP 9: RETURN RESPONSE
    // ═══════════════════════════════════════════════════════════════

    console.log('✅ Response ready');

    return res.status(200).json({
      success: true,
      isOwnProfile: isOwnProfile,
      data: profileData,
    });
  } catch (error) {
    console.error('❌ ERROR in getEmployeeProfile:', error);

    return res.status(500).json({
      success: false,
      message: 'Failed to fetch employee profile',
      error:
        process.env.NODE_ENV === 'development'
          ? error.message
          : 'Internal server error',
    });
  }
};






// ═══════════════════════════════════════════════════════════════
// EXPORTS
// ═══════════════════════════════════════════════════════════════

export default {
  createOrUpdateEmployeeProfile,
  getEmployeeProfile,
};