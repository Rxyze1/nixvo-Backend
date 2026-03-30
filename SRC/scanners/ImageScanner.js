/**
 * ═══════════════════════════════════════════════════════════════════════════
 *                          🖼️ IMAGE SCANNER
 *                   Evidence Collector for Image Content
 * ═══════════════════════════════════════════════════════════════════════════
 * 
 * Responsibilities:
 * - Layer 1: File validation (instant) - check format, size
 * - Layer 2: OCR extraction (~1-2s) - extract text from image
 * - Layer 3: Regex check (1ms) - scan extracted text
 * - Layer 4: AI verification (500ms) - if suspicious text found
 * - Returns EVIDENCE to ModerationController
 * 
 * Performance:
 * - Images without text: ~1-2 seconds (OCR only)
 * - Images with clean text: ~1-2 seconds (OCR + regex)
 * - Images with suspicious text: ~2-3 seconds (OCR + regex + AI)
 * 
 * Usage:
 *   const scanner = new ImageScanner(aiChecker);
 *   const evidence = await scanner.scan(imageBuffer, metadata);
 * 
 * ═══════════════════════════════════════════════════════════════════════════
 */

import Llama3Checker from '../ai/Llama3Checker.js';

import OCRExtractor from '../utils/OCRExtractor.js';
import RegexPatterns from '../utils/RegexPatterns.js';

class ImageScanner {
  
  constructor(aiChecker) {
    
    // Validate AI checker
    if (!aiChecker || !(aiChecker instanceof Llama3Checker)) {
      throw new Error('ImageScanner requires a valid Llama3Checker instance');
    }
    
    this.ai = aiChecker;
    this.ocr = new OCRExtractor();
    this.patterns = new RegexPatterns();
    
    // Configuration
    this.config = {
      skipProfilePics: process.env.SKIP_PROFILE_PIC_OCR === 'true',
      minTextLength: 10, // Minimum text length to trigger moderation
      maxFileSize: parseInt(process.env.MAX_FILE_SIZE || '10485760'), // 10MB
      allowedFormats: (process.env.ALLOWED_IMAGE_FORMATS || 'jpg,jpeg,png,gif,webp').split(',')
    };
    
    // Statistics
    this.stats = {
      totalScans: 0,
      withText: 0,
      withoutText: 0,
      regexBlocks: 0,
      aiChecks: 0,
      avgScanTime: 0,
      avgOCRTime: 0
    };
    
    console.log('🖼️ ImageScanner initialized');
  }
  
  // ═══════════════════════════════════════════════════════════════════════════
  // MAIN SCAN METHOD (Entry Point)
  // ═══════════════════════════════════════════════════════════════════════════
  
