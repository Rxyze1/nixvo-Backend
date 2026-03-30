// controllers/testValidationController.js

import TestPost from '../Models/TestPost.js';
import ImageValidator from '../Service/Security/ImageValidator.js';
import validationService from '../Service/validationService.js'; // ✅ This works now
import r2Client from '../Config/r2Config.js';
import { PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';

const imageValidator = new ImageValidator();
const R2_BUCKET = process.env.CLOUDFLARE_R2_BUCKET_NAME;
const R2_PUBLIC_URL = process.env.CLOUDFLARE_R2_PUBLIC_URL;

// Upload to R2
async function uploadToR2(buffer, fileName, mimeType) {
  await r2Client.send(new PutObjectCommand({
    Bucket: R2_BUCKET,
    Key: fileName,
    Body: buffer,
    ContentType: mimeType
  }));
  return `${R2_PUBLIC_URL}/${fileName}`;
}

// Delete from R2
async function deleteFromR2(imageUrl) {
  const key = imageUrl.replace(`${R2_PUBLIC_URL}/`, '');
  await r2Client.send(new DeleteObjectCommand({
    Bucket: R2_BUCKET,
    Key: key
  }));
}

export const testValidation = async (req, res) => {
  try {
    
    // ═════════════════════════════════════════════════════
    // PARSE DATA
    // ═════════════════════════════════════════════════════
    
    let testName, title, description;
    
    // Try parsing from req.body.data (JSON string in form-data)
    if (req.body.data) {
      try {
        const parsed = JSON.parse(req.body.data);
        testName = parsed.testName;
        title = parsed.title;
        description = parsed.description;
      } catch (e) {
        console.error('Failed to parse req.body.data:', e.message);
      }
    }
    
    // Fallback to direct form-data fields
    if (!title || !description) {
      testName = testName || req.body.testName;
      title = title || req.body.title;
      description = description || req.body.description;
    }
    
    // ═════════════════════════════════════════════════════
    // HANDLE IMAGES (Single or Multiple)
    // ═════════════════════════════════════════════════════
    
    const imageFiles = [];
    
    // Handle req.files (from uploadTestImages middleware)
    if (req.files) {
      // Single image field
      if (req.files.image) {
        imageFiles.push(...req.files.image);
      }
      // Multiple images field
      if (req.files.images) {
        imageFiles.push(...req.files.images);
      }
    }
    
    // Fallback for single image (from uploadSingleImage middleware)
    if (req.file) {
      imageFiles.push(req.file);
    }
    
    const hasImages = imageFiles.length > 0;
    
    // ✅ Limit check
    if (imageFiles.length > 5) {
      return res.status(400).json({
        success: false,
        message: 'Maximum 5 images allowed'
      });
    }
    
    // ✅ FIX: Allow image-only upload if no text fields provided
    const isImageOnly = hasImages && !title && !description;
    
    if (!isImageOnly && (!title || !description)) {
      return res.status(400).json({
        success: false,
        message: 'Title and description required (or provide images only)'
      });
    }
    
    // ═════════════════════════════════════════════════════
    // IMAGE-ONLY MODE (Multiple Images)
    // ═════════════════════════════════════════════════════
    
    if (isImageOnly) {
      console.log('\n🖼️  ═══════════════════════════════════════════════════════');
      console.log(`🖼️  IMAGE-ONLY VALIDATION MODE (${imageFiles.length} images)`);
      console.log('🖼️  ═══════════════════════════════════════════════════════\n');
      
      const imageResults = [];
      const imageUrls = [];
      const startTime = Date.now();
      
      // ✅ PARALLEL VALIDATION
      const validationPromises = imageFiles.map((imageFile, index) => {
        console.log(`📷 Queuing validation ${index + 1}/${imageFiles.length}: ${imageFile.originalname}`);
        
        return imageValidator.validate(imageFile.buffer, {
          testMode: true,
          isProfilePic: false,
          filename: imageFile.originalname
        }).then(validation => ({
          index: index + 1,
          filename: imageFile.originalname,
          validation,
          file: imageFile
        }));
      });
      
      const validationResults = await Promise.all(validationPromises);
      const totalTime = Date.now() - startTime;
      
      console.log(`\n⚡ All ${imageFiles.length} images validated in ${totalTime}ms\n`);
      
      // Process results
      for (const { index, filename, validation, file } of validationResults) {
        
        const imageResult = {
          filename,
          action: validation.action,
          confidence: validation.confidence,
          violations: validation.violations?.map(v => 
            typeof v === 'object' ? v.type : v
          ) || [],
          reason: validation.reason,
          extractedText: validation.ocrResult?.text?.substring(0, 200) || null,
          checkedBy: validation.checkedBy || [],
          scanTime: validation.scanTime + 'ms',
          checkedAt: new Date()
        };
        
        imageResults.push(imageResult);
        
        console.log(`${validation.blocked ? '❌' : '✅'} Image ${index}: ${filename}`);
        console.log(`   Action: ${validation.action}`);
        console.log(`   Confidence: ${validation.confidence}%`);
        console.log(`   Violations: ${imageResult.violations.join(', ') || 'None'}\n`);
        
        // 🚫 IMAGE REJECTED
        if (validation.blocked) {
          console.log(`🚫 Image ${index} rejected - stopping validation\n`);
          
          return res.status(400).json({
            success: false,
            status: 'rejected',
            message: `🚫 Image ${index} (${filename}) rejected`,
            rejectedImage: imageResult,
            results: {
              images: imageResults
            }
          });
        }
      }
      
      // ✅ ALL IMAGES PASSED - UPLOAD TO R2 IN PARALLEL
      console.log('📤 Uploading all images to R2...\n');
      
      const uploadPromises = imageFiles.map((file, index) => {
        const timestamp = Date.now();
        const fileName = `test-validation/${timestamp}-${index}-${file.originalname}`;
        return uploadToR2(file.buffer, fileName, file.mimetype);
      });
      
      const uploadedUrls = await Promise.all(uploadPromises);
      imageUrls.push(...uploadedUrls);
      
      console.log(`✅ All ${imageFiles.length} images uploaded!\n`);
      
      // SAVE TO DATABASE (image only)
      const testPost = new TestPost({
        testName: 'Image Only Test',
        title: 'Image Upload',
        description: `${imageFiles.length} images validated`,
        imageUrl: imageUrls[0],
        imageUrls: imageUrls,
        validationResults: {
          testName: null,
          title: null,
          description: null,
          images: imageResults
        },
        status: 'approved'
      });
      
      await testPost.save();
      
      return res.status(200).json({
        success: true,
        status: 'approved',
        message: `✅ All ${imageFiles.length} images approved`,
        testId: testPost._id,
        results: {
          images: imageResults
        },
        data: {
          imageCount: imageUrls.length,
          imageUrls: imageUrls,
          createdAt: testPost.createdAt
        }
      });
    }
    
    // ═════════════════════════════════════════════════════
    // FULL VALIDATION MODE (Text + Optional Images)
    // ═════════════════════════════════════════════════════
    
    console.log('\n🧪 ═══════════════════════════════════════════════════════');
    console.log('🧪 TEST VALIDATION STARTED');
    console.log('🧪 ═══════════════════════════════════════════════════════\n');
    
    console.log('📋 Input Data:');
    console.log(`- Test Name: ${testName || 'Anonymous'}`);
    console.log(`- Title: ${title}`);
    console.log(`- Description: ${description.length} chars`);
    console.log(`- Images: ${hasImages ? `✅ ${imageFiles.length}` : '❌ No'}\n`);
    
    const results = {
      testName: null,
      title: null,
      description: null,
      images: []
    };
    
    // ═════════════════════════════════════════════════════
    // VALIDATE TEST NAME (if provided)
    // ═════════════════════════════════════════════════════
    
    if (testName && testName.trim() !== '') {
      console.log('👤 ═══════════════════════════════════════════════════════');
      console.log('👤 VALIDATING TEST NAME');
      console.log('👤 ═══════════════════════════════════════════════════════\n');
      
      const nameValidation = await validationService.validateContent(testName, 'name');
      
      const action = nameValidation.blocked ? 'BLOCK' : 
                     nameValidation.confidence >= 50 ? 'WARN' : 'ALLOW';
      
      results.testName = {
        action,
        confidence: nameValidation.confidence || 0,
        violations: nameValidation.matched || [],
        reason: nameValidation.reason || 'No violations detected',
        source: nameValidation.source,
        layer: nameValidation.layer,
        checkedAt: new Date()
      };
      
      console.log(`${nameValidation.blocked ? '❌' : '✅'} Test Name Check Complete:`);
      console.log(`   Action: ${action}`);
      console.log(`   Confidence: ${nameValidation.confidence}%`);
      console.log(`   Violations: ${nameValidation.matched?.join(', ') || 'None'}`);
      console.log(`   Reason: ${nameValidation.reason}\n`);
      
      if (nameValidation.blocked) {
        console.log('🚫 TEST NAME REJECTED - STOPPING VALIDATION\n');
        
        return res.status(400).json({
          success: false,
          status: 'rejected',
          message: '🚫 Test name rejected due to policy violations',
          results: {
            testName: results.testName
          }
        });
      }
    }
    
    // ═════════════════════════════════════════════════════
    // VALIDATE TITLE
    // ═════════════════════════════════════════════════════
    
    console.log('📝 ═══════════════════════════════════════════════════════');
    console.log('📝 VALIDATING TITLE');
    console.log('📝 ═══════════════════════════════════════════════════════\n');
    
    const titleValidation = await validationService.validateContent(title, 'title');
    
    const titleAction = titleValidation.blocked ? 'BLOCK' : 
                        titleValidation.confidence >= 50 ? 'WARN' : 'ALLOW';
    
    results.title = {
      action: titleAction,
      confidence: titleValidation.confidence || 0,
      violations: titleValidation.matched || [],
      reason: titleValidation.reason || 'No violations detected',
      source: titleValidation.source,
      layer: titleValidation.layer,
      checkedAt: new Date()
    };
    
    console.log(`${titleValidation.blocked ? '❌' : '✅'} Title Check Complete:`);
    console.log(`   Action: ${titleAction}`);
    console.log(`   Confidence: ${titleValidation.confidence}%`);
    console.log(`   Violations: ${titleValidation.matched?.join(', ') || 'None'}`);
    console.log(`   Reason: ${titleValidation.reason}\n`);
    
    if (titleValidation.blocked) {
      console.log('🚫 TITLE REJECTED - STOPPING VALIDATION\n');
      
      return res.status(400).json({
        success: false,
        status: 'rejected',
        message: '🚫 Title rejected due to policy violations',
        results: {
          testName: results.testName,
          title: results.title
        }
      });
    }
    
    // ═════════════════════════════════════════════════════
    // VALIDATE DESCRIPTION
    // ═════════════════════════════════════════════════════
    
    console.log('📄 ═══════════════════════════════════════════════════════');
    console.log('📄 VALIDATING DESCRIPTION');
    console.log('📄 ═══════════════════════════════════════════════════════\n');
    
    const descValidation = await validationService.validateBio(description);
    
    const descAction = descValidation.blocked ? 'BLOCK' : 
                       descValidation.confidence >= 50 ? 'WARN' : 'ALLOW';
    
    results.description = {
      action: descAction,
      confidence: descValidation.confidence || 0,
      violations: descValidation.matched || [],
      reason: descValidation.reason || 'No violations detected',
      source: descValidation.source,
      layer: descValidation.layer,
      checkedAt: new Date()
    };
    
    console.log(`${descValidation.blocked ? '❌' : '✅'} Description Check Complete:`);
    console.log(`   Action: ${descAction}`);
    console.log(`   Confidence: ${descValidation.confidence}%`);
    console.log(`   Violations: ${descValidation.matched?.join(', ') || 'None'}`);
    console.log(`   Reason: ${descValidation.reason}\n`);
    
    if (descValidation.blocked) {
      console.log('🚫 DESCRIPTION REJECTED - STOPPING VALIDATION\n');
      
      return res.status(400).json({
        success: false,
        status: 'rejected',
        message: '🚫 Description rejected due to policy violations',
        results: {
          testName: results.testName,
          title: results.title,
          description: results.description
        }
      });
    }
    
    // ═════════════════════════════════════════════════════
    // VALIDATE IMAGES IN PARALLEL (Only if all text passed)
    // ═════════════════════════════════════════════════════
    
    let imageUrls = [];
    
    if (hasImages) {
      console.log('🖼️  ═══════════════════════════════════════════════════════');
      console.log(`🖼️  VALIDATING ${imageFiles.length} IMAGE(S) IN PARALLEL`);
      console.log('🖼️  ═══════════════════════════════════════════════════════\n');
      
      const startTime = Date.now();
      
      // ✅ PARALLEL VALIDATION
      const validationPromises = imageFiles.map((imageFile, index) => {
        console.log(`📷 Queuing validation ${index + 1}/${imageFiles.length}: ${imageFile.originalname}`);
        
        return imageValidator.validate(imageFile.buffer, {
          testMode: true,
          isProfilePic: false,
          filename: imageFile.originalname
        }).then(validation => ({
          index: index + 1,
          filename: imageFile.originalname,
          validation,
          file: imageFile
        }));
      });
      
      const validationResults = await Promise.all(validationPromises);
      const totalTime = Date.now() - startTime;
      
      console.log(`\n⚡ All ${imageFiles.length} images validated in ${totalTime}ms\n`);
      
      // Process results
      for (const { index, filename, validation, file } of validationResults) {
        
        const imageResult = {
          filename,
          action: validation.action,
          confidence: validation.confidence,
          violations: validation.violations?.map(v => 
            typeof v === 'object' ? v.type : v
          ) || [],
          reason: validation.reason,
          extractedText: validation.ocrResult?.text?.substring(0, 200) || null,
          checkedBy: validation.checkedBy || [],
          scanTime: validation.scanTime + 'ms',
          checkedAt: new Date()
        };
        
        results.images.push(imageResult);
        
        console.log(`${validation.blocked ? '❌' : '✅'} Image ${index}: ${filename}`);
        console.log(`   Action: ${validation.action}`);
        console.log(`   Confidence: ${validation.confidence}%`);
        console.log(`   Violations: ${imageResult.violations.join(', ') || 'None'}\n`);
        
        // 🚫 If any image blocked, reject all
        if (validation.blocked) {
          console.log(`🚫 Image ${index} blocked - rejecting entire request\n`);
          
          return res.status(400).json({
            success: false,
            status: 'rejected',
            message: `🚫 Image ${index} (${filename}) rejected`,
            rejectedImage: imageResult,
            results
          });
        }
      }
      
      // ✅ All images passed - Upload to R2 in parallel
      console.log('📤 Uploading all images to R2...\n');
      
      const uploadPromises = imageFiles.map((file, index) => {
        const timestamp = Date.now();
        const fileName = `test-validation/${timestamp}-${index}-${file.originalname}`;
        return uploadToR2(file.buffer, fileName, file.mimetype);
      });
      
      const uploadedUrls = await Promise.all(uploadPromises);
      imageUrls.push(...uploadedUrls);
      
      console.log(`✅ All ${imageFiles.length} images uploaded!\n`);
      
    } else {
      console.log('ℹ️  No images provided - skipping image validation\n');
    }
    
    // ═════════════════════════════════════════════════════
    // ✅ ALL VALIDATIONS PASSED - SAVE TO DATABASE
    // ═════════════════════════════════════════════════════
    
    console.log('💾 ═══════════════════════════════════════════════════════');
    console.log('💾 SAVING RESULTS (ALL CHECKS PASSED)');
    console.log('💾 ═══════════════════════════════════════════════════════\n');
    
    const testPost = new TestPost({
      testName: testName || 'Anonymous Test',
      title,
      description,
      imageUrl: imageUrls[0] || null,
      imageUrls: imageUrls,
      validationResults: results,
      status: 'approved'
    });
    
    await testPost.save();
    
    console.log(`✅ Saved to database (ID: ${testPost._id})\n`);
    
    console.log('📊 ═══════════════════════════════════════════════════════');
    console.log('📊 VALIDATION SUMMARY');
    console.log('📊 ═══════════════════════════════════════════════════════\n');
    console.log(`   Overall Status: APPROVED ✅`);
    if (results.testName) console.log(`   Test Name: ${results.testName.action}`);
    console.log(`   Title: ${results.title.action}`);
    console.log(`   Description: ${results.description.action}`);
    console.log(`   Images: ${results.images.length} validated\n`);
    console.log('🧪 TEST COMPLETED\n');
    
    return res.status(200).json({
      success: true,
      status: 'approved',
      message: `✅ Content approved - All checks passed (${imageFiles.length} images)`,
      testId: testPost._id,
      results,
      data: {
        testName: testPost.testName,
        title: testPost.title,
        description: testPost.description,
        imageCount: imageUrls.length,
        imageUrls: imageUrls,
        createdAt: testPost.createdAt
      }
    });
    
  } catch (error) {
    console.error('\n❌ TEST VALIDATION ERROR\n');
    console.error(error);
    
    return res.status(500).json({
      success: false,
      message: '❌ Internal server error',
      error: error.message
    });
  }
};
// Get all tests
export const getAllTests = async (req, res) => {
  try {
    const { status, limit = 50 } = req.query;
    
    const filter = status ? { status } : {};
    
    const tests = await TestPost.find(filter)
      .sort({ createdAt: -1 })
      .limit(parseInt(limit));
    
    return res.json({
      success: true,
      count: tests.length,
      data: tests
    });
    
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch tests',
      error: error.message
    });
  }
};

