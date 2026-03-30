// Controllers/jobController.js

import Job from '../../../Models/USER-Auth/Client/Job.js';
import Client from '../../../Models/USER-Auth/Client-Model.js';
import ImageValidator from '../../../Service/Security/ImageValidator.js';
import validationService from '../../../Service/validationService.js';
import { uploadToR2 } from '../../../Config/r2Config.js';
import { VALID_SKILLS } from '../../../mini.Functions/skills.constants.js';

import {
  notifyMatchingEmployees,
  notifyJobClosingSoon,
} from '../../../Service/Notification/NotificationService.js';


const imageValidator = new ImageValidator();
const CLOSING_WINDOW_MS = 24 * 60 * 60 * 1000; // 24 hours in ms

// ═══════════════════════════════════════════════════════════════
// CREATE JOB (Client Only)
// ═══════════════════════════════════════════════════════════════

export const createJob = async (req, res) => {
  try {

    // ═══════════════════════════════════════════════════════
    // 1. AUTHORIZATION CHECK
    // ═══════════════════════════════════════════════════════

    console.log('\n🔍 AUTH CHECK');

    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: '🚫 Authentication required',
      });
    }

    if (req.userType !== 'client') {
      return res.status(403).json({
        success: false,
        message: '🚫 Access denied. Only clients can post jobs.',
      });
    }

    const userId = req.userId;

    if (req.user.status !== 'active') {
      return res.status(403).json({
        success: false,
        message: `🚫 Account is ${req.user.status}. Cannot post jobs.`,
      });
    }

    const client = await Client.findOne({ userId });
    if (!client) {
      return res.status(404).json({
        success: false,
        message: '❌ Client profile not found. Please complete your profile first.',
      });
    }

    // ✅ No job posting limit — both free and premium can post freely
    console.log('✅ Authorization passed');
    console.log(`👤 User ID: ${userId}`);
    console.log(`🏷️  Type: ${req.userType}`);

    // ═══════════════════════════════════════════════════════
    // 2. PARSE DATA
    // ═══════════════════════════════════════════════════════

    let jobData;

    if (req.body.data) {
      try {
        jobData = JSON.parse(req.body.data);
      } catch (e) {
        return res.status(400).json({
          success: false,
          message: '❌ Invalid JSON in data field',
          error: e.message,
        });
      }
    } else {
      jobData = req.body;
    }

    let {
      jobTitle,
      description,
      price,
      currency = 'INR',
      needFor,
      tags = [],
      requiredSkills = [],
    } = jobData;

    // ═══════════════════════════════════════════════════════
    // 2.5 NORMALIZE ARRAY FIELDS
    // ═══════════════════════════════════════════════════════

    const normalizeArray = (input) => {
      if (Array.isArray(input)) return input;

      if (typeof input === 'string') {
        const trimmed = input.trim();
        if (trimmed === '') return [];

        if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
          try {
            const parsed = JSON.parse(trimmed);
            if (Array.isArray(parsed)) return parsed;
          } catch (e) {}

          try {
            const content = trimmed.slice(1, -1);
            const items = content
              .split(',')
              .map((item) => item.trim().replace(/^["'\\]+|["'\\]+$/g, '').trim())
              .filter(Boolean);
            if (items.length > 0) return items;
          } catch (e) {}
        }

        if (trimmed.includes(',')) {
          return trimmed.split(',').map((s) => s.trim()).filter(Boolean);
        }

        return [trimmed];
      }

      return [];
    };

    tags = normalizeArray(tags);
    requiredSkills = normalizeArray(requiredSkills);

    // ═══════════════════════════════════════════════════════
    // 3. VALIDATE REQUIRED FIELDS
    // ═══════════════════════════════════════════════════════

    if (!jobTitle || !description || !price || !needFor) {
      const missing = [];
      if (!jobTitle) missing.push('jobTitle');
      if (!description) missing.push('description');
      if (!price) missing.push('price');
      if (!needFor) missing.push('needFor');

      return res.status(400).json({
        success: false,
        message: `❌ Missing required fields: ${missing.join(', ')}`,
        missingFields: missing,
      });
    }

    if (typeof jobTitle !== 'string' || jobTitle.length < 10 || jobTitle.length > 200) {
      return res.status(400).json({
        success: false,
        message: '❌ Job title must be between 10 and 200 characters',
        currentLength: jobTitle?.length || 0,
      });
    }

    if (typeof description !== 'string' || description.length < 50 || description.length > 5000) {
      return res.status(400).json({
        success: false,
        message: '❌ Description must be between 50 and 5000 characters',
        currentLength: description?.length || 0,
      });
    }

    if (!['long-term', 'short-term'].includes(needFor)) {
      return res.status(400).json({
        success: false,
        message: '❌ needFor must be "long-term" or "short-term"',
        received: needFor,
        validOptions: ['long-term', 'short-term'],
      });
    }

    const numericPrice = Number(price);
    if (isNaN(numericPrice) || numericPrice <= 0) {
      return res.status(400).json({
        success: false,
        message: '❌ Price must be a positive number',
        received: price,
      });
    }

    const validCurrencies = ['INR', 'USD', 'EUR', 'GBP'];
    if (!validCurrencies.includes(currency)) {
      return res.status(400).json({
        success: false,
        message: '❌ Invalid currency',
        received: currency,
        validOptions: validCurrencies,
      });
    }

    if (tags.length > 10) {
      return res.status(400).json({
        success: false,
        message: '❌ Maximum 10 tags allowed',
        received: tags.length,
      });
    }

    for (const tag of tags) {
      if (typeof tag !== 'string' || tag.length < 2 || tag.length > 30) {
        return res.status(400).json({
          success: false,
          message: `❌ Tag "${tag}" must be between 2 and 30 characters`,
          invalidTag: tag,
        });
      }
    }

    console.log('\n🔍 Validating skills...');
    const invalidSkills = requiredSkills.filter((skill) => !VALID_SKILLS.includes(skill));

    if (invalidSkills.length > 0) {
      return res.status(400).json({
        success: false,
        message: '❌ Invalid skills found',
        invalidSkills,
        receivedSkills: requiredSkills,
        validSkills: VALID_SKILLS,
        hint: 'Check for typos or extra spaces',
      });
    }

    console.log('✅ All fields validated successfully');

    // ═══════════════════════════════════════════════════════
    // 4. HANDLE MEDIA FILES
    // ═══════════════════════════════════════════════════════

    const imageFiles = [];

    if (req.files && req.files.images) {
      imageFiles.push(...req.files.images);
    }

    if (req.files && req.files.videos && req.files.videos.length > 0) {
      return res.status(400).json({
        success: false,
        message: '🚫 Video uploads are currently disabled',
        hint: 'Please upload images only (max 3)',
      });
    }

    // ✅ Fixed limit for all users — no plan check needed
    const IMAGE_LIMIT = 3;

    if (imageFiles.length > IMAGE_LIMIT) {
      return res.status(400).json({
        success: false,
        message: `❌ Maximum ${IMAGE_LIMIT} images allowed per job`,
        received: imageFiles.length,
        limit: IMAGE_LIMIT,
      });
    }

    // ═══════════════════════════════════════════════════════
    // 5. VALIDATE JOB TITLE
    // ═══════════════════════════════════════════════════════

    const validationResults = {
      jobTitle: {},
      description: {},
      images: [],
      videos: [],
    };

    const titleValidation = await validationService.validateContent(jobTitle, 'title');
    const titleBlocked = titleValidation.action === 'BLOCK' || titleValidation.blocked;

    validationResults.jobTitle = {
      action: titleBlocked ? 'BLOCK' : titleValidation.confidence >= 50 ? 'WARN' : 'ALLOW',
      confidence: titleValidation.confidence || 0,
      violations: titleValidation.violations || titleValidation.matched || [],
      reason: titleValidation.reason || 'No violations detected',
      checkedAt: new Date(),
    };

    if (titleBlocked) {
      return res.status(400).json({
        success: false,
        status: 'rejected',
        message: '🚫 Job title rejected due to policy violations',
        results: { jobTitle: validationResults.jobTitle },
      });
    }

    // ═══════════════════════════════════════════════════════
    // 6. VALIDATE DESCRIPTION
    // ═══════════════════════════════════════════════════════

    const descValidation = await validationService.validateBio(description);
    const descBlocked = descValidation.action === 'BLOCK' || descValidation.blocked;

    validationResults.description = {
      action: descBlocked ? 'BLOCK' : descValidation.confidence >= 50 ? 'WARN' : 'ALLOW',
      confidence: descValidation.confidence || 0,
      violations: descValidation.violations || descValidation.matched || [],
      reason: descValidation.reason || 'No violations detected',
      checkedAt: new Date(),
    };

    if (descBlocked) {
      return res.status(400).json({
        success: false,
        status: 'rejected',
        message: '🚫 Description rejected due to policy violations',
        results: validationResults,
      });
    }

    // ═══════════════════════════════════════════════════════
    // 7. VALIDATE & UPLOAD IMAGES
    // ═══════════════════════════════════════════════════════

    const uploadedImages = [];

    if (imageFiles.length > 0) {
      console.log(`🖼️  Validating ${imageFiles.length} image(s)...`);

      const imageValidationResults = await Promise.all(
        imageFiles.map((file, index) =>
          imageValidator
            .validate(file.buffer, {
              testMode: false,
              isProfilePic: false,
              filename: file.originalname,
            })
            .then((validation) => ({ index: index + 1, filename: file.originalname, validation, file }))
        )
      );

      for (const { index, filename, validation, file } of imageValidationResults) {
        const imageBlocked = validation.action === 'BLOCK' || validation.blocked;

        const imageResult = {
          filename,
          action: validation.action,
          confidence: validation.confidence || 0,
          violations: (validation.violations || []).map((v) => (typeof v === 'object' ? v.type : v)),
          reason: validation.reason || 'No violations',
          checkedAt: new Date(),
        };

        validationResults.images.push(imageResult);

        if (imageBlocked) {
          return res.status(400).json({
            success: false,
            status: 'rejected',
            message: `🚫 Image ${index} (${filename}) rejected`,
            rejectedImage: imageResult,
            results: validationResults,
          });
        }
      }

      console.log('📤 Uploading images to R2...');

      try {
        const uploadResults = await Promise.all(
          imageFiles.map((file, index) => {
            const fileName = `jobs/${userId}/${Date.now()}-${index}-${file.originalname}`;
            return uploadToR2(file.buffer, fileName, file.mimetype).then((url) => ({
              url,
              filename: file.originalname,
              uploadedAt: new Date(),
            }));
          })
        );
        uploadedImages.push(...uploadResults);
        console.log(`✅ ${uploadedImages.length} images uploaded`);
      } catch (error) {
        return res.status(500).json({
          success: false,
          message: '❌ Image upload failed',
          error: error.message,
        });
      }
    }

    // ═══════════════════════════════════════════════════════
    // 8. CREATE JOB
    // ═══════════════════════════════════════════════════════

    console.log('\n💾 Creating job...');

    const job = new Job({
      userId,
      clientId: client._id,
      jobTitle,
      description,
      price: numericPrice,
      currency,
      needFor,
      tags,
      requiredSkills,
      images: uploadedImages,
      videos: [],
      validationResults,
      status: 'open',
      isActive: true,
      postedAt: new Date(),
    });

    await job.save();

    // ═══════════════════════════════════════════════════════
    // 9. UPDATE STATS
    // ═══════════════════════════════════════════════════════

    client.jobStats.totalPosted += 1;
    client.jobStats.totalActive += 1;
    await client.save();

    if (req.user.stats) {
      req.user.stats.totalJobsPosted = (req.user.stats.totalJobsPosted || 0) + 1;
      await req.user.save();
    }

    // Notify matching employees
    try {
      await notifyMatchingEmployees(job);
      console.log('🔔 Matching employees notified');
    } catch (notifyError) {
      console.error('⚠️ Notification failed (non-critical):', notifyError.message);
    }

    console.log(`✅ Job created successfully (ID: ${job._id})`);

    // ═══════════════════════════════════════════════════════
    // 10. RESPONSE
    // ═══════════════════════════════════════════════════════

    return res.status(201).json({
      success: true,
      status: 'approved',
      message: '✅ Job posted successfully',
      job: {
        id: job._id,
        jobTitle: job.jobTitle,
        description: job.description,
        price: job.price,
        currency: job.currency,
        needFor: job.needFor,
        tags: job.tags,
        requiredSkills: job.requiredSkills,
        images: job.images,
        videos: [],
        status: job.status,
        isActive: job.isActive,
        postedAt: job.postedAt,
      },
      validationResults,
    });

  } catch (error) {
    console.error('\n❌ JOB CREATION ERROR\n', error);

    if (error.name === 'ValidationError') {
      return res.status(400).json({
        success: false,
        message: '❌ Database validation error',
        error: error.message,
        details: Object.keys(error.errors || {}).map((key) => ({
          field: key,
          message: error.errors[key].message,
        })),
      });
    }

    if (error.name === 'MongoError' && error.code === 11000) {
      return res.status(400).json({
        success: false,
        message: '❌ Duplicate job entry',
      });
    }

    return res.status(500).json({
      success: false,
      message: '❌ Internal server error',
      error: error.message,
    });
  }
};
// ═══════════════════════════════════════════════════════════════
// SHARED AUTH GUARD  (reused in every controller below)
// ═══════════════════════════════════════════════════════════════

