// controllers/ClientProfileController.js

import Client   from '../../../Models/USER-Auth/Client-Model.js';
import User     from '../../../Models/USER-Auth/User-Auth.-Model.js';
import Employee from '../../../Models/USER-Auth/Employee-Model.js';
import { v4 as uuidv4 }                          from 'uuid';
import { PutObjectCommand, DeleteObjectCommand }  from '@aws-sdk/client-s3';
import r2Client         from '../../../Config/r2Config.js';
import validationService from '../../../Service/validationService.js';
import ImageValidator   from '../../../Service/Security/ImageValidator.js';

const BUCKET_NAME = process.env.CLOUDFLARE_R2_BUCKET_NAME;
const BUCKET_URL  = process.env.CLOUDFLARE_R2_PUBLIC_URL;

const imageValidator = new ImageValidator();

const ALLOWED_IMAGE_MIMES = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_IMAGE_SIZE       = 10 * 1024 * 1024; // 10MB

export const VALID_SKILLS = [
  'videoEditors',
  'audioEditors',
  'thumbnailArtists',
  'blenderArtists',
  'AiArtists',
  'VfxArtists',
  '3dVideoArtists',
  'longEditors',
  'shortEditors',
  'scriptWriters',
  'videoEditorsAndAudioEditors',
  'colorGrading',       // ✅ add
  'colorCorrection',    // ✅ add
  'motionGraphics',     // ✅ add
  'soundDesign',        // ✅ add
  'all',
];

// ═══════════════════════════════════════════════════════════════
// HELPER: Upload Image to R2
// ═══════════════════════════════════════════════════════════════

const uploadImageToR2 = async (file, folder) => {
  if (!file) return null;

  const ext      = file.originalname.split('.').pop();
  const filename = `${folder}/${uuidv4()}.${ext}`;

  await r2Client.send(new PutObjectCommand({
    Bucket:      BUCKET_NAME,
    Key:         filename,
    Body:        file.buffer,
    ContentType: file.mimetype,
  }));

  return `${BUCKET_URL}/${filename}`;
};

// ═══════════════════════════════════════════════════════════════
// HELPER: Delete Image from R2
// ═══════════════════════════════════════════════════════════════

const deleteImageFromR2 = async (imageUrl) => {
  if (!imageUrl) return;
  try {
    const key = imageUrl.replace(`${BUCKET_URL}/`, '');
    await r2Client.send(new DeleteObjectCommand({ Bucket: BUCKET_NAME, Key: key }));
    console.log('🗑️ Deleted from R2:', key);
  } catch (error) {
    console.error('⚠️ R2 delete error:', error.message);
  }
};

// ═══════════════════════════════════════════════════════════════
// HELPER: Validate + Upload a single image file
// Returns { url } on success or sends error response and returns null
// ═══════════════════════════════════════════════════════════════

const processImage = async (res, file, folder, isProfilePic, oldUrl = null) => {
  // ── Type check ──
  if (!ALLOWED_IMAGE_MIMES.includes(file.mimetype)) {
    res.status(400).json({
      success: false,
      message: `❌ ${file.originalname} is not a valid image (JPEG, PNG, WebP only)`,
    });
    return null;
  }

  // ── Size check ──
  if (file.size > MAX_IMAGE_SIZE) {
    res.status(400).json({
      success: false,
      message: `❌ ${file.originalname} is too large (max 10MB)`,
    });
    return null;
  }

  // ── Content validation ──
  const imageValidation = await imageValidator.validate(file.buffer, {
    testMode:    false,
    isProfilePic,
    filename:    file.originalname,
  });

  const imageBlocked = imageValidation.action === 'BLOCK' || imageValidation.blocked === true;

  if (imageBlocked) {
    res.status(400).json({
      success:    false,
      blocked:    true,
      message:    `❌ ${isProfilePic ? 'Profile picture' : 'Banner image'} contains inappropriate content`,
      reason:     imageValidation.reason     || 'Policy violation detected',
      confidence: imageValidation.confidence || 0,
      violations: imageValidation.violations || [],
      checkedBy:  imageValidation.checkedBy  || [],
    });
    return null;
  }

  // ── Delete old image ──
  if (oldUrl) await deleteImageFromR2(oldUrl);

  // ── Upload new image ──
  const url = await uploadImageToR2(file, folder);
  return url;
};