  /**
   * Scan image and return evidence
   * @param {Buffer} imageBuffer - Image data
   * @param {object} metadata - Image metadata (isProfilePic, userId, etc.)
   * @returns {Promise<object>} - Evidence object
   */
  async scan(imageBuffer, metadata = {}) {
    const startTime = Date.now();
    this.stats.totalScans++;
    
    try {
      
      // ═══════════════════════════════════════════════════════════════════
      // STEP 1: File Validation
      // ═══════════════════════════════════════════════════════════════════
      
      const validation = this._validateFile(imageBuffer, metadata);
      if (!validation.valid) {
        return this._createEvidence({
          error: validation.error,
          scanTime: Date.now() - startTime
        });
      }
      
      // ═══════════════════════════════════════════════════════════════════
      // STEP 2: Check if we should skip OCR (profile pictures)
      // ═══════════════════════════════════════════════════════════════════
      
      if (this.config.skipProfilePics && metadata.isProfilePic) {
        console.log('[ImageScanner] Skipping OCR for profile picture');
        
        return this._createEvidence({
          skipped: true,
          reason: 'Profile picture - OCR disabled',
          scanTime: Date.now() - startTime
        });
      }
      
      // ═══════════════════════════════════════════════════════════════════
      // STEP 3: LAYER 2 - OCR Extraction (~1-2 seconds)
      // ═══════════════════════════════════════════════════════════════════
      
      console.log('[ImageScanner] Extracting text from image...');
      const ocrStartTime = Date.now();
      
      const ocrResult = await this.ocr.extractText(imageBuffer);
      
      const ocrTime = Date.now() - ocrStartTime;
      this._updateOCRTime(ocrTime);
      
      console.log(
        `[ImageScanner] OCR complete: ${ocrResult.characterCount} chars extracted ` +
        `(${ocrTime}ms, confidence: ${ocrResult.confidence.toFixed(1)}%)`
      );
      
      // ═══════════════════════════════════════════════════════════════════
      // STEP 4: Check if image has meaningful text
      // ═══════════════════════════════════════════════════════════════════
      
      if (!ocrResult.text || ocrResult.text.length < this.config.minTextLength) {
        console.log('[ImageScanner] No significant text found - allowing image');
        this.stats.withoutText++;
        
        return this._createEvidence({
          ocrResult,
          regexResult: { violations: [], confidence: 0 },
          aiResult: null,
          checkedBy: ['ocr'],
          scanTime: Date.now() - startTime
        });
      }
      
      this.stats.withText++;
      
      // ═══════════════════════════════════════════════════════════════════
      // STEP 5: LAYER 3 - Regex Check on extracted text (~1ms)
      // ═══════════════════════════════════════════════════════════════════
      
      const regexResult = this.patterns.checkAll(ocrResult.text);
      
      console.log(
        `[ImageScanner] Regex check: ${regexResult.violations.length} violations, ` +
        `confidence ${regexResult.confidence}%`
      );
      
      // ═══════════════════════════════════════════════════════════════════
      // DECISION POINT: Should we check with AI?
      // ═══════════════════════════════════════════════════════════════════
      
      const needsAICheck = this._shouldCheckWithAI(regexResult, ocrResult, metadata);
      
      if (!needsAICheck) {
        // Fast path - regex + OCR evidence is enough
        return this._createEvidence({
          ocrResult,
          regexResult,
          aiResult: null,
          checkedBy: ['ocr', 'regex'],
          scanTime: Date.now() - startTime,
          fastPath: true
        });
      }
      
      // ═══════════════════════════════════════════════════════════════════
      // STEP 6: LAYER 4 - AI Check (~500ms)
      // ═══════════════════════════════════════════════════════════════════
      
      console.log('[ImageScanner] Suspicious text in image - checking with AI...');
      this.stats.aiChecks++;
      
      const aiResult = await this._checkWithAI(ocrResult, regexResult, metadata);
      
      // ═══════════════════════════════════════════════════════════════════
      // STEP 7: Return Combined Evidence
      // ═══════════════════════════════════════════════════════════════════
      
      const scanTime = Date.now() - startTime;
      this._updateStats(scanTime);
      
      return this._createEvidence({
        ocrResult,
        regexResult,
        aiResult,
        checkedBy: ['ocr', 'regex', 'ai'],
        scanTime,
        fastPath: false
      });
      
    } catch (error) {
      console.error('[ImageScanner] Error during scan:', error);
      
      return this._createEvidence({
        error: error.message,
        scanTime: Date.now() - startTime
      });
    }
  }
  
  // ═══════════════════════════════════════════════════════════════════════════
  // PRIVATE METHODS - VALIDATION
  // ═══════════════════════════════════════════════════════════════════════════
  
  _validateFile(imageBuffer, metadata) {
    // Empty buffer
    if (!imageBuffer || !Buffer.isBuffer(imageBuffer)) {
      return { valid: false, error: 'Invalid image buffer' };
    }
    
    // File too small (< 100 bytes - likely corrupt)
    if (imageBuffer.length < 100) {
      return { valid: false, error: 'Image file too small (likely corrupt)' };
    }
    
    // File too large
    if (imageBuffer.length > this.config.maxFileSize) {
      const maxMB = (this.config.maxFileSize / 1024 / 1024).toFixed(1);
      return { valid: false, error: `Image exceeds maximum size (${maxMB}MB)` };
    }
    
    // Check file format (basic magic number check)
    const format = this._detectImageFormat(imageBuffer);
    if (!this.config.allowedFormats.includes(format)) {
      return { 
        valid: false, 
        error: `Unsupported image format: ${format}. Allowed: ${this.config.allowedFormats.join(', ')}` 
      };
    }
    
    return { valid: true };
  }
  
  _detectImageFormat(buffer) {
    // Check magic numbers (file signatures)
    const signatures = {
      'ffd8ff': 'jpg',
      '89504e47': 'png',
      '47494638': 'gif',
      '52494646': 'webp'
    };
    
    const header = buffer.toString('hex', 0, 4);
    
    for (const [sig, format] of Object.entries(signatures)) {
      if (header.startsWith(sig)) {
        return format;
      }
    }
    
    return 'unknown';
  }
  
  // ═══════════════════════════════════════════════════════════════════════════
  // PRIVATE METHODS - AI DECISION LOGIC
  // ═══════════════════════════════════════════════════════════════════════════
  
  _shouldCheckWithAI(regexResult, ocrResult, metadata) {
    const { confidence, violations } = regexResult;
    
    // HIGH CONFIDENCE (95-100%) - Don't need AI
    if (confidence >= 95) {
      this.stats.regexBlocks++;
      return false;
    }
    
    // VERY LOW CONFIDENCE (0-39%) - Clean text
    if (confidence < 40) {
      return false;
    }
    
    // QR CODE DETECTED - Higher priority for AI check
    if (ocrResult.hasQRCode) {
      console.log('[ImageScanner] QR code detected - escalating to AI');
      return true;
    }
    
    // MEDIUM CONFIDENCE (40-94%) - Need AI verification
    return true;
  }
  