const guardClient = async (req, res) => {
  // returns { client, userId } on success, or sends response + returns null
  if (!req.user) {
    res.status(401).json({ success: false, message: '🚫 Authentication required' });
    return null;
  }
  if (req.userType !== 'client') {
    res.status(403).json({ success: false, message: '🚫 Access denied. Clients only.' });
    return null;
  }
  if (req.user.status !== 'active') {
    res.status(403).json({ success: false, message: `🚫 Account is ${req.user.status}.` });
    return null;
  }

  const userId = req.userId;
  const client = await Client.findOne({ userId });
  if (!client) {
    res.status(404).json({ success: false, message: '❌ Client profile not found.' });
    return null;
  }

  return { client, userId };
};
// ═══════════════════════════════════════════════════════════════
// 1. GET MY JOBS  —  GET /jobs/my-jobs
// ═══════════════════════════════════════════════════════════════
export const getMyJobs = async (req, res) => {
  try {

    // ─── 1. AUTH ────────────────────────────────────────────
    console.log('\n🔍 AUTH CHECK — getMyJobs');
    const guard = await guardClient(req, res);
    if (!guard) return;
    const { userId } = guard;

    // ─── 2. QUERY PARAMS ────────────────────────────────────
    const page     = Math.max(1, parseInt(req.query.page)  || 1);
    const limit    = Math.min(50, parseInt(req.query.limit) || 10);
    const skip     = (page - 1) * limit;
    const status   = req.query.status;   // open | closed | paused
    const sortBy   = req.query.sortBy || 'postedAt';
    const order    = req.query.order  === 'asc' ? 1 : -1;

    // ─── 3. BUILD FILTER ────────────────────────────────────
    const filter = { userId, isActive: true };
    if (status) filter.status = status;

    // ─── 4. FETCH ───────────────────────────────────────────
    const [jobs, total] = await Promise.all([
      Job.find(filter)
        .sort({ [sortBy]: order })
        .skip(skip)
        .limit(limit)
        .select('-validationResults'),          // don't expose internal moderation data
      Job.countDocuments(filter),
    ]);

    console.log(`✅ Fetched ${jobs.length} jobs for userId: ${userId}`);

    // ─── 5. RESPONSE ────────────────────────────────────────
    return res.status(200).json({
      success: true,
      message: '✅ Jobs fetched successfully',
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
      jobs,
    });

  } catch (error) {
    console.error('\n❌ GET MY JOBS ERROR\n', error);
    return res.status(500).json({ success: false, message: '❌ Internal server error', error: error.message });
  }
};
// ═══════════════════════════════════════════════════════════════
// 2. GET MY JOB BY ID  —  GET /jobs/:jobId
// ═══════════════════════════════════════════════════════════════
export const getMyJobById = async (req, res) => {
  try {

    // ─── 1. AUTH ────────────────────────────────────────────
    console.log('\n🔍 AUTH CHECK — getMyJobById');
    const guard = await guardClient(req, res);
    if (!guard) return;
    const { userId } = guard;

    // ─── 2. FETCH ───────────────────────────────────────────
    const { jobId } = req.params;

    const job = await Job.findOne({ _id: jobId, userId }).select('-validationResults');

    if (!job) {
      return res.status(404).json({
        success: false,
        message: '❌ Job not found or you do not own this job',
      });
    }

    console.log(`✅ Job fetched (ID: ${jobId})`);

    // ─── 3. RESPONSE ────────────────────────────────────────
    return res.status(200).json({
      success: true,
      message: '✅ Job fetched successfully',
      job,
    });

  } catch (error) {
    console.error('\n❌ GET JOB BY ID ERROR\n', error);
    return res.status(500).json({ success: false, message: '❌ Internal server error', error: error.message });
  }
};
// ═══════════════════════════════════════════════════════════════
// 3. UPDATE MY JOB  —  PATCH /jobs/:jobId
// ═══════════════════════════════════════════════════════════════
export const updateMyJob = async (req, res) => {
  try {

    // ─── 1. AUTH ────────────────────────────────────────────
    console.log('\n🔍 AUTH CHECK — updateMyJob');
    const guard = await guardClient(req, res);
    if (!guard) return;
    const { userId } = guard;

    // ─── 2. FIND JOB ────────────────────────────────────────
    const { jobId } = req.params;

    const job = await Job.findOne({ _id: jobId, userId });
    if (!job) {
      return res.status(404).json({
        success: false,
        message: '❌ Job not found or you do not own this job',
      });
    }

    if (job.status === 'closed') {
      return res.status(400).json({
        success: false,
        message: '🚫 Cannot update a closed job',
      });
    }

    // ─── 3. PARSE DATA ──────────────────────────────────────
    let jobData;
    if (req.body.data) {
      try { jobData = JSON.parse(req.body.data); }
      catch (e) {
        return res.status(400).json({ success: false, message: '❌ Invalid JSON in data field', error: e.message });
      }
    } else {
      jobData = req.body;
    }

    let {
      jobTitle,
      description,
      price,
      currency,
      needFor,
      tags,
      requiredSkills,
    } = jobData;

    // ─── 4. NORMALIZE ARRAYS ────────────────────────────────
    const normalizeArray = (input) => {
      if (Array.isArray(input)) return input;
      if (typeof input === 'string') {
        const t = input.trim();
        if (!t) return [];
        if (t.startsWith('[')) {
          try { const p = JSON.parse(t); if (Array.isArray(p)) return p; } catch (_) {}
        }
        if (t.includes(',')) return t.split(',').map(s => s.trim()).filter(Boolean);
        return [t];
      }
      return [];
    };

    if (tags !== undefined)          tags           = normalizeArray(tags);
    if (requiredSkills !== undefined) requiredSkills = normalizeArray(requiredSkills);

    // ─── 5. VALIDATE ONLY PROVIDED FIELDS ───────────────────
    if (jobTitle !== undefined) {
      if (typeof jobTitle !== 'string' || jobTitle.length < 10 || jobTitle.length > 200) {
        return res.status(400).json({ success: false, message: '❌ Job title must be between 10 and 200 characters' });
      }
    }

    if (description !== undefined) {
      if (typeof description !== 'string' || description.length < 50 || description.length > 5000) {
        return res.status(400).json({ success: false, message: '❌ Description must be between 50 and 5000 characters' });
      }
    }

    if (needFor !== undefined && !['long-term', 'short-term'].includes(needFor)) {
      return res.status(400).json({ success: false, message: '❌ needFor must be "long-term" or "short-term"' });
    }

    if (price !== undefined) {
      const numericPrice = Number(price);
      if (isNaN(numericPrice) || numericPrice <= 0) {
        return res.status(400).json({ success: false, message: '❌ Price must be a positive number' });
      }
      price = numericPrice;
    }

    if (currency !== undefined && !['INR', 'USD', 'EUR', 'GBP'].includes(currency)) {
      return res.status(400).json({ success: false, message: '❌ Invalid currency' });
    }

    if (tags !== undefined && tags.length > 10) {
      return res.status(400).json({ success: false, message: '❌ Maximum 10 tags allowed' });
    }

    if (requiredSkills !== undefined) {
      const invalidSkills = requiredSkills.filter(s => !VALID_SKILLS.includes(s));
      if (invalidSkills.length > 0) {
        return res.status(400).json({ success: false, message: '❌ Invalid skills found', invalidSkills });
      }
    }

    // ─── 6. RE-VALIDATE CONTENT IF CHANGED ──────────────────
    const validationResults = { ...job.validationResults };

    if (jobTitle !== undefined) {
      const tv = await validationService.validateContent(jobTitle, 'title');
      if (tv.action === 'BLOCK' || tv.blocked) {
        return res.status(400).json({ success: false, message: '🚫 Job title rejected due to policy violations' });
      }
      validationResults.jobTitle = { action: 'ALLOW', confidence: tv.confidence || 0, checkedAt: new Date() };
    }

    if (description !== undefined) {
      const dv = await validationService.validateBio(description);
      if (dv.action === 'BLOCK' || dv.blocked) {
        return res.status(400).json({ success: false, message: '🚫 Description rejected due to policy violations' });
      }
      validationResults.description = { action: 'ALLOW', confidence: dv.confidence || 0, checkedAt: new Date() };
    }

    // ─── 7. HANDLE NEW IMAGES ───────────────────────────────
    const imageFiles = req.files?.images || [];

    if (req.files?.videos?.length > 0) {
      return res.status(400).json({ success: false, message: '🚫 Video uploads are currently disabled' });
    }

    const existingImages = job.images || [];
    const totalImages    = existingImages.length + imageFiles.length;

    if (totalImages > 3) {
      return res.status(400).json({
        success: false,
        message: `❌ Maximum 3 images allowed. You already have ${existingImages.length}.`,
        existingCount: existingImages.length,
        newCount: imageFiles.length,
      });
    }

    const newUploadedImages = [];

    if (imageFiles.length > 0) {
      // validate
      const imageValidationResults = await Promise.all(
        imageFiles.map((file, i) =>
          imageValidator.validate(file.buffer, { testMode: false, isProfilePic: false, filename: file.originalname })
            .then(v => ({ i, file, v }))
        )
      );

      for (const { i, file, v } of imageValidationResults) {
        if (v.action === 'BLOCK' || v.blocked) {
          return res.status(400).json({
            success: false,
            message: `🚫 Image ${i + 1} (${file.originalname}) rejected due to policy violations`,
          });
        }
      }

      // upload
      try {
        const uploaded = await Promise.all(
          imageFiles.map((file, i) => {
            const fileName = `jobs/${userId}/${Date.now()}-${i}-${file.originalname}`;
            return uploadToR2(file.buffer, fileName, file.mimetype).then(url => ({
              url, filename: file.originalname, uploadedAt: new Date(),
            }));
          })
        );
        newUploadedImages.push(...uploaded);
      } catch (error) {
        return res.status(500).json({ success: false, message: '❌ Image upload failed', error: error.message });
      }
    }

    // ─── 8. APPLY UPDATES ───────────────────────────────────
    if (jobTitle      !== undefined) job.jobTitle       = jobTitle;
    if (description   !== undefined) job.description    = description;
    if (price         !== undefined) job.price          = price;
    if (currency      !== undefined) job.currency       = currency;
    if (needFor       !== undefined) job.needFor        = needFor;
    if (tags          !== undefined) job.tags           = tags;
    if (requiredSkills !== undefined) job.requiredSkills = requiredSkills;

    if (newUploadedImages.length > 0) {
      job.images = [...existingImages, ...newUploadedImages];
    }

    job.validationResults = validationResults;
    job.updatedAt = new Date();

    await job.save();

    console.log(`✅ Job updated successfully (ID: ${jobId})`);

    // ─── 9. RESPONSE ────────────────────────────────────────
    return res.status(200).json({
      success: true,
      message: '✅ Job updated successfully',
      job: {
        id:             job._id,
        jobTitle:       job.jobTitle,
        description:    job.description,
        price:          job.price,
        currency:       job.currency,
        needFor:        job.needFor,
        tags:           job.tags,
        requiredSkills: job.requiredSkills,
        images:         job.images,
        status:         job.status,
        updatedAt:      job.updatedAt,
      },
    });

  } catch (error) {
    console.error('\n❌ UPDATE JOB ERROR\n', error);
    return res.status(500).json({ success: false, message: '❌ Internal server error', error: error.message });
  }
};
// ═══════════════════════════════════════════════════════════════
// 4. CLOSE MY JOB  —  PATCH /jobs/:jobId/close
// ═══════════════════════════════════════════════════════════════
export const closeMyJob = async (req, res) => {
  try {

    // ─── 1. AUTH ────────────────────────────────────────────
    console.log('\n🔍 AUTH CHECK — closeMyJob');
    const guard = await guardClient(req, res);
    if (!guard) return;
    const { client, userId } = guard;

    // ─── 2. FIND JOB ────────────────────────────────────────
    const { jobId } = req.params;

    const job = await Job.findOne({ _id: jobId, userId });
    if (!job) {
      return res.status(404).json({
        success: false,
        message: '❌ Job not found or you do not own this job',
      });
    }

    if (job.status === 'closed') {
      return res.status(400).json({
        success: false,
        message: '⚠️ Job is already closed',
      });
    }

    // ─── 3. CLOSE ───────────────────────────────────────────
    job.status   = 'closed';
    job.isActive = false;
    job.closedAt = new Date();

    await job.save();

    // ─── 4. UPDATE CLIENT STATS ─────────────────────────────
    if (client.jobStats.totalActive > 0) {
      client.jobStats.totalActive -= 1;
    }
    client.jobStats.totalClosed = (client.jobStats.totalClosed || 0) + 1;
    await client.save();

    console.log(`✅ Job closed (ID: ${jobId})`);

    // ─── 5. RESPONSE ────────────────────────────────────────
    return res.status(200).json({
      success: true,
      message: '✅ Job closed successfully',
      job: {
        id:       job._id,
        jobTitle: job.jobTitle,
        status:   job.status,
        isActive: job.isActive,
        closedAt: job.closedAt,
      },
    });

  } catch (error) {
    console.error('\n❌ CLOSE JOB ERROR\n', error);
    return res.status(500).json({ success: false, message: '❌ Internal server error', error: error.message });
  }
};
// ═══════════════════════════════════════════════════════════════
// 5. DELETE MY JOB  —  DELETE /jobs/:jobId
// ═══════════════════════════════════════════════════════════════
export const deleteMyJob = async (req, res) => {
  try {

    // ─── 1. AUTH ────────────────────────────────────────────
    console.log('\n🔍 AUTH CHECK — deleteMyJob');
    const guard = await guardClient(req, res);
    if (!guard) return;
    const { client, userId } = guard;

    // ─── 2. FIND JOB ────────────────────────────────────────
    const { jobId } = req.params;

    const job = await Job.findOne({ _id: jobId, userId });
    if (!job) {
      return res.status(404).json({
        success: false,
        message: '❌ Job not found or you do not own this job',
      });
    }

    // ─── 3. DELETE ──────────────────────────────────────────
    const wasActive = job.status === 'open' && job.isActive;

    await Job.deleteOne({ _id: jobId });

    // ─── 4. UPDATE CLIENT STATS ─────────────────────────────
    if (client.jobStats.totalPosted > 0) {
      client.jobStats.totalPosted -= 1;
    }
    if (wasActive && client.jobStats.totalActive > 0) {
      client.jobStats.totalActive -= 1;
    }
    await client.save();

    console.log(`✅ Job deleted (ID: ${jobId})`);

    // ─── 5. RESPONSE ────────────────────────────────────────
    return res.status(200).json({
      success: true,
      message: '✅ Job deleted successfully',
      deletedJobId: jobId,
    });

  } catch (error) {
    console.error('\n❌ DELETE JOB ERROR\n', error);
    return res.status(500).json({ success: false, message: '❌ Internal server error', error: error.message });
  }
};