// ═══════════════════════════════════════════════════════════════
// 1️⃣ CREATE/UPDATE CLIENT PROFILE
// ═══════════════════════════════════════════════════════════════

export const createOrUpdateClientProfile = async (req, res) => {
  try {
    const userId            = req.userId;
    const { bio, lookingSkillsFor } = req.body;
    const files             = req.files;

    console.log('\n👤 CLIENT PROFILE UPDATE — userId:', userId);
    console.log('📋 Body:', req.body);
    console.log('📋 Files:', files ? Object.keys(files) : 'none');

    // ── User checks ──
    const user = await User.findById(userId);

    if (!user) {
      return res.status(404).json({ success: false, message: '❌ User not found' });
    }
    if (user.userType !== 'client') {
      return res.status(403).json({ success: false, message: '❌ Only clients can access this endpoint' });
    }
    if (user.status !== 'active' || !user.canLogin) {
      return res.status(403).json({
        success:  false,
        message:  '❌ Account is not active',
        details:  { status: user.status, canLogin: user.canLogin },
      });
    }

    // ── Validate bio ──
    if (bio !== undefined && bio !== null && bio !== '') {
      if (bio.length < 3) {
        return res.status(400).json({ success: false, message: '❌ Bio must be at least 3 characters' });
      }
      if (bio.length > 500) {
        return res.status(400).json({ success: false, message: '❌ Bio must be less than 500 characters' });
      }

      const bioValidation = await validationService.validateBio(bio);
      const bioBlocked    = bioValidation.action === 'BLOCK' || bioValidation.blocked === true;

      if (bioBlocked) {
        return res.status(400).json({
          success:    false,
          blocked:    true,
          message:    '❌ Bio contains inappropriate content',
          reason:     bioValidation.reason     || 'Policy violation detected',
          confidence: bioValidation.confidence || 0,
          violations: bioValidation.violations || bioValidation.matched || [],
          source:     bioValidation.source,
          layer:      bioValidation.layer,
        });
      }
    }

    // ── Validate lookingSkillsFor ──
    if (lookingSkillsFor !== undefined) {
      const trimmedSkill = lookingSkillsFor.trim();
      if (!VALID_SKILLS.includes(trimmedSkill)) {
        return res.status(400).json({
          success:    false,
          message:    '❌ Invalid skill selection',
          validSkills: VALID_SKILLS,
        });
      }
    }

    // ── Get or create client doc ──
    let client = await Client.findOne({ userId });
    if (!client) {
      console.log('📌 Creating new client profile...');
      client = new Client({ userId });
    } else {
      console.log('📌 Updating existing client profile...');
    }

    // ── Process images ──
    if (files) {
      if (files.profilePic?.[0]) {
        const url = await processImage(
          res,
          files.profilePic[0],
          `client-profiles/${userId}`,
          true,
          client.profilePic
        );
        if (url === null) return; // response already sent inside processImage
        client.profilePic = url;
        console.log('✅ Profile pic uploaded:', url);
      }

      if (files.profileBannerImage?.[0]) {
        const url = await processImage(
          res,
          files.profileBannerImage[0],
          `client-banners/${userId}`,
          false,
          client.profileBannerImage
        );
        if (url === null) return; // response already sent inside processImage
        client.profileBannerImage = url;
        console.log('✅ Banner uploaded:', url);
      }
    }

    // ── Update text fields ──
    if (bio !== undefined)              client.bio               = bio;
    if (lookingSkillsFor !== undefined) client.lookingSkillsFor  = lookingSkillsFor.trim();

    // ── Mark profile complete ──
    client.profileCompleted = true; // ✅ KEY FIX

    await client.save();
    console.log('✅ Client profile saved\n');

    return res.status(200).json({
      success: true,
      message: '✅ Client profile updated successfully',
      data: {
        userId:             client.userId,
        bio:                client.bio,
        profilePic:         client.profilePic,
        profileBannerImage: client.profileBannerImage,
        lookingSkillsFor:   client.lookingSkillsFor,
        profileCompleted:   client.profileCompleted, // ✅ return it so frontend can update state
        createdAt:          client.createdAt,
        updatedAt:          client.updatedAt,
      },
    });

  } catch (error) {
    console.error('❌ ERROR in createOrUpdateClientProfile:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to update client profile',
      error:   process.env.NODE_ENV === 'development' ? error.message : 'Internal server error',
    });
  }
};

