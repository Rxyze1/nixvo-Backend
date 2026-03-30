/**
 * ═══════════════════════════════════════════════════════════════════════════
 *                          📝 TEXT SCANNER
 *                   Evidence Collector for Text Content
 * ═══════════════════════════════════════════════════════════════════════════
 * 
 * Responsibilities:
 * - Layer 1: Fast regex checking (1ms) - catches obvious violations
 * - Layer 2: AI verification (500ms) - for suspicious content
 * - Returns EVIDENCE to ModerationController (does not make final decision)
 * 
 * Performance:
 * - 90% of messages: <1ms (regex only)
 * - 10% of messages: ~500ms (regex + AI)
 * 
 * Usage:
 *   const scanner = new TextScanner(aiChecker);
 *   const evidence = await scanner.scan("Message text here");
 * 
 * ═══════════════════════════════════════════════════════════════════════════
 */

import Llama3Checker from '../ai/Llama3Checker.js';

// Import Regex patterns
import RegexPatterns from '../utils/RegexPatterns.js';

class TextScanner {
  
  constructor(aiChecker) {
    
    // Validate AI checker
    if (!aiChecker || !(aiChecker instanceof Llama3Checker)) {
      throw new Error('TextScanner requires a valid Llama3Checker instance');
    }
    
    this.ai = aiChecker;
    this.patterns = new RegexPatterns();
    
    // Statistics
    this.stats = {
      totalScans: 0,
      regexBlocks: 0,
      aiChecks: 0,
      avgScanTime: 0,
      fastPathRate: 0
    };
    
    console.log('📝 TextScanner initialized');
  }
  
  // ═══════════════════════════════════════════════════════════════════════════
  // MAIN SCAN METHOD (Entry Point)
  // ═══════════════════════════════════════════════════════════════════════════
  
  /**
   * Scan text and return evidence (not final decision)
   * @param {string} text - Text to scan
   * @param {object} options - Additional options (userId, context, etc.)
   * @returns {Promise<object>} - Evidence object
   */
  async scan(text, options = {}) {
    const startTime = Date.now();
    this.stats.totalScans++;
    
    try {
      
      // ═══════════════════════════════════════════════════════════════════
      // STEP 1: Input Validation
      // ═══════════════════════════════════════════════════════════════════
      
      const validation = this._validateInput(text);
      if (!validation.valid) {
        return this._createEvidence({
          error: validation.error,
          scanTime: Date.now() - startTime
        });
      }
      
      // ═══════════════════════════════════════════════════════════════════
      // STEP 2: Text Normalization (for better detection)
      // ═══════════════════════════════════════════════════════════════════
      
      const normalizedText = this._normalizeText(text);
      
      // ═══════════════════════════════════════════════════════════════════
      // STEP 3: LAYER 1 - Fast Regex Check (~1ms)
      // ═══════════════════════════════════════════════════════════════════
      
      const regexResult = this.patterns.checkAll(normalizedText);
      
      console.log(
        `[TextScanner] Regex check: ${regexResult.violations.length} violations, ` +
        `confidence ${regexResult.confidence}%`
      );
      
      // ═══════════════════════════════════════════════════════════════════
      // DECISION POINT: Should we check with AI?
      // ═══════════════════════════════════════════════════════════════════
      
      const needsAICheck = this._shouldCheckWithAI(regexResult, options);
      
      if (!needsAICheck) {
        // Fast path - regex evidence is enough
        this.stats.fastPathRate = (this.stats.regexBlocks / this.stats.totalScans) * 100;
        
        return this._createEvidence({
          regexResult,
          aiResult: null,
          checkedBy: ['regex'],
          scanTime: Date.now() - startTime,
          fastPath: true
        });
      }
      
      // ═══════════════════════════════════════════════════════════════════
      // STEP 4: LAYER 2 - AI Check (~500ms)
      // ═══════════════════════════════════════════════════════════════════
      
      console.log('[TextScanner] Suspicious content - checking with AI...');
      this.stats.aiChecks++;
      
      const aiResult = await this._checkWithAI(normalizedText, regexResult, options);
      
      // ═══════════════════════════════════════════════════════════════════
      // STEP 5: Return Combined Evidence
      // ═══════════════════════════════════════════════════════════════════
      
      const scanTime = Date.now() - startTime;
      this._updateStats(scanTime);
      
      return this._createEvidence({
        regexResult,
        aiResult,
        checkedBy: ['regex', 'ai'],
        scanTime,
        fastPath: false
      });
      
    } catch (error) {
      console.error('[TextScanner] Error during scan:', error);
      
      return this._createEvidence({
        error: error.message,
        scanTime: Date.now() - startTime
      });
    }
  }
  
  // ═══════════════════════════════════════════════════════════════════════════
  // PRIVATE METHODS - INPUT VALIDATION
  // ═══════════════════════════════════════════════════════════════════════════
  
