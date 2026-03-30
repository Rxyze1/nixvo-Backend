// Controller/user/client/ClientEmployee.Controller.js
import mongoose from 'mongoose';
import Employee  from '../../../Models/USER-Auth/Employee-Model.js';
import Client    from '../../../Models/USER-Auth/Client-Model.js';
import User      from '../../../Models/USER-Auth/User-Auth.-Model.js';
import Portfolio from '../../../Models/USER-Auth/Employee/PortfolioModel.js';
import Job       from '../../../Models/USER-Auth/Client/Job.js'; // ✅ NEW — needed for recommended query

// ═══════════════════════════════════════════════════════════════
// 🔧 HELPERS
// ═══════════════════════════════════════════════════════════════

const buildPagination = (page, limit, total, skip, fetchedCount) => ({
  currentPage:  Number(page),
  totalPages:   Math.ceil(total / Number(limit)),
  totalItems:   total,
  itemsPerPage: Number(limit),
  hasNextPage:  skip + fetchedCount < total,
  hasPrevPage:  Number(page) > 1,
});


// TO ✅
const EMPLOYEE_PUBLIC_FIELDS =
  'userId bio profilePic profileBannerImage profileCompleted skills experience ' +
  'hourlyRate portfolio verificationDetails.status verifiedBadge ' +
  'hasBadge badgeType badgeLabel blueVerified adminVerified subscription ' +
  'jobStats.totalCompleted jobStats.completionRate followersCount ' +
  'reviews availability createdAt updatedAt';

const buildBadge = (emp) => {
  // ✅ Use the blueVerified field already in the employee document
  const isPremium = emp?.blueVerified?.status ?? false;
  
  return {
    badge: emp?.hasBadge ? {
      show: true,
      type: emp.badgeType,
      label: emp.badgeLabel,
      icon: emp.badgeType === 'blue-verified' ? 'verified' : emp.badgeType === 'admin-verified' ? 'shield-check' : 'badge',
      color: emp.badgeType === 'blue-verified' ? '#0066FF' : emp.badgeType === 'admin-verified' ? '#00B37E' : '#888',
      bg: emp.badgeType === 'blue-verified' ? '#EBF5FF' : emp.badgeType === 'admin-verified' ? '#E6FAF5' : '#f0f0f0',
    } : { show: false },
    blueVerified: isPremium 
      ? { 
          status: true, 
          icon: 'verified', 
          color: '#0066FF', 
          bg: '#EBF5FF', 
          label: 'Premium Member' 
        } 
      : { status: false },
    adminVerified: { status: emp?.adminVerified?.status ?? false },
    tier: isPremium ? 'premium' : emp?.adminVerified?.status ? 'verified' : 'free',
  };
};















