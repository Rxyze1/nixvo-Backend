// Controllers/Employee/portfolioController.js

import Portfolio from '../../../Models/USER-Auth/Employee/PortfolioModel.js';
import Employee from '../../../Models/USER-Auth/Employee-Model.js';
import ImageValidator from '../../../Service/Security/ImageValidator.js';
import validationService from '../../../Service/validationService.js';
import { uploadToR2 } from '../../../Config/r2Config.js';

const imageValidator = new ImageValidator();

// ═══════════════════════════════════════════════════════════════
// ✅ CREATE PORTFOLIO (Images + Videos)
// ═══════════════════════════════════════════════════════════════

export const createPortfolio = async (req, res) => {
  try {
    const userId = req.userId;
    
    const employee = await Employee.findOne({ userId });
    if (!employee) {
      return res.status(404).json({
        success: false,
        message: '❌ Employee profile not found'
      });
    }
    
    // ✅ CHECK IF PORTFOLIO ALREADY EXISTS
    const existingPortfolio = await Portfolio.findOne({ userId });
    if (existingPortfolio) {
      return res.status(400).json({
        success: false,
        message: '❌ Portfolio already exists. Use update endpoint to modify it.',
        portfolioId: existingPortfolio._id,
        updateEndpoint: `/api/v1/employee/portfolio/${existingPortfolio._id}`
      });
    }
    
    const badgeType = employee.blueVerified?.status === true ? 'premium' : 'free';
    const maxImages = badgeType === 'premium' ? 24 : 6;
    const maxVideos = badgeType === 'premium' ? 20 : 4;
    
    // ✅ HANDLE BOTH JSON AND FORM-DATA
    let portfolioData;
    
    // Check if it's form-data with 'data' field
    if (req.body.data) {
      try {
        portfolioData = JSON.parse(req.body.data);
      } catch (parseError) {
        return res.status(400).json({
          success: false,
          message: '❌ Invalid JSON in data field'
        });
      }
    } 
    // Check if it's direct JSON
    else if (req.is('application/json')) {
      portfolioData = req.body;
    }
    // Check if form-data fields are directly in body
    else {
      portfolioData = req.body;
    }
    
    const {
      portfolioName,
      bio,
      workPrice,
      currency = 'INR',
      skills = [],
      tags = [],
      category = []
    } = portfolioData;
    
    // Validate required fields
    if (!portfolioName || !bio || !workPrice) {
      return res.status(400).json({
        success: false,
        message: '❌ Missing required fields: portfolioName, bio, workPrice'
      });
    }
    
    if (portfolioName.length < 3 || portfolioName.length > 100) {
      return res.status(400).json({
        success: false,
        message: '❌ Portfolio name must be 3-100 characters'
      });
    }
    
    if (bio.length < 20 || bio.length > 1000) {
      return res.status(400).json({
        success: false,
        message: '❌ Bio must be 20-1000 characters'
      });
    }
    
    const numericPrice = Number(workPrice);
    if (isNaN(numericPrice) || numericPrice <= 0) {
      return res.status(400).json({
        success: false,
        message: '❌ Work price must be a positive number'
      });
    }
    
    const validCurrencies = ['INR', 'USD', 'EUR', 'GBP', 'CAD', 'AUD'];
    if (!validCurrencies.includes(currency)) {
      return res.status(400).json({
        success: false,
        message: '❌ Invalid currency',
        validOptions: validCurrencies
      });
    }
    
    if (tags.length > 10) {
      return res.status(400).json({
        success: false,
        message: '❌ Maximum 10 tags allowed'
      });
    }
    
    const validCategories = [
      'videoEditors', 'audioEditors', 'thumbnailArtists', 'blenderArtists',
      'AiArtists', 'VfxArtists', '3dVideoArtists', 'longEditors',
      'ShortEditors', 'scriptWriters', 'videoEditorsAndAudioEditors', 'all'
    ];
    
    const invalidCategories = category.filter(cat => !validCategories.includes(cat));
    if (invalidCategories.length > 0) {
      return res.status(400).json({
        success: false,
        message: '❌ Invalid categories found',
        invalidCategories,
        validCategories
      });
    }
    
    const imageFiles = req.files?.images || [];
    const videoFiles = req.files?.videos || [];
    
    if (imageFiles.length > maxImages) {
      return res.status(400).json({
        success: false,
        message: `❌ ${badgeType} users can upload max ${maxImages} images`,
        received: imageFiles.length,
        limit: maxImages
      });
    }
    
    if (videoFiles.length > maxVideos) {
      return res.status(400).json({
        success: false,
        message: `❌ ${badgeType} users can upload max ${maxVideos} videos`,
        received: videoFiles.length,
        limit: maxVideos
      });
    }
    
    // Validate portfolio name
    const nameValidation = await validationService.validateContent(portfolioName, 'title');
    if (nameValidation.action === 'BLOCK' || nameValidation.blocked) {
      return res.status(400).json({
        success: false,
        message: '🚫 Portfolio name contains prohibited content',
        violations: nameValidation.violations
      });
    }
    
    // Validate bio
    const bioValidation = await validationService.validateBio(bio);
    if (bioValidation.action === 'BLOCK' || bioValidation.blocked) {
      return res.status(400).json({
        success: false,
        message: '🚫 Bio contains prohibited content',
        violations: bioValidation.violations
      });
    }
    
    // Validate skills
    for (const skill of skills) {
      const skillValidation = await validationService.validateContent(skill, 'skill');
      if (skillValidation.action === 'BLOCK' || skillValidation.blocked) {
        return res.status(400).json({
          success: false,
          message: `🚫 Skill "${skill}" contains prohibited content`
        });
      }
    }
    
    // Validate tags
    for (const tag of tags) {
      const tagValidation = await validationService.validateContent(tag, 'tag');
      if (tagValidation.action === 'BLOCK' || tagValidation.blocked) {
        return res.status(400).json({
          success: false,
          message: `🚫 Tag "${tag}" contains prohibited content`
        });
      }
    }
    
    // Validate and upload images
    const uploadedImages = [];
    
    if (imageFiles.length > 0) {
      for (const file of imageFiles) {
        const validation = await imageValidator.validate(file.buffer, {
          testMode: false,
          isProfilePic: false,
          filename: file.originalname
        });
        
        if (validation.action === 'BLOCK' || validation.blocked) {
          return res.status(400).json({
            success: false,
            message: `🚫 Image "${file.originalname}" rejected`,
            reason: validation.reason,
            violations: validation.violations
          });
        }
        
        const timestamp = Date.now();
        const fileName = `portfolios/${userId}/${timestamp}-${file.originalname}`;
        const url = await uploadToR2(file.buffer, fileName, file.mimetype);
        
        uploadedImages.push({
          url,
          filename: file.originalname,
          filesize: file.size,
          mimetype: file.mimetype,
          uploadedAt: new Date(),
          validation: {
            status: 'approved',
            scannedAt: new Date(),
            confidence: validation.confidence
          }
        });
      }
    }
    
    // Upload videos
    const uploadedVideos = [];
    
    if (videoFiles.length > 0) {
      for (const file of videoFiles) {
        if (file.size > 400 * 1024 * 1024) {
          return res.status(400).json({
            success: false,
            message: `❌ Video "${file.originalname}" exceeds 400MB limit`,
            filesize: `${(file.size / (1024 * 1024)).toFixed(2)}MB`
          });
        }
        
        const timestamp = Date.now();
        const fileName = `portfolios/${userId}/videos/${timestamp}-${file.originalname}`;
        const url = await uploadToR2(file.buffer, fileName, file.mimetype);
        
        uploadedVideos.push({
          url,
          filename: file.originalname,
          filesize: file.size,
          mimetype: file.mimetype,
          uploadedAt: new Date(),
          validation: {
            status: 'pending',
            scannedAt: new Date()
          }
        });
      }
    }
    
    const portfolio = new Portfolio({
      employeeId: employee._id,
      userId,
      portfolioName,
      bio,
      workPrice: {
        amount: numericPrice,
        currency
      },
      skills,
      tags,
      category,
      badgeType,
      images: uploadedImages,
      videos: uploadedVideos,
      status: 'published',
      isPublic: true
    });
    
    await portfolio.save();
    
    return res.status(201).json({
      success: true,
      message: '✅ Portfolio created successfully',
      portfolio: {
        id: portfolio._id,
        portfolioName: portfolio.portfolioName,
        bio: portfolio.bio,
        workPrice: portfolio.workPrice,
        skills: portfolio.skills,
        tags: portfolio.tags,
        category: portfolio.category,
        badgeType: portfolio.badgeType,
        images: portfolio.images,
        videos: portfolio.videos,
        uploadLimits: {
          images: {
            current: portfolio.images.length,
            max: maxImages,
            remaining: maxImages - portfolio.images.length
          },
          videos: {
            current: portfolio.videos.length,
            max: maxVideos,
            remaining: maxVideos - portfolio.videos.length
          }
        },
        status: portfolio.status,
        createdAt: portfolio.createdAt
      }
    });
    
  } catch (error) {
    console.error('❌ Portfolio creation error:', error);
    
    if (error.name === 'ValidationError') {
      return res.status(400).json({
        success: false,
        message: '❌ Validation error',
        details: Object.values(error.errors).map(e => e.message)
      });
    }
    
    return res.status(500).json({
      success: false,
      message: '❌ Failed to create portfolio',
      error: error.message
    });
  }
};