  _validateInput(text) {
    // Empty text
    if (!text) {
      return { valid: false, error: 'Empty text provided' };
    }
    
    // Not a string
    if (typeof text !== 'string') {
      return { valid: false, error: 'Text must be a string' };
    }
    
    // Too short (less than 2 characters)
    if (text.trim().length < 2) {
      return { valid: false, error: 'Text too short to moderate' };
    }
    
    // Too long (more than 10,000 characters - potential DOS)
    if (text.length > 10000) {
      return { valid: false, error: 'Text exceeds maximum length (10,000 chars)' };
    }
    
    return { valid: true };
  }
  
  // ═══════════════════════════════════════════════════════════════════════════
  // PRIVATE METHODS - TEXT NORMALIZATION
  // ═══════════════════════════════════════════════════════════════════════════
  
  _normalizeText(text) {
    return text
      // Remove excessive whitespace
      .replace(/\s+/g, ' ')
      // Remove zero-width characters (obfuscation technique)
      .replace(/[\u200B-\u200D\uFEFF]/g, '')
      // Trim
      .trim();
  }
  
  // ═══════════════════════════════════════════════════════════════════════════
  // PRIVATE METHODS - AI DECISION LOGIC
  // ═══════════════════════════════════════════════════════════════════════════
  
  _shouldCheckWithAI(regexResult, options) {
    const { confidence, violations } = regexResult;
    
    // HIGH CONFIDENCE (95-100%) - Don't need AI, regex is certain
    if (confidence >= 95) {
      this.stats.regexBlocks++;
      return false;
    }
    
    // VERY LOW CONFIDENCE (0-39%) - Clean message, don't waste AI resources
    if (confidence < 40) {
      return false;
    }
    
    // MEDIUM CONFIDENCE (40-94%) - Need AI verification
    // This is the "suspicious but not certain" zone
    return true;
  }
  
  // ═══════════════════════════════════════════════════════════════════════════
  // PRIVATE METHODS - AI INTEGRATION
  // ═══════════════════════════════════════════════════════════════════════════
  
  async _checkWithAI(text, regexResult, options) {
    try {
      
      // Build context for AI
      const context = {
        regexFound: regexResult.violations.map(v => v.type).join(', '),
        regexConfidence: regexResult.confidence,
        userContext: options.userContext || null
      };
      
      // Call AI (Llama3Checker handles queueing, retries, etc.)
      const aiResult = await this.ai.checkText(text, context);
      
      console.log(
        `[TextScanner] AI verdict: ${aiResult.blocked ? 'BLOCK' : 'ALLOW'} ` +
        `(confidence: ${aiResult.confidence}%, duration: ${aiResult.duration}ms)`
      );
      
      return aiResult;
      
    } catch (error) {
      console.error('[TextScanner] AI check failed:', error.message);
      
      // AI failed - return error result (Controller will decide what to do)
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
      // Regex results
      regexResult: data.regexResult || { violations: [], confidence: 0 },
      
      // AI results
      aiResult: data.aiResult || null,
      
      // Metadata
      checkedBy: data.checkedBy || ['none'],
      scanTime: data.scanTime || 0,
      fastPath: data.fastPath || false,
      error: data.error || null,
      
      // Scanner identification
      scanner: 'TextScanner',
      version: '1.0.0',
      timestamp: new Date().toISOString()
    };
  }
  
  // ═══════════════════════════════════════════════════════════════════════════
  // PRIVATE METHODS - STATISTICS
  // ═══════════════════════════════════════════════════════════════════════════
  
  _updateStats(scanTime) {
    // Update average scan time (moving average)
    const prevAvg = this.stats.avgScanTime;
    const count = this.stats.totalScans;
    this.stats.avgScanTime = (prevAvg * (count - 1) + scanTime) / count;
  }
  
  // ═══════════════════════════════════════════════════════════════════════════
  // PUBLIC API - STATISTICS & HEALTH
  // ═══════════════════════════════════════════════════════════════════════════
  
  /**
   * Get scanner statistics
   * @returns {object} - Statistics object
   */
  getStats() {
    return {
      totalScans: this.stats.totalScans,
      regexBlocks: this.stats.regexBlocks,
      aiChecks: this.stats.aiChecks,
      avgScanTime: Math.round(this.stats.avgScanTime) + 'ms',
      fastPathRate: this.stats.fastPathRate.toFixed(2) + '%',
      aiUsageRate: ((this.stats.aiChecks / this.stats.totalScans) * 100).toFixed(2) + '%'
    };
  }
  
  /**
   * Get health status
   * @returns {object} - Health information
   */
  getHealth() {
    return {
      status: 'healthy',
      scanner: 'TextScanner',
      ready: true,
      aiConnected: this.ai ? true : false
    };
  }
  
  /**
   * Reset statistics (for testing)
   */
  resetStats() {
    this.stats = {
      totalScans: 0,
      regexBlocks: 0,
      aiChecks: 0,
      avgScanTime: 0,
      fastPathRate: 0
    };
    
    console.log('[TextScanner] Statistics reset');
  }
}

export default TextScanner;