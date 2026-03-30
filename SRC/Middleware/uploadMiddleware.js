// middlewares/uploadMiddleware.js

import multer from 'multer';

// ═══════════════════════════════════════════════════════════════
// STORAGE CONFIGURATION
// ═══════════════════════════════════════════════════════════════

const storage = multer.memoryStorage();

// ═══════════════════════════════════════════════════════════════
// FILE FILTERS
// ═══════════════════════════════════════════════════════════════

// Images only (for profiles, thumbnails, etc.)
const imageFilter = (req, file, cb) => {
  const allowedMimes = ['image/jpeg', 'image/png', 'image/webp'];

  if (allowedMimes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('❌ Only JPEG, PNG, WebP images allowed'));
  }
};

// Images + Videos (for portfolios, job posts)
const mediaFilter = (req, file, cb) => {
  const allowedMimes = [
    'image/jpeg',
    'image/png',
    'image/webp',
    'video/mp4',
    'video/quicktime',
    'video/x-msvideo',
    'video/webm',
  ];

  if (allowedMimes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('❌ Only JPEG, PNG, WebP, MP4, MOV, AVI, WebM allowed'));
  }
};

// ═══════════════════════════════════════════════════════════════
// MIDDLEWARE 1: CLIENT PROFILE (2 specific image fields)
// ═══════════════════════════════════════════════════════════════

export const uploadClientProfile = multer({
  storage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB per file
    files: 2, // Max 2 files total
  },
  fileFilter: imageFilter,
}).fields([
  { name: 'profilePic', maxCount: 1 },
  { name: 'profileBannerImage', maxCount: 1 },
]);

// ═══════════════════════════════════════════════════════════════
// MIDDLEWARE 2: EMPLOYEE PROFILE (2 specific image fields)
// ═══════════════════════════════════════════════════════════════

export const uploadEmployeeProfile = multer({
  storage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB per file
    files: 2, // Max 2 files total
  },
  fileFilter: imageFilter,
}).fields([
  { name: 'profilePic', maxCount: 1 },
  { name: 'profileBannerImage', maxCount: 1 },
]);

// ═══════════════════════════════════════════════════════════════
// MIDDLEWARE 3: PORTFOLIO (Multiple images + videos)
// ═══════════════════════════════════════════════════════════════

export const uploadPortfolio = multer({
  storage,
  limits: {
    fileSize: 100 * 1024 * 1024, // 100MB per file (for videos)
    files: 15, // Max 15 files
  },
  fileFilter: mediaFilter,
}).fields([
  { name: 'images', maxCount: 10 },
  { name: 'videos', maxCount: 5 },
]);

// ═══════════════════════════════════════════════════════════════
// MIDDLEWARE 4: JOB POST (Multiple images + videos)
// ═══════════════════════════════════════════════════════════════

export const uploadJobPost = multer({
  storage,
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB per file
    files: 10, // Max 10 files
  },
  fileFilter: mediaFilter,
}).fields([
  { name: 'uploadImages', maxCount: 10 },
  { name: 'uploadVideos', maxCount: 5 },
]);

// ═══════════════════════════════════════════════════════════════
// MIDDLEWARE 5: GENERIC MEDIA (Any field name)
// ═══════════════════════════════════════════════════════════════

export const uploadGenericMedia = multer({
  storage,
  limits: {
    fileSize: 100 * 1024 * 1024, // 100MB per file
    files: 20, // Max 20 files
  },
  fileFilter: mediaFilter,
}).any(); // ⚠️ Use with caution (accepts any field name)

// ═══════════════════════════════════════════════════════════════
// MIDDLEWARE 6: SINGLE FILE (Generic)
// ═══════════════════════════════════════════════════════════════

export const uploadSingleImage = (fieldName = 'image') => {
  return multer({
    storage,
    limits: {
      fileSize: 10 * 1024 * 1024, // 10MB
    },
    fileFilter: imageFilter,
  }).single(fieldName);
};

export const uploadSingleVideo = (fieldName = 'video') => {
  return multer({
    storage,
    limits: {
      fileSize: 100 * 1024 * 1024, // 100MB
    },
    fileFilter: mediaFilter,
  }).single(fieldName);
};