// ═══════════════════════════════════════════════════════════════
// ✅ GET MY PORTFOLIOS
// ═══════════════════════════════════════════════════════════════

export const getMyPortfolios = async (req, res) => {
  try {
    const userId = req.userId;
    
    const portfolios = await Portfolio.find({ userId })
      .sort({ createdAt: -1 })
      .lean();
    
    return res.json({
      success: true,
      count: portfolios.length,
      portfolios
    });
    
  } catch (error) {
    console.error('❌ Get portfolios error:', error);
    return res.status(500).json({
      success: false,
      message: '❌ Failed to fetch portfolios'
    });
  }
};

// ═══════════════════════════════════════════════════════════════
// ✅ GET PORTFOLIO BY ID
// ═══════════════════════════════════════════════════════════════

export const getPortfolioById = async (req, res) => {
  try {
    const { portfolioId } = req.params;
    const userId = req.userId;
    
    const portfolio = await Portfolio.findOne({
      _id: portfolioId,
      userId
    }).lean();
    
    if (!portfolio) {
      return res.status(404).json({
        success: false,
        message: '❌ Portfolio not found'
      });
    }
    
    return res.json({
      success: true,
      portfolio
    });
    
  } catch (error) {
    console.error('❌ Get portfolio error:', error);
    return res.status(500).json({
      success: false,
      message: '❌ Failed to fetch portfolio'
    });
  }
};

