// Service/Security/ImageValidator.js

import OCRExtractor from '../../Utils/OCRExtractor.js';
import RegexPatterns from '../../Utils/RegexPatterns.js';
import ChatRegexPatterns from '../../Utils/ChatRegexPatterns.js';
import crypto from 'crypto';
import sharp from 'sharp';

class ImageValidator {
  
  // ═══════════════════════════════════════════════════════════════
  // ✅ SINGLETON - But looks like normal `new` usage
  // ═══════════════════════════════════════════════════════════════
  static #instance = null;
  
  constructor() {
    // If instance exists, return it (transparent singleton)
    if (ImageValidator.#instance) {
      return ImageValidator.#instance;
    }
    
    this.ocr = new OCRExtractor({
      quality: 'fast',
      preprocessImage: true
    });
    
    this.patterns = RegexPatterns;
    
    this.config = {
      minTextLength: 8,
      regexBlockThreshold: 40,
      enableCaching: true,
      cacheExpiry: 24 * 60 * 60 * 1000,
      normalizeWidth: 256,
      normalizeQuality: 70
    };
    
    this.stats = {
      totalValidations: 0,
      withText: 0,
      withoutText: 0,
      decidedByRegex: 0,
      cached: 0,
      blocked: 0,
      allowed: 0,
      avgValidationTime: 0
    };
    
    this.cache = new Map();
    
    // Lock this instance
    ImageValidator.#instance = this;
    
    console.log('🖼️ ImageValidator initialized (ZERO COST MODE - Regex + OCR Only)');
  }
  
  // ═══════════════════════════════════════════════════════════════
  // MAIN VALIDATION METHOD
  // ═══════════════════════════════════════════════════════════════
  
  async validate(imageBuffer, metadata = {}) {
    const startTime = Date.now();
    this.stats.totalValidations++;
    
    try {
      const context = metadata.isProfilePic ? 'Profile Pic' : 'Content';
      console.log(`\n🖼️ [Image Validation] User: ${metadata.userId || 'unknown'} | Type: ${context}`);
      
      // ═══════════════════════════════════════════════════════
      // STEP 1: Basic file validation
      // ═══════════════════════════════════════════════════════
      const basicCheck = this._validateBasics(imageBuffer);
      if (!basicCheck.valid) {
        this.stats.blocked++;
        return this._createResult({
          valid: false, blocked: true, action: 'BLOCK',
          reason: basicCheck.error, confidence: 100,
          checkedBy: ['basic'], scanTime: Date.now() - startTime
        });
      }
      
      // ═══════════════════════════════════════════════════════
      // STEP 2: ✅ Normalize image for consistent hash
      // ═══════════════════════════════════════════════════════
      let normalizedBuffer;
      try {
        normalizedBuffer = await sharp(imageBuffer)
          .resize(this.config.normalizeWidth, this.config.normalizeWidth, {
            fit: 'inside',
            withoutEnlargement: true
          })
          .jpeg({ quality: this.config.normalizeQuality })
          .toBuffer();
      } catch (normalizeError) {
        console.warn('⚠️ Normalization failed, using original:', normalizeError.message);
        normalizedBuffer = imageBuffer;
      }
      
      // ═══════════════════════════════════════════════════════
      // STEP 3: Hash normalized image
      // ═══════════════════════════════════════════════════════
      const imageHash = this._hashImage(normalizedBuffer);
      
      if (this.config.enableCaching) {
        const cached = this._checkCache(imageHash);
        if (cached) {
          console.log('💾 Using cached result (normalized hash)');
          this.stats.cached++;
          cached.blocked ? this.stats.blocked++ : this.stats.allowed++;
          return this._createResult({ 
            ...cached, 
            cached: true, 
            scanTime: Date.now() - startTime 
          });
        }
      }
      
      // ═══════════════════════════════════════════════════════
      // STEP 4: OCR - Extract text (use original for quality)
      // ═══════════════════════════════════════════════════════
      console.log('📝 Extracting text with OCR...');
      const ocrResult = await this.ocr.extractText(imageBuffer);
      
      if (!ocrResult.text || ocrResult.text.length < this.config.minTextLength) {
        console.log('✅ No text detected - ALLOWED');
        this.stats.withoutText++;
        this.stats.allowed++;
        
        const result = this._createResult({
          valid: true, blocked: false, action: 'ALLOW',
          reason: 'No significant text detected', confidence: 0,
          ocrResult, checkedBy: ['ocr'], scanTime: Date.now() - startTime
        });
        
        this._saveToCache(imageHash, result);
        return result;
      }
      
      this.stats.withText++;
      console.log(`📄 Text extracted: ${ocrResult.characterCount} chars`);
      
      // ═══════════════════════════════════════════════════════
      // STEP 5: REGEX CHECK
      // ═══════════════════════════════════════════════════════
          // ═══════════════════════════════════════════════════════
      // STEP 5: DUAL-REGEX FALLBACK (Fast + Strict)
      // ═══════════════════════════════════════════════════════
      console.log('🔍 Running dual-regex checks...');
      
      // Pass 1: Fast Chat Regex (catches garbled OCR like "«000 3८ 5678")
      const chatRegexResult = ChatRegexPatterns.validateChatMessage(ocrResult.text, 'image_ocr');
      
      let finalResult = chatRegexResult.blocked 
        ? { blocked: true, confidence: 100, violations: [{ type: 'chat_regex', reason: chatRegexResult.reason }] }
        : null;

      // Pass 2: Strict Regex (only runs if Pass 1 missed it)
      if (!finalResult?.blocked) {
        const strictRegexResult = this.patterns.checkAll(ocrResult.text);
        if (strictRegexResult.confidence >= this.config.regexBlockThreshold) {
          finalResult = { 
            blocked: true, 
            confidence: strictRegexResult.confidence, 
            violations: strictRegexResult.violations 
          };
        }
      }

      const blocked = finalResult?.blocked || false;
      this.stats.decidedByRegex++;
      
      if (blocked) {
        console.log(`🚫 BLOCKED by Dual-Regex (Confidence: ${finalResult.confidence}%)`);
        this.stats.blocked++;
      } else {
        console.log(`✅ ALLOWED by Dual-Regex (Confidence: 0%)`);
        this.stats.allowed++;
      }
      
      const result = this._createResult({
        valid: !blocked,
        blocked,
        action: blocked ? 'BLOCK' : 'ALLOW',
        reason: blocked ? 'Contact information detected in image' : 'No clear violations detected',
        confidence: finalResult?.confidence || 0,
        ocrResult,
        regexResult: finalResult,
        violations: finalResult?.violations || [],
        checkedBy: ['ocr', 'dual-regex'],
        scanTime: Date.now() - startTime
      });
      
      this._saveToCache(imageHash, result);
      this._updateAvgTime(Date.now() - startTime);
      
      return result;
      
    } catch (error) {
      console.error('❌ Validation error:', error);
      this.stats.allowed++;
      
      return this._createResult({
        valid: true, blocked: false, action: 'ALLOW',
        reason: 'Validation error - allowing image (logged)', confidence: 0,
        error: error.message, needsManualReview: true,
        scanTime: Date.now() - startTime
      });
    }
  }
  