// ═══════════════════════════════════════════════════════════════
// 📋 1. GET ALL EMPLOYEES
// ═══════════════════════════════════════════════════════════════
export const getAllEmployees = async (req, res) => {
  try {
    const {
      page         = 1,
      limit        = 10,
      sortBy       = 'createdAt',
      order        = 'desc',
      availability,
      minRate,
      maxRate,
      currency     = 'INR',
      isVerified,
       blueVerified,    // ✅ ADD
  adminVerified,   // ✅ ADD
      search,
    } = req.query;

    const SKILL_ALIASES = {
      'thumbnail':  'thumbnailArtists',
      'thumb':      'thumbnailArtists',
      'editor':     'videoEditors',
      'editing':    'videoEditors',
      'video':      'videoEditors',
      'ai':         'AiArtists',
      '3d':         '3dVideoArtists',
      'color':      'colorGrading',
      'colour':     'colorGrading',
      'grading':    'colorGrading',
    };

    const resolveToken = (token) => {
      const lower = token.toLowerCase();
      for (const [alias, skill] of Object.entries(SKILL_ALIASES)) {
        if (lower.includes(alias)) return skill;
      }
      return null;
    };

    const userFilter = {
      userType:                'employee',
      status:                  'active',
      adminVerificationStatus: 'approved',
      isAdminVerified:         true,
    };

    let userIds = [];

    if (search) {
      const tokens = search.trim().split(/\s+/).filter(Boolean);

      const nameMatchUsers = await User.find({
        ...userFilter,
        $or: tokens.flatMap(t => [
          { fullname: { $regex: t, $options: 'i' } },
          { username: { $regex: t, $options: 'i' } },
        ]),
      }).select('_id').lean();

      const skillConditions = tokens.flatMap(t => {
        const resolved = resolveToken(t);
        return [
          resolved ? { skills: resolved } : null,
          { skills: { $regex: t, $options: 'i' } },
          { bio:    { $regex: t, $options: 'i' } },
        ].filter(Boolean);
      });

      const skillMatchEmployees = await Employee.find({ $or: skillConditions })
        .select('userId').lean();

      const nameIds  = nameMatchUsers.map(u => u._id.toString());
      const skillIds = skillMatchEmployees.map(e => e.userId.toString());
      const merged   = [...new Set([...nameIds, ...skillIds])];

      if (merged.length === 0) {
        return res.status(200).json({
          success: true,
          message: 'No employees found',
          data: { employees: [], pagination: buildPagination(page, limit, 0, 0, 0) },
        });
      }

      const validUsers = await User.find({
        _id:                     { $in: merged },
        userType:                'employee',
        status:                  'active',
        adminVerificationStatus: 'approved',
        isAdminVerified:         true,
      }).select('_id fullname username plan ratings lastActive createdAt').lean();

      userIds = validUsers.map(u => u._id);
      req._matchingUsers = validUsers;

    } else {
      const allUsers = await User.find(userFilter)
        .select('_id fullname username plan ratings lastActive createdAt')
        .lean();
      userIds = allUsers.map(u => u._id);
      req._matchingUsers = allUsers;
    }

    if (userIds.length === 0) {
      return res.status(200).json({
        success: true,
        message: 'No employees found',
        data: { employees: [], pagination: buildPagination(page, limit, 0, 0, 0) },
      });
    }

    const employeeFilter = { userId: { $in: userIds } };
    if (availability) employeeFilter['availability.status'] = availability;
    if (isVerified !== undefined) employeeFilter.verifiedBadge = isVerified === 'true';
    if (minRate || maxRate) {
      employeeFilter['hourlyRate.currency'] = currency;
      employeeFilter['hourlyRate.amount']   = {};
      if (minRate) employeeFilter['hourlyRate.amount'].$gte = Number(minRate);
      if (maxRate) employeeFilter['hourlyRate.amount'].$lte = Number(maxRate);
    }

    const allowedSortFields = [
      'createdAt', 'updatedAt', 'hourlyRate.amount',
      'jobStats.totalCompleted', 'jobStats.completionRate', 'followersCount',
    ];
    const safeSortBy  = allowedSortFields.includes(sortBy) ? sortBy : 'createdAt';
    const sortOptions = { [safeSortBy]: order === 'asc' ? 1 : -1 };
    const skip        = (Number(page) - 1) * Number(limit);

    const [employees, total] = await Promise.all([
      Employee.find(employeeFilter)
        .select(EMPLOYEE_PUBLIC_FIELDS)
        .sort(sortOptions)
        .skip(skip)
        .limit(Number(limit))
        .lean(),
      Employee.countDocuments(employeeFilter),
    ]);

    const userMap = {};
    req._matchingUsers.forEach(u => { userMap[u._id.toString()] = u; });

    const formatted = employees
      .map(emp => {
        const user = userMap[emp.userId.toString()];
        if (!user) return null;
        return {
          userId:      user._id,
          employeeId:  emp._id,
          fullname:    user.fullname  ?? '',
          username:    user.username  ?? '',
          plan:        user.plan      ?? 'free',
          ratings:     user.ratings   ?? { average: 0, count: 0 },
          lastActive:  user.lastActive ?? null,
          memberSince: user.createdAt  ?? null,
          profilePic:         emp.profilePic         ?? null,
          profileBannerImage: emp.profileBannerImage ?? null,
          bio:                emp.bio                ?? '',
          profileCompleted:   emp.profileCompleted   ?? false,
          skills:     emp.skills ?? [],
          experience: {
            totalYears:  emp.experience?.totalYears  ?? 0,
            description: emp.experience?.description ?? '',
          },
          hourlyRate: {
            amount:   emp.hourlyRate?.amount   ?? 0,
            currency: emp.hourlyRate?.currency ?? 'INR',
          },
          availability: {
            status:       emp.availability?.status       ?? 'unavailable',
            hoursPerWeek: emp.availability?.hoursPerWeek ?? 0,
          },
          verifiedBadge: emp.verifiedBadge ?? false,
...buildBadge(emp),  // ← ADD THIS
          verificationStatus: emp.verificationDetails?.status ?? 'pending',
          jobStats: {
            totalCompleted: emp.jobStats?.totalCompleted ?? 0,
            completionRate: emp.jobStats?.completionRate ?? 0,
          },
          followersCount: emp.followersCount ?? 0,
          totalReviews: (emp.reviews ?? []).length,
          recentReviews: (emp.reviews ?? [])
            .slice(-3).reverse()
            .map(r => ({ rating: r.rating ?? 0, comment: r.comment ?? '', createdAt: r.createdAt ?? null })),
          portfolioPreview: (emp.portfolio ?? [])
            .slice(0, 3)
            .map(p => ({
              id: p._id, title: p.title ?? '', description: p.description ?? '',
              images: p.images?.slice(0, 1) ?? [], links: p.links ?? [], createdAt: p.createdAt ?? null,
            })),
          totalPortfolios: (emp.portfolio ?? []).length,
        };
      })
      .filter(Boolean);

    return res.status(200).json({
      success: true,
      message: 'Employees fetched successfully',
      data: { employees: formatted, pagination: buildPagination(page, limit, total, skip, employees.length) },
    });

  } catch (error) {
    console.error('❌ Get all employees error:', error);
    return res.status(500).json({ success: false, message: 'Failed to fetch employees', error: error.message });
  }
};
// ═══════════════════════════════════════════════════════════════
// ⭐ 2. GET RECOMMENDED EMPLOYEES
// ═══════════════════════════════════════════════════════════════
export const getRecommendedEmployees = async (req, res) => {
  try {
    const clientUserId = req.user._id;
    const { page = 1, limit = 10 } = req.query;

    // ── Step 1: Fetch client profile ────────────────────────────
    const client = await Client.findOne({ userId: clientUserId })
      .select('hiringPreferences lookingSkillsFor')
      .lean();

    if (!client) {
      return res.status(404).json({ success: false, message: 'Client profile not found' });
    }

    // ── Step 2: Pull skills from ALL sources ─────────────────────

    const preferredSkills = client.hiringPreferences?.preferredSkills ?? [];
    const singleSkill     = client.lookingSkillsFor ? [client.lookingSkillsFor] : [];

    // ✅ FIX: query Job model directly — client.posts is a legacy embedded
    // array that is NOT where CreateJobScreen saves jobs. Jobs live in the
    // Job collection with userId / clientId references.
    const recentJobs = await Job.find({
      userId:   clientUserId,
      isActive: true,
      status:   { $in: ['open', 'in-progress', 'closing-soon', 'approved'] },
    })
      .sort({ createdAt: -1 })
      .limit(5)
      .select('jobTitle requiredSkills needFor status createdAt')
      .lean();

    const postSkills     = recentJobs.flatMap(j => j.requiredSkills ?? []);
    const postCategories = [...new Set(recentJobs.map(j => j.needFor).filter(Boolean))];

    const allRequiredSkills = [...new Set([
      ...preferredSkills,
      ...singleSkill,
      ...postSkills,
    ])];

    const preferredRate = client.hiringPreferences?.preferredRateRange;

    if (allRequiredSkills.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No skills found to base recommendations on',
        hint:    'Post a job with required skills OR update your hiring preferences',
      });
    }

    // ── Step 3: Get active, approved employee users ──────────────
    const activeUsers = await User.find({
      userType:                'employee',
      status:                  'active',
      adminVerificationStatus: 'approved',
      isAdminVerified:         true,
    })
      .select('_id fullname username plan ratings lastActive createdAt')
      .lean();

    const activeUserIds = activeUsers.map(u => u._id);

    if (activeUserIds.length === 0) {
      return res.status(200).json({
        success: true,
        message: 'No employees available at the moment',
        data: { employees: [], pagination: buildPagination(page, limit, 0, 0, 0) },
      });
    }

    // ── Step 4: Build employee filter ────────────────────────────
    const employeeFilter = {
      userId: { $in: activeUserIds },
      skills: { $in: allRequiredSkills },
    };

    if (preferredRate?.max && preferredRate.max > 0) {
      employeeFilter['hourlyRate.currency'] = preferredRate.currency ?? 'INR';
      employeeFilter['hourlyRate.amount']   = { $lte: Number(preferredRate.max) };
      if (preferredRate.min && preferredRate.min > 0) {
        employeeFilter['hourlyRate.amount'].$gte = Number(preferredRate.min);
      }
    }

    const skip = (Number(page) - 1) * Number(limit);

    // ── Step 5: Fetch matched employees ──────────────────────────
    const [employees, total] = await Promise.all([
      Employee.find(employeeFilter)
        .select(EMPLOYEE_PUBLIC_FIELDS)
        .sort({
          verifiedBadge:             -1,
          'jobStats.completionRate': -1,
          'jobStats.totalCompleted': -1,
        })
        .skip(skip)
        .limit(Number(limit))
        .lean(),
      Employee.countDocuments(employeeFilter),
    ]);

    // ── Step 6: Build userMap ─────────────────────────────────────
    const userMap = {};
    activeUsers.forEach(u => { userMap[u._id.toString()] = u; });

    // ── Step 7: Score each employee ──────────────────────────────
    const preferredSet  = new Set(preferredSkills.map(s => s.toLowerCase()));
    const postSkillSet  = new Set(postSkills.map(s => s.toLowerCase()));
    const lowerRequired = allRequiredSkills.map(s => s.toLowerCase());

    const scored = employees
      .map(emp => {
        const user = userMap[emp.userId.toString()];
        if (!user) return null;

        const matchedSkills    = (emp.skills ?? []).filter(s => lowerRequired.includes(s.toLowerCase()));
        const matchedFromPosts = matchedSkills.filter(s => postSkillSet.has(s.toLowerCase()));
        const matchedFromPrefs = matchedSkills.filter(s => preferredSet.has(s.toLowerCase()));

        const skillMatchScore = lowerRequired.length
          ? (matchedSkills.length / lowerRequired.length) * 35 : 0;
        const postMatchBonus = postSkills.length
          ? (matchedFromPosts.length / Math.max(postSkills.length, 1)) * 20 : 0;
        const ratingScore     = ((user.ratings?.average ?? 0) / 5) * 20;
        const completionScore = ((emp.jobStats?.completionRate ?? 0) / 100) * 15;
        const verifiedBonus   = emp.verifiedBadge ? 10 : 0;

        const relevanceScore = Math.round(
          skillMatchScore + postMatchBonus + ratingScore + completionScore + verifiedBonus
        );

        return {
          userId:      user._id,
          employeeId:  emp._id,
          fullname:    user.fullname   ?? '',
          username:    user.username   ?? '',
          plan:        user.plan       ?? 'free',
          ratings:     user.ratings    ?? { average: 0, count: 0 },
          lastActive:  user.lastActive ?? null,
          memberSince: user.createdAt  ?? null,
          profilePic:         emp.profilePic         ?? null,
          profileBannerImage: emp.profileBannerImage ?? null,
          bio:                emp.bio                ?? '',
          profileCompleted:   emp.profileCompleted   ?? false,
          skills:     emp.skills ?? [],
          experience: {
            totalYears:  emp.experience?.totalYears  ?? 0,
            description: emp.experience?.description ?? '',
          },
          hourlyRate: {
            amount:   emp.hourlyRate?.amount   ?? 0,
            currency: emp.hourlyRate?.currency ?? 'INR',
          },
          availability: {
            status:       emp.availability?.status       ?? 'unavailable',
            hoursPerWeek: emp.availability?.hoursPerWeek ?? 0,
          },
          verifiedBadge:      emp.verifiedBadge               ?? false,
          ...buildBadge(emp),  // ✅ ADD THIS
          verificationStatus: emp.verificationDetails?.status ?? 'pending',
          jobStats: {
            totalCompleted: emp.jobStats?.totalCompleted ?? 0,
            completionRate: emp.jobStats?.completionRate ?? 0,
          },
          followersCount: emp.followersCount ?? 0,
          totalReviews: (emp.reviews ?? []).length,
          recentReviews: (emp.reviews ?? [])
            .slice(-3).reverse()
            .map(r => ({ rating: r.rating ?? 0, comment: r.comment ?? '', createdAt: r.createdAt ?? null })),
          portfolioPreview: (emp.portfolio ?? [])
            .slice(0, 3)
            .map(p => ({
              id: p._id, title: p.title ?? '', description: p.description ?? '',
              images: p.images?.slice(0, 1) ?? [], links: p.links ?? [], createdAt: p.createdAt ?? null,
            })),
          totalPortfolios: (emp.portfolio ?? []).length,
          matchInfo: {
            relevanceScore,
            matchedSkills,
            matchedFromJobPosts:    matchedFromPosts,
            matchedFromPreferences: matchedFromPrefs,
            totalMatched:           matchedSkills.length,
            totalRequired:          allRequiredSkills.length,
            matchPercentage:        Math.round((matchedSkills.length / allRequiredSkills.length) * 100),
          },
        };
      })
      .filter(Boolean)
      .sort((a, b) => b.matchInfo.relevanceScore - a.matchInfo.relevanceScore);

    return res.status(200).json({
      success: true,
      message: 'Recommended employees fetched successfully',
      basedOn: {
        fromHiringPreferences: preferredSkills,
        fromLookingSkillsFor:  singleSkill,
        fromRecentJobPosts:    postSkills,
        allSkillsUsed:         allRequiredSkills,
        recentPostCategories:  postCategories,
        preferredRateRange:    preferredRate ?? null,
        recentJobsSampled:     recentJobs.map(j => ({  // ✅ renamed from recentPostsSampled
          title:          j.jobTitle        ?? '',
          needFor:        j.needFor         ?? null,
          requiredSkills: j.requiredSkills  ?? [],
          status:         j.status,
          createdAt:      j.createdAt,
        })),
      },
      data: {
        employees:  scored,
        pagination: buildPagination(page, limit, total, skip, employees.length),
      },
    });

  } catch (error) {
    console.error('❌ Get recommended employees error:', error);
    return res.status(500).json({ success: false, message: 'Failed to fetch recommendations', error: error.message });
  }
};
// ═══════════════════════════════════════════════════════════════
// 🔍 3. SEARCH EMPLOYEES BY SKILLS
// ═══════════════════════════════════════════════════════════════
export const searchEmployeesBySkills = async (req, res) => {
  try {
    const {
      skills,
      availability,
      minRate,
      maxRate,
      currency  = 'INR',
      isVerified,
      matchType = 'any',
      page      = 1,
      limit     = 10,
    } = req.query;

    if (!skills || !skills.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Please provide at least one skill to search',
        example: '/employees/search?skills=React,Node.js&matchType=any',
      });
    }

    const searchSkills = skills.split(',').map(s => s.trim()).filter(Boolean);

    const activeUsers = await User.find({
      userType:                'employee',
      status:                  'active',
      adminVerificationStatus: 'approved',
      isAdminVerified:         true,
    })
      .select('_id fullname username plan ratings lastActive createdAt')
      .lean();

    const activeUserIds = activeUsers.map(u => u._id);

    if (activeUserIds.length === 0) {
      return res.status(200).json({
        success: true,
        message: 'No employees available at the moment',
        searchCriteria: { skills: searchSkills, matchType },
        data: { employees: [], pagination: buildPagination(page, limit, 0, 0, 0) },
      });
    }

    const employeeFilter = { userId: { $in: activeUserIds } };
    employeeFilter.skills = matchType === 'all' ? { $all: searchSkills } : { $in: searchSkills };
    if (availability) employeeFilter['availability.status'] = availability;
    if (isVerified !== undefined) employeeFilter.verifiedBadge = isVerified === 'true';
    if (minRate || maxRate) {
      employeeFilter['hourlyRate.currency'] = currency;
      employeeFilter['hourlyRate.amount']   = {};
      if (minRate) employeeFilter['hourlyRate.amount'].$gte = Number(minRate);
      if (maxRate) employeeFilter['hourlyRate.amount'].$lte = Number(maxRate);
    }

    const skip = (Number(page) - 1) * Number(limit);

    const [employees, total] = await Promise.all([
      Employee.find(employeeFilter)
        .select(EMPLOYEE_PUBLIC_FIELDS)
        .sort({ verifiedBadge: -1, 'jobStats.completionRate': -1 })
        .skip(skip)
        .limit(Number(limit))
        .lean(),
      Employee.countDocuments(employeeFilter),
    ]);

    if (employees.length === 0) {
      return res.status(200).json({
        success: true,
        message: 'No employees found with the given skills',
        searchCriteria: { skills: searchSkills, matchType },
        data: { employees: [], pagination: buildPagination(page, limit, 0, skip, 0) },
      });
    }

    const userMap = {};
    activeUsers.forEach(u => { userMap[u._id.toString()] = u; });

    const lowerSearch = searchSkills.map(s => s.toLowerCase());

    const scored = employees
      .map(emp => {
        const user = userMap[emp.userId.toString()];
        if (!user) return null;

        const matchedSkills   = (emp.skills ?? []).filter(s => lowerSearch.includes(s.toLowerCase()));
        const skillScore      = (matchedSkills.length / searchSkills.length) * 50;
        const ratingScore     = ((user.ratings?.average ?? 0) / 5) * 25;
        const completionScore = ((emp.jobStats?.completionRate ?? 0) / 100) * 15;
        const verifiedBonus   = emp.verifiedBadge ? 10 : 0;
        const matchScore      = Math.round(skillScore + ratingScore + completionScore + verifiedBonus);

        return {
          userId:      user._id,
          employeeId:  emp._id,
          fullname:    user.fullname   ?? '',
          username:    user.username   ?? '',
          plan:        user.plan       ?? 'free',
          ratings:     user.ratings    ?? { average: 0, count: 0 },
          lastActive:  user.lastActive ?? null,
          memberSince: user.createdAt  ?? null,
          profilePic:         emp.profilePic         ?? null,
          profileBannerImage: emp.profileBannerImage ?? null,
          bio:                emp.bio                ?? '',
          profileCompleted:   emp.profileCompleted   ?? false,
          skills:     emp.skills ?? [],
          experience: {
            totalYears:  emp.experience?.totalYears  ?? 0,
            description: emp.experience?.description ?? '',
          },
          hourlyRate: {
            amount:   emp.hourlyRate?.amount   ?? 0,
            currency: emp.hourlyRate?.currency ?? 'INR',
          },
          availability: {
            status:       emp.availability?.status       ?? 'unavailable',
            hoursPerWeek: emp.availability?.hoursPerWeek ?? 0,
          },
          verifiedBadge:      emp.verifiedBadge               ?? false,
          ...buildBadge(emp),  // ✅ ADD THIS
          verificationStatus: emp.verificationDetails?.status ?? 'pending',
          jobStats: {
            totalCompleted: emp.jobStats?.totalCompleted ?? 0,
            completionRate: emp.jobStats?.completionRate ?? 0,
          },
          followersCount: emp.followersCount ?? 0,
          totalReviews: (emp.reviews ?? []).length,
          recentReviews: (emp.reviews ?? [])
            .slice(-3).reverse()
            .map(r => ({ rating: r.rating ?? 0, comment: r.comment ?? '', createdAt: r.createdAt ?? null })),
          portfolioPreview: (emp.portfolio ?? [])
            .slice(0, 3)
            .map(p => ({
              id: p._id, title: p.title ?? '', description: p.description ?? '',
              images: p.images?.slice(0, 1) ?? [], links: p.links ?? [], createdAt: p.createdAt ?? null,
            })),
          totalPortfolios: (emp.portfolio ?? []).length,
          matchInfo: {
            matchScore,
            matchedSkills,
            totalMatched:    matchedSkills.length,
            totalSearched:   searchSkills.length,
            matchPercentage: Math.round((matchedSkills.length / searchSkills.length) * 100),
          },
        };
      })
      .filter(Boolean)
      .sort((a, b) => b.matchInfo.matchScore - a.matchInfo.matchScore);

    return res.status(200).json({
      success: true,
      message: 'Employees found successfully',
      searchCriteria: { skills: searchSkills, matchType },
      data: { employees: scored, pagination: buildPagination(page, limit, total, skip, employees.length) },
    });

  } catch (error) {
    console.error('❌ Search employees error:', error);
    return res.status(500).json({ success: false, message: 'Failed to search employees', error: error.message });
  }
};
// ═══════════════════════════════════════════════════════════════
// 🔍 4. GET EMPLOYEE FULL PROFILE — CLIENT ONLY
// ═══════════════════════════════════════════════════════════════
export const getEmployeeProfile = async (req, res) => {
  try {
    if (req.userType !== 'client') {
      return res.status(403).json({ success: false, message: 'Access denied. Clients only.' });
    }

    const { employeeId } = req.params;

    if (!employeeId || !mongoose.Types.ObjectId.isValid(employeeId)) {
      return res.status(400).json({ success: false, message: 'Valid Employee ID is required' });
    }

  const emp = await Employee.findOne({
  $or: [
    { _id:    employeeId },
    { userId: employeeId }
  ]
})

    if (!emp) {
      return res.status(404).json({ success: false, message: 'Employee profile not found' });
    }

    const user = await User.findOne({
      _id:                     emp.userId,
      userType:                'employee',
      isEmailVerified:         true,
      status:                  'active',
      adminVerificationStatus: 'approved',
      isAdminVerified:         true,
    })
      .select('fullname username plan ratings status lastActive createdAt')
      .lean()
      .maxTimeMS(5000);

    if (!user) {
      return res.status(404).json({ success: false, message: 'Employee not found' });
    }

    const portfolioItems = await Portfolio.find({
      employeeId:                emp._id,
      userId:                    user._id,
      status:                    'published',
      'moderationStatus.status': 'approved',
      isPublic:                  true,
    })
      .select('portfolioName bio workPrice skills tags badgeType images videos viewCount likeCount status createdAt updatedAt')
      .sort({ createdAt: -1 })
      .lean()
      .maxTimeMS(5000);

    const profileData = {
      userId:          user._id,
      employeeId:      emp._id,
      fullname:        user.fullname   ?? '',
      username:        user.username   ?? '',
      plan:            user.plan       ?? 'free',
      ratings:         user.ratings    ?? { average: 0, count: 0 },
      status:          user.status     ?? 'active',
      lastActive:      user.lastActive ?? null,
      memberSince:     user.createdAt  ?? null,
      profilePic:         emp.profilePic         ?? null,
      profileBannerImage: emp.profileBannerImage ?? null,
      bio:                emp.bio                ?? '',
      profileCompleted:   emp.profileCompleted   ?? false,
      skills:     emp.skills ?? [],
      experience: {
        totalYears:  emp.experience?.totalYears  ?? 0,
        description: emp.experience?.description ?? '',
      },
      hourlyRate: {
        amount:   emp.hourlyRate?.amount   ?? 0,
        currency: emp.hourlyRate?.currency ?? 'INR',
      },
      availability: {
        status:       emp.availability?.status       ?? 'unavailable',
        hoursPerWeek: emp.availability?.hoursPerWeek ?? 0,
      },
      verifiedBadge:      emp.verifiedBadge               ?? false,
      ...buildBadge(emp),  // ✅ ADD THIS LINE
      verificationStatus: emp.verificationDetails?.status ?? 'pending',
      jobStats: {
        totalCompleted: emp.jobStats?.totalCompleted ?? 0,
        completionRate: emp.jobStats?.completionRate ?? 0,
      },
      followersCount: emp.followersCount ?? 0,
      reviews: (emp.reviews ?? [])
        .slice().reverse()
        .map(r => ({ rating: r.rating ?? 0, comment: r.comment ?? '', createdAt: r.createdAt ?? null })),
      totalReviews: (emp.reviews ?? []).length,
      embeddedPortfolio: (emp.portfolio ?? []).map(p => ({
        id: p._id, title: p.title ?? '', description: p.description ?? '',
        links: p.links ?? [], images: p.images ?? [], videos: p.videos ?? [],
        createdAt: p.createdAt ?? null,
      })),
      totalEmbeddedPortfolios: (emp.portfolio ?? []).length,
      portfolios: portfolioItems.map(p => ({
        id:            p._id,
        portfolioName: p.portfolioName ?? '',
        bio:           p.bio           ?? '',
        workPrice: {
          amount:   p.workPrice?.amount   ?? 0,
          currency: p.workPrice?.currency ?? 'INR',
        },
        skills:    p.skills   ?? [],
        tags:      p.tags     ?? [],
        badgeType: p.badgeType ?? 'free',
        images: (p.images ?? [])
          .filter(img => img.validation?.status === 'approved')
          .map(img => ({ id: img._id, url: img.url, width: img.width ?? null, height: img.height ?? null, uploadedAt: img.uploadedAt ?? null })),
        totalImages: (p.images ?? []).length,
        videos: (p.videos ?? [])
          .filter(vid => vid.validation?.status === 'approved')
          .map(vid => ({ id: vid._id, url: vid.url, duration: vid.duration ?? null, resolution: vid.resolution ?? null, uploadedAt: vid.uploadedAt ?? null })),
        totalVideos: (p.videos ?? []).length,
        viewCount:  p.viewCount  ?? 0,
        likeCount:  p.likeCount  ?? 0,
        status:     p.status     ?? 'published',
        createdAt:  p.createdAt  ?? null,
        updatedAt:  p.updatedAt  ?? null,
      })),
      totalPortfolios: portfolioItems.length,
    };

    return res.status(200).json({
      success: true,
      message: 'Employee profile fetched successfully',
      data: { employee: profileData },
    });

  } catch (error) {
    console.error('❌ GET EMPLOYEE PROFILE ERROR:', error.message);
    return res.status(500).json({ success: false, message: 'Failed to fetch employee profile', error: error.message });
  }
};