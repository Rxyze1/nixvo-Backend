// Controllers/user/employee/employeeClient.Controller.js

import mongoose from 'mongoose';
import Client   from '../../../Models/USER-Auth/Client-Model.js';
import User     from '../../../Models/USER-Auth/User-Auth.-Model.js';
import Job      from '../../../Models/USER-Auth/Client/Job.js';

// ---------------------------------------------------------------------------
// CONSTANTS
// ---------------------------------------------------------------------------
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
  'colorGrading',
  'colorCorrection',
  'motionGraphics',
  'soundDesign',
  'all',
];

// ===========================================================================
// GET CLIENT PUBLIC PROFILE + ALL THEIR JOBS  (Employee only)
// GET /employee/clients/:clientId
// ===========================================================================
export const getClientPublicProfile = async (req, res) => {
  try {
    console.log('\n[GET CLIENT PUBLIC PROFILE - EMPLOYEE VIEW]\n');

    // -- 1. Auth --------------------------------------------------------------
    if (!req.user) {
      return res.status(401).json({ success: false, message: 'Authentication required' });
    }
    if (req.userType !== 'employee') {
      return res.status(403).json({ success: false, message: 'Only employees can view client profiles' });
    }

    console.log('Auth passed -', req.user.fullname);

    // -- 2. Validate clientId -------------------------------------------------
    const { clientId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(clientId)) {
      return res.status(400).json({ success: false, message: 'Invalid client ID format' });
    }

    console.log('Looking up client:', clientId);

    // -- 3. Fetch Client doc --------------------------------------------------
const client = await Client.findOne({
  $or: [
    { _id:    clientId },
    { userId: clientId }
  ]
})
  .select('userId profilePic profileBannerImage bio lookingSkillsFor jobStats profileCompleted isPremium createdAt')
  .lean()
  .maxTimeMS(5000);

    if (!client) {
      return res.status(404).json({ success: false, message: 'Client profile not found' });
    }

    // -- 4. Fetch User doc (must be active) -----------------------------------
    const user = await User.findOne({
      _id:      client.userId,
      userType: 'client',
      status:   'active',
    })
      .select('fullname username profilePicture ratings createdAt lastActive')
      .lean()
      .maxTimeMS(5000);

    if (!user) {
      return res.status(404).json({ success: false, message: 'Client account is not available' });
    }

    console.log('Client found:', user.fullname);

    // -- 5. Parse job query params --------------------------------------------
    const {
      page        = 1,
      limit       = 10,
      skill,
      needFor,
      minPrice,
      maxPrice,
      currency,
      tags,
      search,
      sortBy      = 'postedAt',
      sortOrder   = 'desc',
      closingSoon,
    } = req.query;

    const pageNum  = Math.max(1, parseInt(page)  || 1);
    const limitNum = Math.min(50, Math.max(1, parseInt(limit) || 10));
    const skip     = (pageNum - 1) * limitNum;

    // -- 6. Build job filter (always scoped to this client) -------------------
    const jobFilter = {
      userId:   client.userId,
      isActive: true,
      status:   'open',
    };

    // Skill filter — 'all' means no filter applied
    if (skill) {
      const skills = skill
        .split(',')
        .map(s => s.trim())
        .filter(s => VALID_SKILLS.includes(s) && s !== 'all');
      if (skills.length) {
        jobFilter.requiredSkills = { $in: skills };
      }
    }

    if (needFor && ['long-term', 'short-term'].includes(needFor)) {
      jobFilter.needFor = needFor;
    }

    if (minPrice || maxPrice) {
      jobFilter.price = {};
      const min = parseInt(minPrice);
      const max = parseInt(maxPrice);
      if (!isNaN(min) && min >= 0) jobFilter.price.$gte = min;
      if (!isNaN(max) && max >  0) jobFilter.price.$lte = max;
    }

    if (currency && ['INR', 'USD', 'EUR', 'GBP'].includes(currency)) {
      jobFilter.currency = currency;
    }

    if (tags) {
      const tagArray = tags.split(',').map(t => t.trim()).filter(Boolean);
      if (tagArray.length) jobFilter.tags = { $in: tagArray };
    }

    if (search && search.trim()) {
      jobFilter.$or = [
        { jobTitle:    { $regex: search.trim(), $options: 'i' } },
        { description: { $regex: search.trim(), $options: 'i' } },
      ];
    }

    if (closingSoon === 'true') {
      const now  = new Date();
      const soon = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
      jobFilter.deadline = { $gte: now, $lte: soon };
    }

    // -- 7. Sort --------------------------------------------------------------
    const validSortFields = ['postedAt', 'price', 'jobTitle', 'applicationsCount', 'deadline'];
    const sortField       = validSortFields.includes(sortBy) ? sortBy : 'postedAt';
    const sort            = { [sortField]: sortOrder === 'asc' ? 1 : -1 };

    // -- 8. Query jobs --------------------------------------------------------
    console.log('Fetching client jobs with filters...');

    const t0 = Date.now();

    const [jobs, totalJobCount] = await Promise.all([
      Job.find(jobFilter)
        .sort(sort)
        .skip(skip)
        .limit(limitNum)
        .select('-validationResults -__v')
        .lean()
        .maxTimeMS(5000),
      Job.countDocuments(jobFilter),
    ]);

    console.log(jobs.length + '/' + totalJobCount + ' jobs fetched in ' + (Date.now() - t0) + 'ms');

    // -- 9. Format jobs -------------------------------------------------------
    const now          = new Date();
    const sevenDaysOut = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

    const formattedJobs = jobs.map(j => ({
      id:                j._id,
      jobTitle:          j.jobTitle,
      description:       j.description,
      price:             j.price,
      currency:          j.currency,
      needFor:           j.needFor,
      status:            j.status,
      tags:              j.tags              ?? [],
      requiredSkills:    j.requiredSkills    ?? [],
      images:            j.images            ?? [],
      applicationsCount: j.applicationsCount ?? 0,
      postedAt:          j.postedAt,
      deadline:          j.deadline          ?? null,
      isClosingSoon:     j.deadline
                           ? j.deadline >= now && j.deadline <= sevenDaysOut
                           : false,
      daysUntilDeadline: j.deadline
                           ? Math.ceil((new Date(j.deadline) - now) / (1000 * 60 * 60 * 24))
                           : null,
    }));

    // -- 10. Response ---------------------------------------------------------
    return res.status(200).json({
      success: true,
      message: 'Client profile fetched successfully',
      data: {

        profile: {
          clientId:           client._id,
          userId:             client.userId,
          fullname:           user.fullname              ?? '',
          username:           user.username              ?? '',
          profilePicture:     user.profilePicture        ?? null,
          profileBannerImage: client.profileBannerImage  ?? null,
          profilePic:         client.profilePic          ?? null,
          bio:                client.bio                 ?? '',
          lookingSkillsFor:   client.lookingSkillsFor    ?? null,
          profileCompleted:   client.profileCompleted    ?? false,

            // ── ADD THESE ↓
  isPremium:   client.isPremium ?? false,
  blueVerified: client.isPremium
    ? { status: true, icon: 'verified', color: '#0066FF', bg: '#EBF5FF', label: 'Premium Member' }
    : { status: false },
  tier: client.isPremium ? 'premium' : 'free',

  ratings: {
    average: user.ratings?.average ?? 0,
    count:   user.ratings?.count   ?? 0,
  },



          ratings: {
            average: user.ratings?.average ?? 0,
            count:   user.ratings?.count   ?? 0,
          },
          jobStats: {
            totalPosted: client.jobStats?.totalPosted ?? 0,
            totalActive: client.jobStats?.totalActive ?? 0,
            totalClosed: client.jobStats?.totalClosed ?? 0,
          },
          memberSince: user.createdAt  ?? null,
          lastActive:  user.lastActive ?? null,
        },

        jobs: formattedJobs,

        pagination: {
          currentPage: pageNum,
          totalPages:  Math.ceil(totalJobCount / limitNum),
          totalJobs:   totalJobCount,
          jobsPerPage: limitNum,
          hasNextPage: pageNum < Math.ceil(totalJobCount / limitNum),
          hasPrevPage: pageNum > 1,
        },

        appliedFilters: {
          skill:       skill       || null,
          needFor:     needFor     || null,
          minPrice:    minPrice    || null,
          maxPrice:    maxPrice    || null,
          currency:    currency    || null,
          tags:        tags        || null,
          search:      search      || null,
          sortBy:      sortField,
          sortOrder:   sortOrder,
          closingSoon: closingSoon === 'true',
        },

      },
    });

  } catch (error) {
    console.error('GET CLIENT PUBLIC PROFILE ERROR:', error.message);

    if (error.name === 'CastError') {
      return res.status(400).json({ success: false, message: 'Invalid client ID format' });
    }

    return res.status(500).json({
      success: false,
      message: 'Failed to fetch client profile',
      error:   process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};