  // ═══════════════════════════════════════════════════════════════
  // PRIVATE HELPERS
  // ═══════════════════════════════════════════════════════════════
  
  _validateBasics(imageBuffer) {
    if (!imageBuffer || !Buffer.isBuffer(imageBuffer)) return { valid: false, error: 'Invalid image buffer' };
    if (imageBuffer.length < 100) return { valid: false, error: 'Image file too small' };
    if (imageBuffer.length > 10 * 1024 * 1024) return { valid: false, error: 'Image exceeds 10MB' };
    
    const format = this._detectFormat(imageBuffer);
    if (!['jpg', 'jpeg', 'png', 'webp', 'gif'].includes(format)) return { valid: false, error: `Unsupported format: ${format}` };
    return { valid: true };
  }
  
  _detectFormat(buffer) {
    const sigs = { 'ffd8ff': 'jpg', '89504e47': 'png', '52494646': 'webp', '47494638': 'gif' };
    const header = buffer.toString('hex', 0, 4);
    for (const [sig, fmt] of Object.entries(sigs)) { if (header.startsWith(sig)) return fmt; }
    return 'unknown';
  }
  
  _hashImage(buffer) {
    return crypto.createHash('sha256').update(buffer).digest('hex');
  }
  
  _checkCache(hash) {
    if (!this.cache.has(hash)) return null;
    const cached = this.cache.get(hash);
    if (Date.now() - cached.timestamp > this.config.cacheExpiry) { 
      this.cache.delete(hash); 
      return null; 
    }
    return cached.result;
  }
  
_saveToCache(hash, result) {
  if (result.blocked) return;  // ← added

  if (this.cache.size >= 1000) {
    const firstKey = this.cache.keys().next().value;
    this.cache.delete(firstKey);
  }
  this.cache.set(hash, { 
    result: { 
      valid:      result.valid, 
      blocked:    result.blocked, 
      action:     result.action, 
      reason:     result.reason, 
      confidence: result.confidence 
    }, 
    timestamp: Date.now() 
  });
}
  
  _createResult(data) {
    return {
      valid: data.valid, 
      blocked: data.blocked, 
      action: data.action, 
      reason: data.reason, 
      confidence: data.confidence || 0,
      ocrResult: data.ocrResult || null, 
      regexResult: data.regexResult || null, 
      violations: data.violations || [],
      checkedBy: data.checkedBy || [], 
      scanTime: data.scanTime || 0, 
      cached: data.cached || false,
      error: data.error || null, 
      needsManualReview: data.needsManualReview || false,
      validator: 'ImageValidator', 
      version: '3.2.0-SingletonHidden', 
      timestamp: new Date().toISOString()
    };
  }
  
  _updateAvgTime(time) {
    const prev = this.stats.avgValidationTime;
    const count = this.stats.totalValidations;
    this.stats.avgValidationTime = (prev * (count - 1) + time) / count;
  }
  
  getStats() {
    return {
      ...this.stats,
      mode: 'REGEX_ONLY',
      estimatedCost: '$0.00',
      blockRate: ((this.stats.blocked / (this.stats.totalValidations || 1)) * 100).toFixed(1) + '%'
    };
  }
  
  getHealth() {
    return { 
      status: 'healthy', 
      validator: 'ImageValidator', 
      ready: true, 
      ocrReady: this.ocr.getHealth().ready, 
      mode: 'ZERO_COST_REGEX'
    };
  }
  
  async shutdown() {
    console.log('[ImageValidator] Shutting down...');
    await this.ocr.shutdown();
    this.cache.clear();
    ImageValidator.#instance = null;
  }
}

// ✅ Export as CLASS (old way) — `new` works but returns singleton
export default ImageValidator;