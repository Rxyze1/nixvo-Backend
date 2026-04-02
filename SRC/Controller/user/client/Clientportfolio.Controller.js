// Controller/user/client/portfolio.Controller.js

import Portfolio from '../../../Models/USER-Auth/Employee/PortfolioModel.js';
import Employee from '../../../Models/USER-Auth/Employee-Model.js';

// ═══════════════════════════════════════════════════════════════
// 📋 GET ALL PORTFOLIOS (WITH FILTERS & PAGINATION)
// ═══════════════════════════════════════════════════════════════

export const getAllPortfolios = async (req, res) => {
  try {
const {
  page = 1,
  limit = 10,
  category,
  badgeType,
  blueVerified,    // ✅ ADD
  adminVerified,   // ✅ ADD
  minPrice,
  maxPrice,
  currency = 'INR',
  sortBy = 'createdAt',
  order = 'desc',
  search
} = req.query;

    // Build filter object
    const filter = {
      status: 'published',
      isPublic: true
    };

    // Filter by category
    if (category) {
      const categories = category.split(',');
      filter.category = { $in: categories };
    }

    // Filter by badge type
    if (badgeType) {
      filter.badgeType = badgeType;
    }

// ✅ ADD THESE
// Filter by blue verified — must join/lookup Employee
// if (blueVerified !== undefined) {
//   filter['employeeId.blueVerified.status'] = blueVerified === 'true';
// }

// if (adminVerified !== undefined) {
//   filter['employeeId.adminVerified.status'] = adminVerified === 'true';
// }



    // Filter by price range
    if (minPrice || maxPrice) {
      filter['workPrice.currency'] = currency;
      filter['workPrice.amount'] = {};
      
      if (minPrice) {
        filter['workPrice.amount'].$gte = Number(minPrice);
      }
      if (maxPrice) {
        filter['workPrice.amount'].$lte = Number(maxPrice);
      }
    }

    // Search in portfolio name and bio
    if (search) {
      filter.$or = [
        { portfolioName: { $regex: search, $options: 'i' } },
        { bio: { $regex: search, $options: 'i' } },
        { skills: { $regex: search, $options: 'i' } },
        { tags: { $regex: search, $options: 'i' } }
      ];
    }

    // Sorting
    const sortOrder = order === 'asc' ? 1 : -1;
    const sortOptions = {};
    sortOptions[sortBy] = sortOrder;

    // Pagination
    const skip = (Number(page) - 1) * Number(limit);

    // Get portfolios with FULL employee info
    const portfolios = await Portfolio.find(filter)
      .populate({
        path: 'employeeId',
        select: '-password -verificationToken -resetPasswordToken -resetPasswordExpires' // Exclude sensitive fields
      })
      .sort(sortOptions)
      .skip(skip)
      .limit(Number(limit))
      .lean();


      // ✅ Post-populate filter
const filteredPortfolios = portfolios.filter(p => {
  if (blueVerified !== undefined) {
    const expected = blueVerified === 'true';
    if ((p.employeeId?.blueVerified?.status ?? false) !== expected) return false;
  }
  if (adminVerified !== undefined) {
    const expected = adminVerified === 'true';
    if ((p.employeeId?.adminVerified?.status ?? false) !== expected) return false;
  }
  return true;
});

    // Get total count
    const total = await Portfolio.countDocuments(filter);

    return res.status(200).json({
      success: true,
      message: '✅ Portfolios fetched successfully',
      data: {
       portfolios: filteredPortfolios.map(portfolio => ({
          // Portfolio Details
          id: portfolio._id,
          portfolioName: portfolio.portfolioName,
          bio: portfolio.bio,
          workPrice: portfolio.workPrice,
          skills: portfolio.skills,
          tags: portfolio.tags,
          category: portfolio.category,
          badgeType: portfolio.employeeId?.blueVerified?.status === true ? 'premium' : 'free',
          images: portfolio.images,
          videos: portfolio.videos,
          status: portfolio.status,
          isPublic: portfolio.isPublic,
          createdAt: portfolio.createdAt,
          updatedAt: portfolio.updatedAt,
          
          // Full Employee Details
          employee: portfolio.employeeId ? {
            id: portfolio.employeeId._id,
            userId: portfolio.employeeId.userId,
            
            // Personal Info
            fullName: portfolio.employeeId.fullName,
            email: portfolio.employeeId.email,
            phoneNumber: portfolio.employeeId.phoneNumber,
            dateOfBirth: portfolio.employeeId.dateOfBirth,
            gender: portfolio.employeeId.gender,
            
            // Profile
            profilePicture: portfolio.employeeId.profilePicture,
            bio: portfolio.employeeId.bio,
            
            // Location
            location: portfolio.employeeId.location,
            
            // Professional Info
            expertise: portfolio.employeeId.expertise,
            experience: portfolio.employeeId.experience,
            education: portfolio.employeeId.education,
            certifications: portfolio.employeeId.certifications,
            languages: portfolio.employeeId.languages,
            
            // Ratings & Reviews
            rating: portfolio.employeeId.rating,
            reviewCount: portfolio.employeeId.reviewCount,
            
            // Work Stats
            projectsCompleted: portfolio.employeeId.projectsCompleted,
            ongoingProjects: portfolio.employeeId.ongoingProjects,
            
            // Availability
            availability: portfolio.employeeId.availability,
            workingHours: portfolio.employeeId.workingHours,
            
            // Social Links
            socialLinks: portfolio.employeeId.socialLinks,
            
            // Subscription
            subscription: portfolio.employeeId.subscription,
            
            // Account Status
            isVerified: portfolio.employeeId.isVerified,
            isActive: portfolio.employeeId.isActive,


            // ADD AFTER IT ↓
badge: portfolio.employeeId.hasBadge ? {
  show:   true,
  type:   portfolio.employeeId.badgeType,
  label:  portfolio.employeeId.badgeLabel,
  icon:   portfolio.employeeId.badgeType === 'blue-verified' ? 'verified'     :
          portfolio.employeeId.badgeType === 'admin-verified' ? 'shield-check' : 'badge',
  color:  portfolio.employeeId.badgeType === 'blue-verified' ? '#0066FF'       :
          portfolio.employeeId.badgeType === 'admin-verified' ? '#00B37E'       : '#888',
  bg:     portfolio.employeeId.badgeType === 'blue-verified' ? '#EBF5FF'       :
          portfolio.employeeId.badgeType === 'admin-verified' ? '#E6FAF5'       : '#f0f0f0',
} : { show: false },
blueVerified: portfolio.employeeId.blueVerified?.status
  ? { status: true, icon: 'verified', color: '#0066FF', bg: '#EBF5FF', label: 'Premium Member' }
  : { status: false },
adminVerified: { status: portfolio.employeeId.adminVerified?.status ?? false },
tier: portfolio.employeeId.blueVerified?.status ? 'premium'
  : portfolio.employeeId.adminVerified?.status ? 'verified' : 'free',
            
            // Timestamps
            createdAt: portfolio.employeeId.createdAt,
            lastActive: portfolio.employeeId.lastActive
          } : null
        })),
        pagination: {
          currentPage: Number(page),
          totalPages: Math.ceil(total / Number(limit)),
          totalItems: total,
          itemsPerPage: Number(limit),
          hasNextPage: skip + portfolios.length < total,
          hasPrevPage: Number(page) > 1
        }
      }
    });

  } catch (error) {
    console.error('❌ Get all portfolios error:', error);
    return res.status(500).json({
      success: false,
      message: '❌ Failed to fetch portfolios',
      error: error.message
    });
  }
};