// Add this to Middlewares/uploadMiddleware.js

// ═══════════════════════════════════════════════════════════════
// ✅ MIDDLEWARE 9: JOB MEDIA (3 Images + 2 Videos, 26MB each)
// ═══════════════════════════════════════════════════════════════

export const uploadJobMedia = multer({
  storage,
  limits: {
    fileSize: 26 * 1024 * 1024, // ✅ 26MB max per file
    files: 5                     // ✅ Max 5 files total (3 images + 2 videos)
  },
  fileFilter: mediaFilter,
}).fields([
  { name: 'images', maxCount: 3 },  // ✅ Max 3 images
  { name: 'videos', maxCount: 2 }   // ✅ Max 2 videos
]);

// ═══════════════════════════════════════════════════════════════
// ✅ NEW: MIDDLEWARE 7: MULTIPLE IMAGES (Array of images)
// ═══════════════════════════════════════════════════════════════

export const uploadMultipleImages = (fieldName = 'images', maxCount = 5) => {
  return multer({
    storage,
    limits: {
      fileSize: 10 * 1024 * 1024, // 10MB per image
      files: maxCount, // Max number of images
    },
    fileFilter: imageFilter,
  }).array(fieldName, maxCount);
};

// ═══════════════════════════════════════════════════════════════
// ✅ NEW: MIDDLEWARE 8: TEST VALIDATION (Flexible - 1 or multiple)
// ═══════════════════════════════════════════════════════════════

export const uploadTestImages = multer({
  storage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB per image
    files: 5, // Max 5 images
  },
  fileFilter: imageFilter,
}).fields([
  { name: 'image', maxCount: 1 },   // Single image (backward compatible)
  { name: 'images', maxCount: 5 },  // Multiple images
]);


// Add this to Middlewares/uploadMiddleware.js

// ═══════════════════════════════════════════════════════════════
// ✅ MIDDLEWARE 10: JOB APPLICATION RESUME (PDF/DOC/Image)
// ═══════════════════════════════════════════════════════════════

const resumeFilter = (req, file, cb) => {
  const allowedMimes = [
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'image/jpeg',
    'image/jpg',
    'image/png'
  ];

  if (allowedMimes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('❌ Only PDF, DOC, DOCX, JPG, PNG files allowed for resume'));
  }
};

export const uploadJobApplication = multer({
  storage,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB max
    files: 1 // Only 1 resume file
  },
  fileFilter: resumeFilter,
}).fields([
  { name: 'resume', maxCount: 1 }
]);

// ═══════════════════════════════════════════════════════════════
// ERROR HANDLER (Use for all upload routes)
// ═══════════════════════════════════════════════════════════════

export const handleUploadError = (err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({
        success: false,
        message: '❌ File too large',
        details: err.message,
      });
    }
    if (err.code === 'LIMIT_FILE_COUNT') {
      return res.status(400).json({
        success: false,
        message: '❌ Too many files',
        details: err.message,
      });
    }
    if (err.code === 'LIMIT_UNEXPECTED_FILE') {
      return res.status(400).json({
        success: false,
        message: '❌ Unexpected field name',
        details: err.field,
      });
    }
    
    return res.status(400).json({
      success: false,
      message: '❌ Upload error',
      details: err.message,
    });
  }

  if (err) {
    return res.status(400).json({
      success: false,
      message: err.message || '❌ File upload failed',
    });
  }

  next();
};

// ═══════════════════════════════════════════════════════════════
// HELPER: Check if file is image
// ═══════════════════════════════════════════════════════════════

export const isImage = (mimetype) => {
  return ['image/jpeg', 'image/png', 'image/webp'].includes(mimetype);
};

// ═══════════════════════════════════════════════════════════════
// HELPER: Check if file is video
// ═══════════════════════════════════════════════════════════════

export const isVideo = (mimetype) => {
  return [
    'video/mp4',
    'video/quicktime',
    'video/x-msvideo',
    'video/webm',
  ].includes(mimetype);
};