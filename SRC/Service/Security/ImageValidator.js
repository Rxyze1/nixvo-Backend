/**
 * ═══════════════════════════════════════════════════════════════════════════
 *                    🖼️ IMAGE VALIDATOR
 *              OCR + Your Existing AI Service Integration
 * ═══════════════════════════════════════════════════════════════════════════
 * 
 * Uses:
 * - OCRExtractor (extracts text from images)
 * - Your existing RegexPatterns (ultra-aggressive patterns)
 * - Your existing AIValidationService (Groq + Llama 3)
 * 
 * ═══════════════════════════════════════════════════════════════════════════
 */

import OCRExtractor from '../../Utils/OCRExtractor.js';
import RegexPatterns from '../../Utils/RegexPatterns.js'; // ✅ Your existing regex
import AIValidationService from '../moderation/aiValidationService.js'; // ✅ Your existing AI service
import crypto from 'crypto';

class ImageValidator {
  
  constructor() {
    
    // Initialize services (use your existing ones!)
    this.ocr = new OCRExtractor({
      quality: 'fast',
      preprocessImage: true
    });
    
    this.patterns = RegexPatterns; // ✅ Your singleton instance
    this.ai = AIValidationService; // ✅ Your singleton instance
    
    // Configuration
    this.config = {
      minTextLength: 10,              // Minimum text to trigger checks
      regexLowThreshold: 40,          // < 40% confidence = allow without AI
      regexHighThreshold: 95,         // > 95% confidence = block without AI
      enableCaching: true,
      cacheExpiry: 24 * 60 * 60 * 1000, // 24 hours
      skipProfilePics: false          // Set true to be less strict on profile pics
    };
    
    // Statistics
    this.stats = {
      totalValidations: 0,
      withText: 0,
      withoutText: 0,
      decidedByRegex: 0,
      decidedByAI: 0,
      cached: 0,
      blocked: 0,
      allowed: 0,
      avgValidationTime: 0
    };
    
    // Cache
    this.cache = new Map();
    
    console.log('🖼️ ImageValidator initialized (using existing AI service)');
  }
  
  // ═══════════════════════════════════════════════════════════════════════════
  // MAIN VALIDATION METHOD
  // ═══════════════════════════════════════════════════════════════════════════
  