// ═══════════════════════════════════════════════════════════════
// ✅ UPDATE PORTFOLIO (Text + Add/Remove Images/Videos)
// ═══════════════════════════════════════════════════════════════

export const updatePortfolio = async (req, res) => {
  try {
    const userId = req.userId;
    
    // 1. Find Portfolio
    const portfolio = await Portfolio.findOne({ userId });
    if (!portfolio) {
      return res.status(404).json({
        success: false,
        message: '❌ Portfolio not found. Create one first.',
        createEndpoint: '/api/v1/employee/portfolio/create'
      });
    }
    
    // 2. Get Limits (Do NOT set portfolio.badgeType manually)
    const employee = await Employee.findOne({ userId }).select('blueVerified').lean();
    const badgeType = employee?.blueVerified?.status === true ? 'premium' : 'free';
    const maxImages = 10; 
    const maxVideos = 5;
    const maxVideoSize = 100 * 1024 * 1024;

    // 3. Parse Data safely
    let portfolioData = {};
    if (req.body && req.body.data) {
      try {
        portfolioData = JSON.parse(req.body.data);
      } catch (parseError) {
        return res.status(400).json({ success: false, message: '❌ Invalid JSON in data field', error: parseError.message });
      }
    } else if (req.body && Object.keys(req.body).length > 0) {
      portfolioData = req.body;
    }
    
    // 4. Check if empty request
    const hasFiles = req.files && ((req.files.images?.length > 0) || (req.files.videos?.length > 0));
    const hasData = Object.keys(portfolioData).length > 0;
    if (!hasData && !hasFiles) {
      return res.status(400).json({ success: false, message: '❌ No data provided to update' });
    }
    
    // ═══════════════════════════════════════════════════════════════
    // 5. TEXT VALIDATION & UPDATING (THIS WAS MISSING!)
    // ═══════════════════════════════════════════════════════════════
    
    if (portfolioData.portfolioName) {
      if (portfolioData.portfolioName.length < 3 || portfolioData.portfolioName.length > 100) {
        return res.status(400).json({ success: false, message: '❌ Portfolio name must be 3-100 characters' });
      }
      const nameValidation = await validationService.validateContent(portfolioData.portfolioName, 'title');
      if (nameValidation.action === 'BLOCK' || nameValidation.blocked) {
        return res.status(400).json({ success: false, message: '🚫 Portfolio name contains prohibited content' });
      }
      portfolio.portfolioName = portfolioData.portfolioName;
    }
    
    if (portfolioData.bio) {
      if (portfolioData.bio.length < 20 || portfolioData.bio.length > 1000) {
        return res.status(400).json({ success: false, message: '❌ Bio must be 20-1000 characters' });
      }
      const bioValidation = await validationService.validateBio(portfolioData.bio);
      if (bioValidation.action === 'BLOCK' || bioValidation.blocked) {
        return res.status(400).json({ success: false, message: '🚫 Bio contains prohibited content' });
      }
      portfolio.bio = portfolioData.bio;
    }
    
    if (portfolioData.workPrice) {
      const numericPrice = Number(portfolioData.workPrice);
      if (isNaN(numericPrice) || numericPrice <= 0) {
        return res.status(400).json({ success: false, message: '❌ Work price must be a positive number' });
      }
      portfolio.workPrice.amount = numericPrice;
    }
    
    if (portfolioData.currency) {
      const validCurrencies = ['INR', 'USD', 'EUR', 'GBP', 'CAD', 'AUD'];
      if (!validCurrencies.includes(portfolioData.currency)) {
        return res.status(400).json({ success: false, message: '❌ Invalid currency' });
      }
      portfolio.workPrice.currency = portfolioData.currency;
    }
    
    if (portfolioData.skills) {
      const skillsArray = Array.isArray(portfolioData.skills) ? portfolioData.skills : JSON.parse(portfolioData.skills);
      for (const skill of skillsArray) {
        const skillValidation = await validationService.validateContent(skill, 'skill');
        if (skillValidation.action === 'BLOCK' || skillValidation.blocked) {
          return res.status(400).json({ success: false, message: `🚫 Skill "${skill}" contains prohibited content` });
        }
      }
      portfolio.skills = skillsArray;
    }
    
    if (portfolioData.tags) {
      const tagsArray = Array.isArray(portfolioData.tags) ? portfolioData.tags : JSON.parse(portfolioData.tags);
      if (tagsArray.length > 10) return res.status(400).json({ success: false, message: '❌ Maximum 10 tags allowed' });
      for (const tag of tagsArray) {
        const tagValidation = await validationService.validateContent(tag, 'tag');
        if (tagValidation.action === 'BLOCK' || tagValidation.blocked) {
          return res.status(400).json({ success: false, message: `🚫 Tag "${tag}" contains prohibited content` });
        }
      }
      portfolio.tags = tagsArray;
    }
    
     if (portfolioData.category) {
      try {
        // ✅ Super safe parsing: handles Array, Stringified Array, and unexpected formats
        let categoryArray = portfolioData.category;
        if (typeof categoryArray === 'string') {
          categoryArray = JSON.parse(categoryArray);
        }
        
        // Ensure it's actually an array after parsing
        if (!Array.isArray(categoryArray)) {
          return res.status(400).json({ 
            success: false, 
            message: '❌ Category must be an array', 
            received: typeof categoryArray 
          });
        }

        const validCategories = ['videoEditors', 'audioEditors', 'thumbnailArtists', 'blenderArtists', 'AiArtists', 'VfxArtists', '3dVideoArtists', 'longEditors', 'ShortEditors', 'scriptWriters', 'videoEditorsAndAudioEditors', 'all'];
        
        const invalidCategories = categoryArray.filter(cat => !validCategories.includes(cat));
        if (invalidCategories.length > 0) {
          return res.status(400).json({ 
            success: false, 
            message: '❌ Invalid categories found', 
            invalidCategories,
            validOptions: validCategories
          });
        }
        
        portfolio.category = categoryArray;
      } catch (parseError) {
        return res.status(400).json({ 
          success: false, 
          message: '❌ Failed to read categories. Make sure you are sending a valid JSON array.', 
          error: parseError.message 
        });
      }
    }

    // ═══════════════════════════════════════════════════════════════
    // 6. FILE UPLOADS
    // ═══════════════════════════════════════════════════════════════
    
    const newImageFiles = req.files?.images || [];
    if (newImageFiles.length > 0) {
      const totalAfterAdd = portfolio.images.length + newImageFiles.length;
      if (totalAfterAdd > maxImages) {
        return res.status(400).json({ success: false, message: `❌ Image limit reached. Current: ${portfolio.images.length}, Max: ${maxImages}` });
      }
      for (const file of newImageFiles) {
        const validation = await imageValidator.validate(file.buffer, { testMode: false, isProfilePic: false, filename: file.originalname });
        if (validation.action === 'BLOCK' || validation.blocked) {
          return res.status(400).json({ success: false, message: `🚫 Image "${file.originalname}" rejected` });
        }
        const fileName = `portfolios/${userId}/${Date.now()}-${file.originalname}`;
        const url = await uploadToR2(file.buffer, fileName, file.mimetype);
        portfolio.images.push({ url, filename: file.originalname, filesize: file.size, mimetype: file.mimetype, uploadedAt: new Date(), validation: { status: 'approved', scannedAt: new Date(), confidence: validation.confidence } });
      }
    }
    
    const newVideoFiles = req.files?.videos || [];
    if (newVideoFiles.length > 0) {
      const totalAfterAdd = portfolio.videos.length + newVideoFiles.length;
      if (totalAfterAdd > maxVideos) {
        return res.status(400).json({ success: false, message: `❌ Video limit reached. Current: ${portfolio.videos.length}, Max: ${maxVideos}` });
      }
      for (const file of newVideoFiles) {
        if (file.size > maxVideoSize) {
          return res.status(400).json({ success: false, message: `❌ Video "${file.originalname}" exceeds 100MB limit` });
        }
        const fileName = `portfolios/${userId}/videos/${Date.now()}-${file.originalname}`;
        const url = await uploadToR2(file.buffer, fileName, file.mimetype);
        portfolio.videos.push({ url, filename: file.originalname, filesize: file.size, mimetype: file.mimetype, uploadedAt: new Date(), validation: { status: 'pending', scannedAt: new Date() } });
      }
    }
    
    // ═══════════════════════════════════════════════════════════════
    // 7. REMOVING MEDIA
    // ═══════════════════════════════════════════════════════════════
    
    if (portfolioData.imageIdsToRemove) {
      const idsToRemove = Array.isArray(portfolioData.imageIdsToRemove) ? portfolioData.imageIdsToRemove : JSON.parse(portfolioData.imageIdsToRemove);
      portfolio.images = portfolio.images.filter(img => !idsToRemove.includes(img._id.toString()));
    }
    
    if (portfolioData.videoIdsToRemove) {
      const idsToRemove = Array.isArray(portfolioData.videoIdsToRemove) ? portfolioData.videoIdsToRemove : JSON.parse(portfolioData.videoIdsToRemove);
      portfolio.videos = portfolio.videos.filter(vid => !idsToRemove.includes(vid._id.toString()));
    }
    
    // ═══════════════════════════════════════════════════════════════
    // 8. FORCE SAVE & RETURN
    // ═══════════════════════════════════════════════════════════════
    
    // markModified forces Mongoose to recognize array changes
    portfolio.markModified('skills');
    portfolio.markModified('tags');
    portfolio.markModified('category');
    portfolio.markModified('images');
    portfolio.markModified('videos');
    
    await portfolio.save();
    
    return res.status(200).json({
      success: true,
      message: '✅ Portfolio updated successfully',
      portfolio: {
        id: portfolio._id,
        portfolioName: portfolio.portfolioName,
        bio: portfolio.bio,
        workPrice: portfolio.workPrice,
        skills: portfolio.skills,
        tags: portfolio.tags,
        category: portfolio.category,
        badgeType: portfolio.badgeType,
        images: portfolio.images,
        videos: portfolio.videos,
        uploadLimits: {
          images: { current: portfolio.images.length, max: maxImages, remaining: maxImages - portfolio.images.length },
          videos: { current: portfolio.videos.length, max: maxVideos, remaining: maxVideos - portfolio.videos.length }
        },
        updatedAt: portfolio.updatedAt
      }
    });
    
  } catch (error) {
    console.error('❌ Update portfolio error:', error);
    
    if (error.name === 'ValidationError') {
      return res.status(400).json({
        success: false,
        message: '❌ Database Validation Error',
        details: Object.values(error.errors).map(e => e.message)
      });
    }
    
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({ success: false, message: '❌ Unauthorized - Invalid Token' });
    }

    return res.status(500).json({
      success: false,
      message: '❌ Internal Server Error while updating portfolio',
      error: error.message
    });
  }
};
// ═══════════════════════════════════════════════════════════════
// ✅ EXPORTS
// ═══════════════════════════════════════════════════════════════