// Get single test
export const getTestById = async (req, res) => {
  try {
    const test = await TestPost.findById(req.params.id);
    
    if (!test) {
      return res.status(404).json({
        success: false,
        message: 'Test not found'
      });
    }
    
    return res.json({
      success: true,
      data: test
    });
    
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch test',
      error: error.message
    });
  }
};

// Delete single test
export const deleteTest = async (req, res) => {
  try {
    const test = await TestPost.findById(req.params.id);
    
    if (!test) {
      return res.status(404).json({
        success: false,
        message: 'Test not found'
      });
    }
    
    // Delete image from R2 if exists
    if (test.imageUrl) {
      try {
        await deleteFromR2(test.imageUrl);
      } catch (error) {
        console.error('Failed to delete image from R2:', error.message);
      }
    }
    
    await test.deleteOne();
    
    return res.json({
      success: true,
      message: '✅ Test deleted'
    });
    
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Failed to delete test',
      error: error.message
    });
  }
};

// Delete all tests
export const deleteAllTests = async (req, res) => {
  try {
    const tests = await TestPost.find();
    
    // Delete all images from R2
    for (const test of tests) {
      if (test.imageUrl) {
        try {
          await deleteFromR2(test.imageUrl);
        } catch (error) {
          console.error('Failed to delete image:', error.message);
        }
      }
    }
    
    const result = await TestPost.deleteMany({});
    
    return res.json({
      success: true,
      message: `✅ Deleted ${result.deletedCount} tests`
    });
    
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Failed to delete tests',
      error: error.message
    });
  }
};

// Get statistics
export const getStats = async (req, res) => {
  try {
    const total = await TestPost.countDocuments();
    const approved = await TestPost.countDocuments({ status: 'approved' });
    const rejected = await TestPost.countDocuments({ status: 'rejected' });
    const flagged = await TestPost.countDocuments({ status: 'flagged' });
    
    const imageValidatorStats = imageValidator.getStats();
    
    return res.json({
      success: true,
      statistics: {
        imageValidator: imageValidatorStats,
        database: {
          total,
          approved,
          rejected,
          flagged,
          approvalRate: total > 0 ? `${((approved / total) * 100).toFixed(1)}%` : '0%',
          rejectionRate: total > 0 ? `${((rejected / total) * 100).toFixed(1)}%` : '0%'
        }
      }
    });
    
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Failed to get statistics',
      error: error.message
    });
  }
};