  async validate(imageBuffer, metadata = {}) {
    const startTime = Date.now();
    this.stats.totalValidations++;
    
    try {
      
      console.log(`\n🖼️ [Image Validation] User: ${metadata.userId || 'unknown'}`);
      console.log(`📋 Type: ${metadata.isProfilePic ? 'Profile Picture' : 'Content Image'}`);
      
      // ═════════════════════════════════════════════════════════════════
      // STEP 1: Basic file validation
      // ═════════════════════════════════════════════════════════════════
      
      const basicCheck = this._validateBasics(imageBuffer);
      if (!basicCheck.valid) {
        this.stats.blocked++;
        console.log(`❌ Basic validation failed: ${basicCheck.error}`);
        
        return this._createResult({
          valid: false,
          blocked: true,
          action: 'BLOCK',
          reason: basicCheck.error,
          confidence: 100,
          checkedBy: ['basic'],
          scanTime: Date.now() - startTime
        });
      }
      
      // ═════════════════════════════════════════════════════════════════
      // STEP 2: OCR - Extract text from image
      // ═════════════════════════════════════════════════════════════════
      
      console.log('📝 Extracting text with OCR...');
      const ocrResult = await this.ocr.extractText(imageBuffer);
      
      // No text found - ALLOW immediately
      if (!ocrResult.text || ocrResult.text.length < this.config.minTextLength) {
        console.log('✅ No text detected - ALLOWED');
        this.stats.withoutText++;
        this.stats.allowed++;
        
        return this._createResult({
          valid: true,
          blocked: false,
          action: 'ALLOW',
          reason: 'No significant text detected',
          confidence: 0,
          ocrResult,
          checkedBy: ['ocr'],
          scanTime: Date.now() - startTime
        });
      }
      
      this.stats.withText++;
      console.log(`📄 Text extracted: ${ocrResult.characterCount} chars`);
      console.log(`📝 Text preview: "${ocrResult.text.substring(0, 100)}..."`);
      
      // ═════════════════════════════════════════════════════════════════
      // STEP 3: Check cache (avoid duplicate processing)
      // ═════════════════════════════════════════════════════════════════
      
      const textHash = this._hashText(ocrResult.text);
      
      if (this.config.enableCaching) {
        const cached = this._checkCache(textHash);
        if (cached) {
          console.log('💾 Using cached result');
          this.stats.cached++;
          cached.blocked ? this.stats.blocked++ : this.stats.allowed++;
          
          return this._createResult({
            ...cached,
            cached: true,
            scanTime: Date.now() - startTime
          });
        }
      }
      
      // ═════════════════════════════════════════════════════════════════
      // STEP 4: Regex check (your ultra-aggressive patterns)
      // ═════════════════════════════════════════════════════════════════
      
      console.log('🔍 Running regex checks (ultra-aggressive mode)...');
      const regexResult = this.patterns.checkAll(ocrResult.text);
      
      console.log(`📊 Regex confidence: ${regexResult.confidence}%`);
      console.log(`🚨 Violations: ${regexResult.violations.length}`);
      
      if (regexResult.violations.length > 0) {
        console.log('🚨 Regex violations:', regexResult.matched.join(', '));
      }
      
      // ═════════════════════════════════════════════════════════════════
      // DECISION LOGIC
      // ═════════════════════════════════════════════════════════════════
      
      // LOW CONFIDENCE - Allow without AI
      if (regexResult.confidence < this.config.regexLowThreshold) {
        console.log('✅ Low confidence - ALLOWED (no AI needed)');
        this.stats.decidedByRegex++;
        this.stats.allowed++;
        
        const result = this._createResult({
          valid: true,
          blocked: false,
          action: 'ALLOW',
          reason: 'No clear violations detected',
          confidence: regexResult.confidence,
          ocrResult,
          regexResult,
          checkedBy: ['ocr', 'regex'],
          scanTime: Date.now() - startTime
        });
        
        this._saveToCache(textHash, result);
        return result;
      }
      
      // VERY HIGH CONFIDENCE - Block without AI
      if (regexResult.confidence >= this.config.regexHighThreshold) {
        console.log('🚫 High confidence violation - BLOCKED (no AI needed)');
        this.stats.decidedByRegex++;
        this.stats.blocked++;
        
        const result = this._createResult({
          valid: false,
          blocked: true,
          action: 'BLOCK',
          reason: 'Contact information clearly detected',
          confidence: regexResult.confidence,
          ocrResult,
          regexResult,
          violations: regexResult.violations,
          checkedBy: ['ocr', 'regex'],
          scanTime: Date.now() - startTime
        });
        
        this._saveToCache(textHash, result);
        return result;
      }
      
      // ═════════════════════════════════════════════════════════════════
      // STEP 5: MEDIUM CONFIDENCE - Verify with your AI service
      // ═════════════════════════════════════════════════════════════════
      
      console.log('🤖 Medium confidence - verifying with AI (Groq + Llama 3)...');
      this.stats.decidedByAI++;
      
      // ✅ Use YOUR existing AI validation service
      const aiResult = await this.ai.validateWithRegex(ocrResult.text, regexResult);
      
      console.log(`🤖 AI Decision: ${aiResult.decision}`);
      console.log(`📊 AI Confidence: ${aiResult.confidence}%`);
      console.log(`💭 AI Reasoning: ${aiResult.reasoning}`);
      
      const blocked = aiResult.decision === 'BLOCK';
      
      blocked ? this.stats.blocked++ : this.stats.allowed++;
      
      const result = this._createResult({
        valid: !blocked,
        blocked: blocked,
        action: aiResult.decision,
        reason: aiResult.reasoning,
        confidence: aiResult.confidence,
        ocrResult,
        regexResult,
        aiResult,
        violations: aiResult.violations || regexResult.violations,
        checkedBy: ['ocr', 'regex', 'ai'],
        scanTime: Date.now() - startTime
      });
      
      this._saveToCache(textHash, result);
      
      // Update avg time
      this._updateAvgTime(Date.now() - startTime);
      
      console.log(`${blocked ? '🚫 FINAL: BLOCKED' : '✅ FINAL: ALLOWED'}`);
      console.log(`⏱️  Total scan time: ${Date.now() - startTime}ms\n`);
      
      return result;
      
    } catch (error) {
      console.error('❌ Validation error:', error);
      
      // Fail-open: allow on error (but log for review)
      this.stats.allowed++;
      
      return this._createResult({
        valid: true,
        blocked: false,
        action: 'ALLOW',
        reason: 'Validation error - allowing image (logged for review)',
        confidence: 0,
        error: error.message,
        needsManualReview: true,
        scanTime: Date.now() - startTime
      });
    }
  }
  
  // ═══════════════════════════════════════════════════════════════════════════
  // BASIC VALIDATION
  // ═══════════════════════════════════════════════════════════════════════════
  