// ═══════════════════════════════════════════════════════════════
// 2️⃣ GET CLIENT PROFILE (Own or Others)
// ═══════════════════════════════════════════════════════════════

export const getClientProfile = async (req, res) => {
  try {
    const { userId } = req.params;
    const requesterId = req.userId;

    console.log('👁️ GET CLIENT PROFILE — requester:', requesterId, '| target:', userId);

    // ═══════════════════════════════════════════════════════════════
    // 1️⃣ VALIDATE TARGET USER
    // ═══════════════════════════════════════════════════════════════
    const targetUser = await User.findById(userId);

    if (!targetUser) {
      return res.status(404).json({
        success: false,
        message: '❌ User not found',
      });
    }

    if (targetUser.userType !== 'client') {
      return res.status(403).json({
        success: false,
        message: '❌ This endpoint is for client profiles only',
      });
    }

    // ═══════════════════════════════════════════════════════════════
    // 2️⃣ FETCH CLIENT DATA
    // ═══════════════════════════════════════════════════════════════
    const client = await Client.findOne({ userId }).populate({
      path: 'subscription',
      select: 'plan subscriptionStatus planActivatedAt planExpiresAt',
    });

    if (!client) {
      return res.status(404).json({
        success: false,
        message: '❌ Client profile not found',
      });
    }

    const isOwnProfile = userId.toString() === requesterId.toString();

    // ═══════════════════════════════════════════════════════════════
    // 3️⃣ CHECK PROFILE VISIBILITY
    // ═══════════════════════════════════════════════════════════════
    if (!isOwnProfile && (targetUser.status !== 'active' || !targetUser.canLogin)) {
      return res.status(403).json({
        success: false,
        message: '❌ This profile is not available',
      });
    }

    // ═══════════════════════════════════════════════════════════════
    // 4️⃣ SUBSCRIPTION STATUS
    // ═══════════════════════════════════════════════════════════════
    const hasSubscription = !!client.subscription;
    const isPremiumPlan = client.subscription?.plan && client.subscription.plan !== 'free';
    
   const isSubscriptionActive =
  hasSubscription &&
  ['active', 'cancelled'].includes(client.subscription.subscriptionStatus) &&
  new Date() < new Date(client.subscription.planExpiresAt);

    // ═══════════════════════════════════════════════════════════════
    // 5️⃣ BLUE VERIFIED BADGE (Premium Subscribers Only)
    // ═══════════════════════════════════════════════════════════════
    const hasBlueVerifiedBadge = isPremiumPlan && isSubscriptionActive;

    // ═══════════════════════════════════════════════════════════════
    // 6️⃣ VERIFICATION BADGE LOGIC (Admin/Premium Email Verified)
    // ═══════════════════════════════════════════════════════════════
    const getVerificationBadge = () => {
      // 🎯 ADMIN VERIFIED - highest priority
      if (targetUser.isAdminVerified) {
        return {
          type: 'admin-verified',
          label: 'Admin Verified',
          icon: 'shield-check',
          priority: 'high',
          showBadge: true,
        };
      }

      // 🎯 PREMIUM + EMAIL VERIFIED
      if (isSubscriptionActive && targetUser.isEmailVerified) {
        return {
          type: 'premium-verified',
          label: 'Verified Premium',
          icon: 'star',
          priority: 'high',
          showBadge: true,
        };
      }

      // ❌ NO BADGE
      return {
        type: null,
        label: null,
        icon: null,
        priority: null,
        showBadge: false,
      };
    };

    const verificationBadge = getVerificationBadge();

    // ═══════════════════════════════════════════════════════════════
    // 7️⃣ PUBLIC PROFILE DATA
    // ═══════════════════════════════════════════════════════════════
    const profileData = {
      userId: client.userId,
      profilePic: client.profilePic,
      profileBannerImage: client.profileBannerImage,
      bio: client.bio,
      lookingSkillsFor: client.lookingSkillsFor,
      profileCompleted: client.profileCompleted,
      profileCreatedAt: client.createdAt,
      subscriptionTier: client.subscription?.plan || 'free',

     // 👤 USER INFO WITH BLUE BADGE ATTACHED
user: {
  fullname: targetUser.fullname,
  username: targetUser.username,
  // 🔵 BLUE VERIFIED BADGE - PREMIUM SUBSCRIBERS ONLY
  blueVerified: hasBlueVerifiedBadge
    ? {
        status: true,
        icon:   'verified',      // frontend maps to icon component
        color:  '#0066FF',
        bg:     '#EBF5FF',
        label:  'Premium Member',
      }
    : {
        status: false,
      },
  status: targetUser.status,
  ...(isOwnProfile && {
    email:           targetUser.email,
    phone:           targetUser.phone || null,
    isEmailVerified: targetUser.isEmailVerified,
    isAdminVerified: targetUser.isAdminVerified,
  }),
},
      // ✅ VERIFICATION BADGE (Admin/Premium Email Verified - different from blue)
      ...(verificationBadge.showBadge && {
        verification: {
          type: verificationBadge.type,
          label: verificationBadge.label,
          icon: verificationBadge.icon,
          priority: verificationBadge.priority,
        },
      }),

      // 📊 SOCIAL STATS (public)
      stats: {
        followersCount: client.followersCount || 0,
        reviewsCount: client.reviews?.length || 0,
        totalJobsPosted: client.jobStats?.totalPosted || 0,
        totalJobsCompleted: client.jobStats?.totalCompleted || 0,
      },
    };

    // ═══════════════════════════════════════════════════════════════
    // 8️⃣ SENSITIVE DATA (own profile only)
    // ═══════════════════════════════════════════════════════════════
    if (isOwnProfile) {
      // 💳 SUBSCRIPTION DETAILS
      const daysRemaining = isSubscriptionActive
        ? Math.ceil(
            (new Date(client.subscription.planExpiresAt) - new Date()) /
              (1000 * 60 * 60 * 24)
          )
        : 0;

      profileData.subscription = {
        plan: client.subscription?.plan || 'free',
        status: client.subscription?.subscriptionStatus || 'inactive',
        activatedAt: client.subscription?.planActivatedAt || null,
        expiresAt: client.subscription?.planExpiresAt || null,
        isActive: isSubscriptionActive,
         isPremium: isSubscriptionActive,
        daysRemaining: daysRemaining,
      };

      // 💰 PAYMENT & SPENDING INFO
      profileData.paymentInfo = {
        subscriptionTier: client.subscription?.plan || 'free',
        hasActiveSubscription: isSubscriptionActive,
        hasBlueVerifiedBadge: hasBlueVerifiedBadge,
        totalSpent: client.jobStats?.totalSpent || 0,
        totalJobsPosted: client.jobStats?.totalPosted || 0,
        totalJobsActive: client.jobStats?.totalActive || 0,
        totalJobsCompleted: client.jobStats?.totalCompleted || 0,
        defaultPaymentMethod: client.paymentMethods?.find((m) => m.isDefault) || null,
      };

      // ✅ DETAILED VERIFICATION STATUS (private)
   // ✅ CORRECT — Only show blue badge details if actually premium
profileData.verificationDetails = {
  blueVerified: hasBlueVerifiedBadge
    ? {
        status:      true,
        icon:        'verified',
        color:       '#0066FF',
        bg:          '#EBF5FF',
        label:       'Premium Member',
        description: 'Active premium subscription',
      }
    : {
        status: false,
      },
  hasBadge:   verificationBadge.showBadge,
  badgeType:  verificationBadge.type,
  badgeLabel: verificationBadge.label,
  emailVerified: {
    status:     targetUser.isEmailVerified,
    verifiedAt: targetUser.emailVerifiedAt || null,
    icon:       'mail',
    color:      '#00B37E',
  },
  adminVerified: {
    status:     targetUser.isAdminVerified,
    verifiedAt: targetUser.adminVerifiedAt || null,
    icon:       'shield-check',
    color:      '#0066FF',
  },
  phoneVerified: {
    status: !!targetUser.phone,
    icon:   'phone',
    color:  '#FF6B35',
  },
};

      // 📋 RECENT ACTIVE POSTS (own profile only)
      profileData.recentPosts = client.posts
        .filter((post) => post.status === 'active')
        .slice(0, 5)
        .map((post) => ({
          _id: post._id,
          title: post.title,
          category: post.category,
          status: post.status,
          createdAt: post.createdAt,
        })) || [];
    }

    // ═══════════════════════════════════════════════════════════════
    // 9️⃣ RESPONSE
    // ═══════════════════════════════════════════════════════════════
    return res.status(200).json({
      success: true,
      isOwnProfile,
      data: profileData,
    });
  } catch (error) {
    console.error('❌ ERROR in getClientProfile:', error.message, error.stack);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch client profile',
      ...(process.env.NODE_ENV === 'development' && { error: error.message }),
    });
  }
};
// ═══════════════════════════════════════════════════════════════
// 3️⃣ GET EMPLOYEE PROFILE (Clients view employees)
// ═══════════════════════════════════════════════════════════════