// ═══════════════════════════════════════════════════════════════
// 🔍 SEARCH PORTFOLIOS BY SKILLS & TAGS
// ═══════════════════════════════════════════════════════════════

export const searchPortfoliosBySkillsAndTags = async (req, res) => {
  try {
    const {
      skills,
      tags,
      category,
      badgeType,
       blueVerified,
       adminVerified,
      minPrice,
      maxPrice,
      currency = 'INR',
      page = 1,
      limit = 10,
      matchType = 'any' // 'any' or 'all'
    } = req.query;

    // Validate input
    if (!skills && !tags) {
      return res.status(400).json({
        success: false,
        message: '❌ Please provide at least skills or tags to search'
      });
    }

    // Build filter
    const filter = {
      status: 'published',
      isPublic: true
    };

    // Skills and Tags matching
    const matchConditions = [];

    if (skills) {
      const skillsArray = skills.split(',').map(s => s.trim());
      
      if (matchType === 'all') {
        filter.skills = { $all: skillsArray };
      } else {
        matchConditions.push({ skills: { $in: skillsArray } });
      }
    }

    if (tags) {
      const tagsArray = tags.split(',').map(t => t.trim());
      
      if (matchType === 'all') {
        filter.tags = { $all: tagsArray };
      } else {
        matchConditions.push({ tags: { $in: tagsArray } });
      }
    }

    // Combine skill and tag conditions
    if (matchConditions.length > 0) {
      if (matchType === 'any') {
        filter.$or = matchConditions;
      }
    }

    // Additional filters
    if (category) {
      const categories = category.split(',');
      filter.category = { $in: categories };
    }

    if (badgeType) {
      filter.badgeType = badgeType;
    }

    if (minPrice || maxPrice) {
      filter['workPrice.currency'] = currency;
      filter['workPrice.amount'] = {};
      
      if (minPrice) {
        filter['workPrice.amount'].$gte = Number(minPrice);
      }
      if (maxPrice) {
        filter['workPrice.amount'].$lte = Number(maxPrice);
      }
    }

    // Pagination
    const skip = (Number(page) - 1) * Number(limit);

    // Get portfolios with FULL employee details
    const portfolios = await Portfolio.find(filter)
      .populate({
        path: 'employeeId',
        select: '-password -verificationToken -resetPasswordToken -resetPasswordExpires'
      })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(Number(limit))
      .lean();

      // ✅ Post-populate filter
const filteredPortfolios = portfolios.filter(p => {
  if (blueVerified !== undefined) {
    const expected = blueVerified === 'true';
    if ((p.employeeId?.blueVerified?.status ?? false) !== expected) return false;
  }
  if (adminVerified !== undefined) {
    const expected = adminVerified === 'true';
    if ((p.employeeId?.adminVerified?.status ?? false) !== expected) return false;
  }
  return true;
});

    // Get total count
    const total = await Portfolio.countDocuments(filter);

    // Calculate match score for each portfolio
    const searchSkills = skills ? skills.split(',').map(s => s.trim().toLowerCase()) : [];
    const searchTags = tags ? tags.split(',').map(t => t.trim().toLowerCase()) : [];

    const portfoliosWithScore = filteredPortfolios.map(portfolio => {
      let matchScore = 0;
      let matchedSkills = [];
      let matchedTags = [];

      // Calculate skill matches
      if (searchSkills.length > 0) {
        matchedSkills = portfolio.skills.filter(skill => 
          searchSkills.some(s => skill.toLowerCase().includes(s))
        );
        matchScore += (matchedSkills.length / searchSkills.length) * 50;
      }

      // Calculate tag matches
      if (searchTags.length > 0) {
        matchedTags = portfolio.tags.filter(tag => 
          searchTags.some(t => tag.toLowerCase().includes(t))
        );
        matchScore += (matchedTags.length / searchTags.length) * 50;
      }

      return {
        // Portfolio Details
        id: portfolio._id,
        portfolioName: portfolio.portfolioName,
        bio: portfolio.bio,
        workPrice: portfolio.workPrice,
        skills: portfolio.skills,
        tags: portfolio.tags,
        category: portfolio.category,
        badgeType: portfolio.employeeId?.blueVerified?.status === true ? 'premium' : 'free',
        images: portfolio.images,
        videos: portfolio.videos,
        createdAt: portfolio.createdAt,
        
        // Match Info
        matchScore: Math.round(matchScore),
        matchedSkills,
        matchedTags,
        
        // Full Employee Details
        employee: portfolio.employeeId ? {
          id: portfolio.employeeId._id,
          userId: portfolio.employeeId.userId,
          
          // Personal Info
          fullName: portfolio.employeeId.fullName,
          email: portfolio.employeeId.email,
          phoneNumber: portfolio.employeeId.phoneNumber,
          dateOfBirth: portfolio.employeeId.dateOfBirth,
          gender: portfolio.employeeId.gender,
          
          // Profile
          profilePicture: portfolio.employeeId.profilePicture,
          bio: portfolio.employeeId.bio,
          
          // Location
          location: portfolio.employeeId.location,
          
          // Professional Info
          expertise: portfolio.employeeId.expertise,
          experience: portfolio.employeeId.experience,
          education: portfolio.employeeId.education,
          certifications: portfolio.employeeId.certifications,
          languages: portfolio.employeeId.languages,
          
          // Ratings & Reviews
          rating: portfolio.employeeId.rating,
          reviewCount: portfolio.employeeId.reviewCount,
          
          // Work Stats
          projectsCompleted: portfolio.employeeId.projectsCompleted,
          ongoingProjects: portfolio.employeeId.ongoingProjects,
          
          // Availability
          availability: portfolio.employeeId.availability,
          workingHours: portfolio.employeeId.workingHours,
          
          // Social Links
          socialLinks: portfolio.employeeId.socialLinks,
          
          // Subscription
          subscription: portfolio.employeeId.subscription,
          
          // Account Status
          isVerified: portfolio.employeeId.isVerified,

          isActive: portfolio.employeeId.isActive,

          // ADD AFTER IT ↓
badge: portfolio.employeeId.hasBadge ? {
  show:   true,
  type:   portfolio.employeeId.badgeType,
  label:  portfolio.employeeId.badgeLabel,
  icon:   portfolio.employeeId.badgeType === 'blue-verified' ? 'verified'     :
          portfolio.employeeId.badgeType === 'admin-verified' ? 'shield-check' : 'badge',
  color:  portfolio.employeeId.badgeType === 'blue-verified' ? '#0066FF'       :
          portfolio.employeeId.badgeType === 'admin-verified' ? '#00B37E'       : '#888',
  bg:     portfolio.employeeId.badgeType === 'blue-verified' ? '#EBF5FF'       :
          portfolio.employeeId.badgeType === 'admin-verified' ? '#E6FAF5'       : '#f0f0f0',
} : { show: false },
blueVerified: portfolio.employeeId.blueVerified?.status
  ? { status: true, icon: 'verified', color: '#0066FF', bg: '#EBF5FF', label: 'Premium Member' }
  : { status: false },
adminVerified: { status: portfolio.employeeId.adminVerified?.status ?? false },
tier: portfolio.employeeId.blueVerified?.status ? 'premium'
  : portfolio.employeeId.adminVerified?.status ? 'verified' : 'free',

          
          // Timestamps
          createdAt: portfolio.employeeId.createdAt,
          lastActive: portfolio.employeeId.lastActive
        } : null
      };
    });

    // Sort by match score
    portfoliosWithScore.sort((a, b) => b.matchScore - a.matchScore);

    return res.status(200).json({
      success: true,
      message: '✅ Portfolios found successfully',
      searchCriteria: {
        skills: searchSkills,
        tags: searchTags,
        matchType
      },
      data: {
        portfolios: portfoliosWithScore,
        pagination: {
          currentPage: Number(page),
          totalPages: Math.ceil(total / Number(limit)),
          totalItems: total,
          itemsPerPage: Number(limit),
          hasNextPage: skip + portfolios.length < total,
          hasPrevPage: Number(page) > 1
        }
      }
    });

  } catch (error) {
    console.error('❌ Search portfolios error:', error);
    return res.status(500).json({
      success: false,
      message: '❌ Failed to search portfolios',
      error: error.message
    });
  }
};