  _validateBasics(imageBuffer) {
    if (!imageBuffer || !Buffer.isBuffer(imageBuffer)) {
      return { valid: false, error: 'Invalid image buffer' };
    }
    
    if (imageBuffer.length < 100) {
      return { valid: false, error: 'Image file too small (likely corrupt)' };
    }
    
    const maxSize = 10 * 1024 * 1024; // 10MB
    if (imageBuffer.length > maxSize) {
      return { valid: false, error: 'Image exceeds maximum size (10MB)' };
    }
    
    const format = this._detectFormat(imageBuffer);
    const allowedFormats = ['jpg', 'jpeg', 'png', 'webp', 'gif'];
    
    if (!allowedFormats.includes(format)) {
      return { valid: false, error: `Unsupported image format: ${format}` };
    }
    
    return { valid: true };
  }
  
  _detectFormat(buffer) {
    const signatures = {
      'ffd8ff': 'jpg',
      '89504e47': 'png',
      '52494646': 'webp',
      '47494638': 'gif'
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
  // CACHING
  // ═══════════════════════════════════════════════════════════════════════════
  
  _hashText(text) {
    const normalized = text.toLowerCase().replace(/\s+/g, ' ').trim();
    return crypto.createHash('md5').update(normalized).digest('hex');
  }
  
  _checkCache(hash) {
    if (!this.cache.has(hash)) {
      return null;
    }
    
    const cached = this.cache.get(hash);
    
    // Check expiry
    if (Date.now() - cached.timestamp > this.config.cacheExpiry) {
      this.cache.delete(hash);
      return null;
    }
    
    return cached.result;
  }
  
  _saveToCache(hash, result) {
    // Limit cache size
    if (this.cache.size >= 1000) {
      const firstKey = this.cache.keys().next().value;
      this.cache.delete(firstKey);
    }
    
    this.cache.set(hash, {
      result: {
        valid: result.valid,
        blocked: result.blocked,
        action: result.action,
        reason: result.reason,
        confidence: result.confidence
      },
      timestamp: Date.now()
    });
  }
  
  // ═══════════════════════════════════════════════════════════════════════════
  // RESULT CREATION
  // ═══════════════════════════════════════════════════════════════════════════
  
  _createResult(data) {
    return {
      // Main decision
      valid: data.valid,
      blocked: data.blocked,
      action: data.action, // BLOCK, ALLOW, WARN
      reason: data.reason,
      confidence: data.confidence || 0,
      
      // Detailed results
      ocrResult: data.ocrResult || null,
      regexResult: data.regexResult || null,
      aiResult: data.aiResult || null,
      violations: data.violations || [],
      
      // Metadata
      checkedBy: data.checkedBy || [],
      scanTime: data.scanTime || 0,
      cached: data.cached || false,
      error: data.error || null,
      needsManualReview: data.needsManualReview || false,
      
      // System info
      validator: 'ImageValidator',
      version: '2.0.0',
      timestamp: new Date().toISOString()
    };
  }
  
  // ═══════════════════════════════════════════════════════════════════════════
  // STATISTICS
  // ═══════════════════════════════════════════════════════════════════════════
  
  _updateAvgTime(time) {
    const prev = this.stats.avgValidationTime;
    const count = this.stats.totalValidations;
    this.stats.avgValidationTime = (prev * (count - 1) + time) / count;
  }
  
  getStats() {
    const aiUsageRate = this.stats.totalValidations > 0
      ? ((this.stats.decidedByAI / this.stats.totalValidations) * 100).toFixed(1)
      : 0;
    
    const blockRate = this.stats.totalValidations > 0
      ? ((this.stats.blocked / this.stats.totalValidations) * 100).toFixed(1)
      : 0;
    
    const textDetectionRate = this.stats.totalValidations > 0
      ? ((this.stats.withText / this.stats.totalValidations) * 100).toFixed(1)
      : 0;
    
    return {
      totalValidations: this.stats.totalValidations,
      withText: this.stats.withText,
      withoutText: this.stats.withoutText,
      textDetectionRate: textDetectionRate + '%',
      decidedByRegex: this.stats.decidedByRegex,
      decidedByAI: this.stats.decidedByAI,
      cachedResults: this.stats.cached,
      blocked: this.stats.blocked,
      allowed: this.stats.allowed,
      blockRate: blockRate + '%',
      aiUsageRate: aiUsageRate + '%',
      avgValidationTime: Math.round(this.stats.avgValidationTime) + 'ms',
      cacheSize: this.cache.size,
      estimatedCost: '$0 (Groq free tier)'
    };
  }
  
  getHealth() {
    return {
      status: 'healthy',
      validator: 'ImageValidator',
      ready: true,
      ocrReady: this.ocr.getHealth().ready,
      aiProvider: 'Groq + Llama 3',
      aiModel: this.ai.model,
      regexPatterns: 'Ultra-Aggressive',
      cacheEnabled: this.config.enableCaching
    };
  }
  
  async shutdown() {
    console.log('[ImageValidator] Shutting down...');
    await this.ocr.shutdown();
    this.cache.clear();
    console.log('[ImageValidator] Shutdown complete');
  }
}

export default ImageValidator;