// ═══════════════════════════════════════════════════════════════
// 1. MARK JOB AS CLOSING SOON  —  PATCH /jobs/:jobId/closing-soon
//    Client manually triggers the 24hr warning on their own job
// ═══════════════════════════════════════════════════════════════
export const markClosingSoon = async (req, res) => {
  try {

    // ─── 1. AUTH ────────────────────────────────────────────
    console.log('\n🔍 AUTH CHECK — markClosingSoon');
    const guard = await guardClient(req, res);
    if (!guard) return;
    const { userId } = guard;

    // ─── 2. FIND JOB ────────────────────────────────────────
    const { jobId } = req.params;
    const job = await Job.findOne({ _id: jobId, userId });

    if (!job) {
      return res.status(404).json({
        success: false,
        message: '❌ Job not found or you do not own this job',
      });
    }

    // ─── 3. GUARD INVALID STATES ────────────────────────────
    if (job.status === 'closed') {
      return res.status(400).json({
        success: false,
        message: '🚫 Cannot mark a closed job as closing soon',
      });
    }

    if (job.status === 'closing-soon') {
      return res.status(400).json({
        success: false,
        message: '⚠️ Job is already marked as closing soon',
        closingAt: job.closingAt,
        hoursLeft: Math.max(0, ((new Date(job.closingAt) - Date.now()) / 3600000).toFixed(1)),
      });
    }

    // ─── 4. MARK CLOSING SOON ───────────────────────────────
    const closingAt = new Date(Date.now() + CLOSING_WINDOW_MS);

    job.status    = 'closing-soon';
    job.closingAt = closingAt;

    await job.save();

    console.log(`⏳ Job marked closing soon (ID: ${jobId}) — closes at ${closingAt.toISOString()}`);

    // ─── 5. NOTIFY MATCHING EMPLOYEES ───────────────────────
    try {
      await notifyJobClosingSoon(job);
      console.log('🔔 Employees notified of closing-soon status');
    } catch (notifyError) {
      console.error('⚠️ Notification failed (non-critical):', notifyError.message);
    }

    // ─── 6. RESPONSE ────────────────────────────────────────
    return res.status(200).json({
      success: true,
      message: '⏳ Job marked as closing soon. Will auto-close in 24 hours.',
      job: {
        id:        job._id,
        jobTitle:  job.jobTitle,
        status:    job.status,
        closingAt: job.closingAt,
      },
    });

  } catch (error) {
    console.error('\n❌ MARK CLOSING SOON ERROR\n', error);
    return res.status(500).json({ success: false, message: '❌ Internal server error', error: error.message });
  }
};
// ═══════════════════════════════════════════════════════════════
// 2. PROCESS CLOSING JOBS  —  called by cron (no HTTP req/res)
//
//    Wire this up in your cron file:
//
//    import cron from 'node-cron';
//    import { processClosingJobs } from './closingJobSoon.Controller.js';
//    cron.schedule('0 * * * *', processClosingJobs);  // runs every hour
//
//    Two passes per run:
//      Pass A — auto-close  : closing-soon jobs whose closingAt has passed
//      Pass B — warn        : open jobs whose closingAt falls within next 24hr
// ═══════════════════════════════════════════════════════════════
export const processClosingJobs = async () => {
  const now       = new Date();
  const in24Hours = new Date(now.getTime() + CLOSING_WINDOW_MS);

  console.log(`\n⏰ CRON — processClosingJobs @ ${now.toISOString()}`);

  const results = {
    autoClosed:    [],
    markedClosing: [],
    errors:        [],
  };

  // ─── PASS A — AUTO-CLOSE expired closing-soon jobs ──────
  try {
    const expiredJobs = await Job.find({
      status:    'closing-soon',
      isActive:  true,
      closingAt: { $lte: now },
    });

    console.log(`🔍 Pass A — ${expiredJobs.length} job(s) to auto-close`);

    for (const job of expiredJobs) {
      try {
        job.status   = 'closed';
        job.isActive = false;
        job.closedAt = now;
        await job.save();

        // update client stats
        const client = await Client.findOne({ userId: job.userId });
        if (client) {
          if (client.jobStats.totalActive > 0) client.jobStats.totalActive -= 1;
          client.jobStats.totalClosed = (client.jobStats.totalClosed || 0) + 1;
          await client.save();
        }

        results.autoClosed.push({ jobId: job._id, jobTitle: job.jobTitle });
        console.log(`✅ Auto-closed: "${job.jobTitle}" (ID: ${job._id})`);

      } catch (err) {
        results.errors.push({ jobId: job._id, error: err.message });
        console.error(`❌ Failed to auto-close job ${job._id}:`, err.message);
      }
    }

  } catch (err) {
    console.error('❌ Pass A query failed:', err.message);
  }

  // ─── PASS B — MARK open jobs entering 24hr window ───────
  try {
    const aboutToCloseJobs = await Job.find({
      status:    'open',
      isActive:  true,
      closingAt: { $gt: now, $lte: in24Hours },
    });

    console.log(`🔍 Pass B — ${aboutToCloseJobs.length} job(s) entering closing window`);

    for (const job of aboutToCloseJobs) {
      try {
        job.status = 'closing-soon';
        await job.save();

        try {
          await notifyJobClosingSoon(job);
        } catch (notifyError) {
          console.error(`⚠️ Notify failed for job ${job._id}:`, notifyError.message);
        }

        results.markedClosing.push({ jobId: job._id, jobTitle: job.jobTitle, closingAt: job.closingAt });
        console.log(`⏳ Marked closing-soon: "${job.jobTitle}" (ID: ${job._id})`);

      } catch (err) {
        results.errors.push({ jobId: job._id, error: err.message });
        console.error(`❌ Failed to mark job ${job._id}:`, err.message);
      }
    }

  } catch (err) {
    console.error('❌ Pass B query failed:', err.message);
  }

  // ─── SUMMARY ────────────────────────────────────────────
  console.log('\n📊 CRON SUMMARY');
  console.log(`   ✅ Auto-closed    : ${results.autoClosed.length}`);
  console.log(`   ⏳ Marked closing : ${results.markedClosing.length}`);
  console.log(`   ❌ Errors         : ${results.errors.length}`);

  return results;
};
// ═══════════════════════════════════════════════════════════════
// 3. CRON TRIGGER  —  GET /jobs/cron/closing-soon  (admin/internal)
//    HTTP wrapper to manually fire processClosingJobs for testing
// ═══════════════════════════════════════════════════════════════
export const triggerClosingJobsCron = async (req, res) => {
  try {
    console.log('\n🔧 Manual cron trigger — triggerClosingJobsCron');

    const results = await processClosingJobs();

    return res.status(200).json({
      success: true,
      message: '✅ Closing jobs cron processed',
      summary: {
        autoClosed:    results.autoClosed.length,
        markedClosing: results.markedClosing.length,
        errors:        results.errors.length,
      },
      details: results,
    });

  } catch (error) {
    console.error('\n❌ CRON TRIGGER ERROR\n', error);
    return res.status(500).json({ success: false, message: '❌ Internal server error', error: error.message });
  }
};