/**
 * 👁️ CLIENT VIEWS EMPLOYEE PROFILE
 * - Only clients can access this endpoint
 * - Shows public profile data + reviews + ratings
 * - Does NOT show sensitive payment/verification data
 */
export const getEmployeeProfileForClient = async (req, res) => {
  try {
    const { userId } = req.params;
    const requesterId = req.userId;

    console.log('👁️ CLIENT VIEWING EMPLOYEE PROFILE');
    console.log('  Requester (Client):', requesterId);
    console.log('  Target (Employee):', userId);

    // ═══════════════════════════════════════════════════════════════
    // PERMISSION CHECK: Only clients can access
    // ═══════════════════════════════════════════════════════════════

    if (req.userType !== 'client') {
      return res.status(403).json({
        success: false,
        message: '❌ Only clients can access this endpoint',
      });
    }

    // ═══════════════════════════════════════════════════════════════
    // VALIDATION: userId format
    // ═══════════════════════════════════════════════════════════════

    if (!userId.match(/^[0-9a-fA-F]{24}$/)) {
      return res.status(400).json({
        success: false,
        message: '❌ Invalid user ID format',
      });
    }

    // ═══════════════════════════════════════════════════════════════
    // CHECK: Target user exists & is EMPLOYEE
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

    // ═══════════════════════════════════════════════════════════════
    // CHECK: Employee is active
    // ═══════════════════════════════════════════════════════════════

    if (targetUser.status !== 'active' || !targetUser.canLogin) {
      return res.status(403).json({
        success: false,
        message: '❌ This employee profile is not available',
        details: {
          status: targetUser.status,
          canLogin: targetUser.canLogin,
        },
      });
    }

    // ═══════════════════════════════════════════════════════════════
    // FETCH: Employee profile with relationships
    // ═══════════════════════════════════════════════════════════════

    let employee = await Employee.findOne({ userId })
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

    // ═══════════════════════════════════════════════════════════════
    // SYNC VERIFIED BADGE (ensure it's current)
    // ═══════════════════════════════════════════════════════════════

                // TO ✅
let hasPremium = false;
try {
  await employee.syncBadge();
  employee = await Employee.findOne({ userId })
    .populate({
      path:   'subscription',
      select: 'plan subscriptionStatus planActivatedAt planExpiresAt',
    })
    .populate({
      path:   'verificationDetails.verifiedByAdmin',
      select: 'fullname username',
    });

  const sub = employee.subscription;
  hasPremium = !!(
    sub &&
    sub.plan === 'premium' &&
    ['active', 'cancelled'].includes(sub.subscriptionStatus) &&
    new Date() < new Date(sub.planExpiresAt)
  );
} catch (syncError) {
  console.warn('⚠️ Badge sync warning:', syncError.message);
}

    // ═══════════════════════════════════════════════════════════════
    // CALCULATE: Average rating & review count
    // ═══════════════════════════════════════════════════════════════

    const averageRating = employee.getAverageRating();
    const reviewCount = employee.reviews ? employee.reviews.length : 0;

    console.log(
      `📊 Employee Stats: Rating ${averageRating}/5 from ${reviewCount} reviews`
    );

    // ═══════════════════════════════════════════════════════════════
    // BUILD: Public profile data (for clients)
    // ═══════════════════════════════════════════════════════════════

    const profileData = {
      // ✅ Identity
      userId: employee.userId,
      user: {
        fullname: targetUser.fullname,
        username: targetUser.username,
        status: targetUser.status,
        isEmailVerified: targetUser.isEmailVerified,
      },

      // ✅ Profile Media
      profilePic: employee.profilePic,
      profileBannerImage: employee.profileBannerImage,
      bio: employee.bio,

      // ✅ Professional Info (what clients care about)
      skills: employee.skills,
      experience: employee.experience,
      portfolio: employee.portfolio || [],

      // ✅ Availability & Rates (critical for hiring)
      availability: employee.availability,
      hourlyRate: employee.hourlyRate,

      // ✅ Performance Stats
      jobStats: employee.jobStats,
      reviewStats: {
        averageRating: parseFloat(averageRating),
        reviewCount: reviewCount,
        ratings: {
          '5': employee.reviews?.filter((r) => r.rating === 5).length || 0,
          '4': employee.reviews?.filter((r) => r.rating === 4).length || 0,
          '3': employee.reviews?.filter((r) => r.rating === 3).length || 0,
          '2': employee.reviews?.filter((r) => r.rating === 2).length || 0,
          '1': employee.reviews?.filter((r) => r.rating === 1).length || 0,
        },
      },




// TO ✅ — replace all three flat fields with badge object
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
  status: employee.adminVerified?.status ?? false,
},








verificationStatus: {
  status: employee.verificationDetails?.status || 'pending', // ✅ 'pending'|'approved'|'rejected'
  method: employee.verificationDetails?.verificationMethod || null,
},
      // ✅ Social Stats
      followersCount: employee.followersCount,
      profileCompleted: employee.profileCompleted,

      // ✅ Client Reviews (public reviews only)
      reviews: (employee.reviews || []).map((review) => ({
        _id: review._id,
        rating: review.rating,
        comment: review.comment,
        clientName: review.clientName,
        createdAt: review.createdAt,
      })),

      // ✅ Timestamps
      createdAt: employee.createdAt,
      updatedAt: employee.updatedAt,
    };

    // ═══════════════════════════════════════════════════════════════
    // IMPORTANT: Clients DO NOT see:
    // ❌ Bank details
    // ❌ PAN card details
    // ❌ Withdrawal history
    // ❌ Payment status
    // ❌ Employee's subscription info
    // ❌ Personal email/phone
    // ═══════════════════════════════════════════════════════════════

    return res.status(200).json({
      success: true,
      data: profileData,
    });
  } catch (error) {
    console.error('❌ ERROR in getEmployeeProfile (Client View):', error.message);
    console.error('Stack:', error.stack);

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
// 4️⃣ DELETE CLIENT PROFILE IMAGE
// ═══════════════════════════════════════════════════════════════

export const deleteClientProfileImage = async (req, res) => {
  try {
    const userId              = req.userId;
    const { imageType }       = req.body;

    console.log('🗑️ DELETE CLIENT IMAGE — userId:', userId, '| type:', imageType);

    if (!['profilePic', 'profileBannerImage'].includes(imageType)) {
      return res.status(400).json({
        success: false,
        message: '❌ Invalid image type. Use "profilePic" or "profileBannerImage"',
      });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ success: false, message: '❌ User not found' });
    }
    if (user.userType !== 'client') {
      return res.status(403).json({ success: false, message: '❌ Only clients can access this endpoint' });
    }

    const client = await Client.findOne({ userId });
    if (!client) {
      return res.status(404).json({ success: false, message: '❌ Client profile not found' });
    }

    const imageUrl = client[imageType];
    if (!imageUrl) {
      return res.status(404).json({ success: false, message: `❌ No ${imageType} found to delete` });
    }

    await deleteImageFromR2(imageUrl);

    client[imageType] = null;
    await client.save();

    console.log(`✅ ${imageType} deleted`);

    return res.status(200).json({
      success: true,
      message: `✅ ${imageType} deleted successfully`,
      data: {
        userId:             client.userId,
        profilePic:         client.profilePic,
        profileBannerImage: client.profileBannerImage,
      },
    });

  } catch (error) {
    console.error('❌ ERROR in deleteClientProfileImage:', error.message);
    return res.status(500).json({
      success: false,
      message: 'Failed to delete image',
      error:   process.env.NODE_ENV === 'development' ? error.message : 'Internal server error',
    });
  }
};

// ═══════════════════════════════════════════════════════════════
// EXPORTS
// ═══════════════════════════════════════════════════════════════

export default {
  createOrUpdateClientProfile,
  getClientProfile,
  getEmployeeProfileForClient,
  deleteClientProfileImage,
};