  // ═══════════════════════════════════════════════════════════════════════════
  // PRIVATE METHODS - AI INTEGRATION
  // ═══════════════════════════════════════════════════════════════════════════
  
  async _checkWithAI(ocrResult, regexResult, metadata) {
    try {
      
      // Build context for AI
      const aiMetadata = {
        regexFound: regexResult.violations.map(v => v.type).join(', '),
        regexConfidence: regexResult.confidence,
        hasQRCode: ocrResult.hasQRCode,
        isProfilePic: metadata.isProfilePic || false,
        ocrConfidence: ocrResult.confidence
      };
      
      // Call AI (Llama3Checker.checkImage method)
      const aiResult = await this.ai.checkImage(ocrResult.text, aiMetadata);
      
      console.log(
        `[ImageScanner] AI verdict: ${aiResult.blocked ? 'BLOCK' : 'ALLOW'} ` +
        `(confidence: ${aiResult.confidence}%, duration: ${aiResult.duration}ms)`
      );
      
      return aiResult;
      
    } catch (error) {
      console.error('[ImageScanner] AI check failed:', error.message);
      
      return {
        blocked: null,
        confidence: 50,
        error: error.message,
        checkedBy: 'ai-error'
      };
    }
  }
  
  // ═══════════════════════════════════════════════════════════════════════════
  // PRIVATE METHODS - EVIDENCE CREATION
  // ═══════════════════════════════════════════════════════════════════════════
  
  _createEvidence(data) {
    return {
      // OCR results
      ocrResult: data.ocrResult || { text: '', confidence: 0 },
      
      // Regex results
      regexResult: data.regexResult || { violations: [], confidence: 0 },
      
      // AI results
      aiResult: data.aiResult || null,
      
      // Metadata
      checkedBy: data.checkedBy || ['none'],
      scanTime: data.scanTime || 0,
      fastPath: data.fastPath || false,
      skipped: data.skipped || false,
      error: data.error || null,
      
      // Scanner identification
      scanner: 'ImageScanner',
      version: '1.0.0',
      timestamp: new Date().toISOString()
    };
  }
  
  // ═══════════════════════════════════════════════════════════════════════════
  // PRIVATE METHODS - STATISTICS
  // ═══════════════════════════════════════════════════════════════════════════
  
  _updateStats(scanTime) {
    const prevAvg = this.stats.avgScanTime;
    const count = this.stats.totalScans;
    this.stats.avgScanTime = (prevAvg * (count - 1) + scanTime) / count;
  }
  
  _updateOCRTime(ocrTime) {
    const prevAvg = this.stats.avgOCRTime;
    const count = this.stats.totalScans;
    this.stats.avgOCRTime = (prevAvg * (count - 1) + ocrTime) / count;
  }
  
  // ═══════════════════════════════════════════════════════════════════════════
  // PUBLIC API - STATISTICS & HEALTH
  // ═══════════════════════════════════════════════════════════════════════════
  
  /**
   * Get scanner statistics
   */
  getStats() {
    return {
      totalScans: this.stats.totalScans,
      withText: this.stats.withText,
      withoutText: this.stats.withoutText,
      textDetectionRate: ((this.stats.withText / this.stats.totalScans) * 100).toFixed(2) + '%',
      regexBlocks: this.stats.regexBlocks,
      aiChecks: this.stats.aiChecks,
      avgScanTime: Math.round(this.stats.avgScanTime) + 'ms',
      avgOCRTime: Math.round(this.stats.avgOCRTime) + 'ms',
      aiUsageRate: ((this.stats.aiChecks / this.stats.totalScans) * 100).toFixed(2) + '%'
    };
  }
  
  /**
   * Get health status
   */
  getHealth() {
    return {
      status: 'healthy',
      scanner: 'ImageScanner',
      ready: true,
      aiConnected: this.ai ? true : false,
      ocrReady: this.ocr.getHealth().ready
    };
  }
  
  /**
   * Shutdown (cleanup OCR worker)
   */
  async shutdown() {
    console.log('[ImageScanner] Shutting down...');
    await this.ocr.shutdown();
    console.log('[ImageScanner] Shutdown complete');
  }
  
  /**
   * Reset statistics
   */
  resetStats() {
    this.stats = {
      totalScans: 0,
      withText: 0,
      withoutText: 0,
      regexBlocks: 0,
      aiChecks: 0,
      avgScanTime: 0,
      avgOCRTime: 0
    };
    
    console.log('[ImageScanner] Statistics reset');
  }
}

export default ImageScanner;