// ═══════════════════════════════════════════════════════════════
// 📄 GET SINGLE PORTFOLIO BY ID
// ═══════════════════════════════════════════════════════════════

export const getPortfolioById = async (req, res) => {
  try {
    const { portfolioId } = req.params;

    const portfolio = await Portfolio.findOne({
      _id: portfolioId,
      status: 'published',
      isPublic: true
    })
    .populate({
      path: 'employeeId',
      select: '-password -verificationToken -resetPasswordToken -resetPasswordExpires'
    })
    .lean();

    if (!portfolio) {
      return res.status(404).json({
        success: false,
        message: '❌ Portfolio not found'
      });
    }

    return res.status(200).json({
      success: true,
      message: '✅ Portfolio fetched successfully',
      portfolio: {
        // Portfolio Details
        id: portfolio._id,
        portfolioName: portfolio.portfolioName,
        bio: portfolio.bio,
        workPrice: portfolio.workPrice,
        skills: portfolio.skills,
        tags: portfolio.tags,
        category: portfolio.category,
        badgeType: portfolio.employeeId?.blueVerified?.status === true ? 'premium' : 'free',
        images: portfolio.images,
        videos: portfolio.videos,
        status: portfolio.status,
        isPublic: portfolio.isPublic,
        createdAt: portfolio.createdAt,
        updatedAt: portfolio.updatedAt,
        
        // Full Employee Details
        employee: portfolio.employeeId ? {
          id: portfolio.employeeId._id,
          userId: portfolio.employeeId.userId,
          
          // Personal Info
          fullName: portfolio.employeeId.fullName,
          email: portfolio.employeeId.email,
          phoneNumber: portfolio.employeeId.phoneNumber,
          dateOfBirth: portfolio.employeeId.dateOfBirth,
          gender: portfolio.employeeId.gender,
          
          // Profile
          profilePicture: portfolio.employeeId.profilePicture,
          bio: portfolio.employeeId.bio,
          
          // Location
          location: portfolio.employeeId.location,
          
          // Professional Info
          expertise: portfolio.employeeId.expertise,
          experience: portfolio.employeeId.experience,
          education: portfolio.employeeId.education,
          certifications: portfolio.employeeId.certifications,
          languages: portfolio.employeeId.languages,
          
          // Ratings & Reviews
          rating: portfolio.employeeId.rating,
          reviewCount: portfolio.employeeId.reviewCount,
          
          // Work Stats
          projectsCompleted: portfolio.employeeId.projectsCompleted,
          ongoingProjects: portfolio.employeeId.ongoingProjects,
          
          // Availability
          availability: portfolio.employeeId.availability,
          workingHours: portfolio.employeeId.workingHours,
          
          // Social Links
          socialLinks: portfolio.employeeId.socialLinks,
          
          // Subscription
          subscription: portfolio.employeeId.subscription,
          
          // Account Status
          isVerified: portfolio.employeeId.isVerified,

          isActive: portfolio.employeeId.isActive,

          // ADD AFTER IT ↓
badge: portfolio.employeeId.hasBadge ? {
  show:   true,
  type:   portfolio.employeeId.badgeType,
  label:  portfolio.employeeId.badgeLabel,
 icon: portfolio.employeeId.badgeType === 'blue-verified' ? 'check-decagram' :
          portfolio.employeeId.badgeType === 'admin-verified' ? 'shield-check' : 'badge',
  color:  portfolio.employeeId.badgeType === 'blue-verified' ? '#0066FF'       :
          portfolio.employeeId.badgeType === 'admin-verified' ? '#00B37E'       : '#888',
  bg:     portfolio.employeeId.badgeType === 'blue-verified' ? '#EBF5FF'       :
          portfolio.employeeId.badgeType === 'admin-verified' ? '#E6FAF5'       : '#f0f0f0',
} : { show: false },
blueVerified: portfolio.employeeId.blueVerified?.status
  ? { status: true, icon: 'verified', color: '#0066FF', bg: '#EBF5FF', label: 'Premium Member' }
  : { status: false },
adminVerified: { status: portfolio.employeeId.adminVerified?.status ?? false },
tier: portfolio.employeeId.blueVerified?.status ? 'premium'
  : portfolio.employeeId.adminVerified?.status ? 'verified' : 'free',

          
          // Timestamps
          createdAt: portfolio.employeeId.createdAt,
          lastActive: portfolio.employeeId.lastActive
        } : null
      }
    });

  } catch (error) {
    console.error('❌ Get portfolio error:', error);
    return res.status(500).json({
      success: false,
      message: '❌ Failed to fetch portfolio',
      error: error.message
    });
  }
};