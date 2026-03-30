// src/services/moderation/AIEnhancedModerationSystem.js

import RulesScanner from './RulesScanner.js';
import OpenAIAnalyzer from './OpenAIAnalyzer.js';

/**
 * ═══════════════════════════════════════════════════════════════════
 *            ⭐ AI-ENHANCED MODERATION SYSTEM ⭐
 * ═══════════════════════════════════════════════════════════════════
 * Combines fast rule-based scanning + AI context analysis
 * 
 * FLOW:
 * 1. Rules Scanner (5ms) - catches obvious spam
 * 2. OpenAI Analyzer (800ms) - analyzes flagged cases
 * 3. Combined Decision - best of both worlds
 */

class AIEnhancedModerationSystem {
  constructor(config = {}) {
    this.rulesScanner = new RulesScanner();
    this.aiAnalyzer = new OpenAIAnalyzer(config.openaiApiKey);
    
    // ══════════════════════════════════════════════════════════════
    // CONFIGURATION
    // ══════════════════════════════════════════════════════════════
    this.config = {
      // When to use AI
      useAIFor: config.useAIFor || 'FLAGGED', // 'ALL', 'FLAGGED', 'NEVER'
      
      // AI decision weight (0 = ignore AI, 1 = trust AI completely)
      aiWeight: config.aiWeight || 0.7,
      
      // Minimum confidence to trust AI
      minAIConfidence: config.minAIConfidence || 70,
      
      // Enable async AI (don't block signup)
      asyncAI: config.asyncAI || true,
      
      // Logging
      logDecisions: config.logDecisions !== false,
      
      ...config
    };
  }

  // ═══════════════════════════════════════════════════════════════
  // MAIN CHECK FUNCTION
  // ═══════════════════════════════════════════════════════════════
  async checkBio(bio, options = {}) {
    const startTime = Date.now();
    const checkId = this.generateCheckId();

    // ═══════════════════════════════════════════════════════════
    // STEP 1: Rules Scanner (ALWAYS RUNS - Fast!)
    // ═══════════════════════════════════════════════════════════
    console.log(`[${checkId}] 🔍 Running rules scanner...`);
    const rulesResult = this.rulesScanner.scan(bio);
    
    console.log(`[${checkId}] ✅ Rules scan complete:`, {
      action: rulesResult.action,
      riskScore: rulesResult.riskScore,
      violations: rulesResult.violations.length,
      time: `${rulesResult.scanTime}ms`
    });

    // ═══════════════════════════════════════════════════════════
    // STEP 2: Decide if AI Review is Needed
    // ═══════════════════════════════════════════════════════════
    const needsAI = this.shouldUseAI(rulesResult);

    if (!needsAI) {
      // Rules decision is clear - no need for AI!
      return this.formatResponse({
        checkId,
        allowed: rulesResult.passed,
        action: rulesResult.action,
        confidence: rulesResult.confidence,
        decision: 'RULES_ONLY',
        rulesResult,
        aiResult: null,
        totalTime: Date.now() - startTime
      });
    }

    // ═══════════════════════════════════════════════════════════
    // STEP 3: AI Analysis (Only for flagged/suspicious content)
    // ═══════════════════════════════════════════════════════════
    console.log(`[${checkId}] 🤖 Sending to AI for analysis...`);
    
    const aiResult = await this.aiAnalyzer.analyze(bio, rulesResult);
    
    console.log(`[${checkId}] ✅ AI analysis complete:`, {
      classification: aiResult.classification,
      confidence: aiResult.confidence,
      isSpam: aiResult.isSpam,
      time: `${aiResult.scanTime}ms`,
      cost: aiResult.cost?.formatted
    });

    // ═══════════════════════════════════════════════════════════
    // STEP 4: Combine Results (Rules + AI)
    // ═══════════════════════════════════════════════════════════
    const finalDecision = this.combineResults(rulesResult, aiResult);

    console.log(`[${checkId}] 🎯 Final decision:`, finalDecision);

    return this.formatResponse({
      checkId,
      allowed: finalDecision.allowed,
      action: finalDecision.action,
      confidence: finalDecision.confidence,
      decision: 'RULES_AND_AI',
      rulesResult,
      aiResult,
      finalDecision,
      totalTime: Date.now() - startTime
    });
  }

  // ═══════════════════════════════════════════════════════════════
  // DECIDE IF AI IS NEEDED
  // ═══════════════════════════════════════════════════════════════
  shouldUseAI(rulesResult) {
    // User configured to never use AI
    if (this.config.useAIFor === 'NEVER') return false;
    
    // User configured to always use AI
    if (this.config.useAIFor === 'ALL') return true;

    // Default: Use AI only for flagged cases
    return rulesResult.action === 'FLAG' || rulesResult.needsAIReview;
  }

  // ═══════════════════════════════════════════════════════════════
  // COMBINE RULES + AI RESULTS
  // ═══════════════════════════════════════════════════════════════
  combineResults(rulesResult, aiResult) {
    // ═══════════════════════════════════════════════════════════
    // CASE 1: AI Failed (Use Rules Decision)
    // ═══════════════════════════════════════════════════════════
    if (aiResult.classification === 'UNKNOWN' || aiResult.error) {
      return {
        allowed: rulesResult.passed,
        action: rulesResult.action,
        confidence: rulesResult.confidence,
        method: 'RULES_FALLBACK',
        reason: 'AI analysis failed, using rules decision'
      };
    }

    // ═══════════════════════════════════════════════════════════
    // CASE 2: Both Agree (High Confidence)
    // ═══════════════════════════════════════════════════════════
    const rulesIsSpam = rulesResult.action === 'BLOCK';
    const aiIsSpam = aiResult.isSpam;

    if (rulesIsSpam === aiIsSpam) {
      return {
        allowed: !aiIsSpam,
        action: aiIsSpam ? 'BLOCK' : 'ALLOW',
        confidence: Math.max(rulesResult.confidence, aiResult.confidence),
        method: 'BOTH_AGREE',
        reason: aiIsSpam 
          ? 'Both rules and AI detected spam' 
          : 'Both rules and AI confirmed legitimate'
      };
    }

    // ═══════════════════════════════════════════════════════════
    // CASE 3: They Disagree (Use AI if confident)
    // ═══════════════════════════════════════════════════════════
    if (aiResult.confidence >= this.config.minAIConfidence) {
      // Trust AI's decision
      return {
        allowed: !aiResult.isSpam,
        action: aiResult.recommendation,
        confidence: aiResult.confidence,
        method: 'AI_OVERRIDE',
        reason: `AI ${aiResult.confidence}% confident: ${aiResult.reasoning}`
      };
    }

    // ═══════════════════════════════════════════════════════════
    // CASE 4: Low Confidence (Flag for Human Review)
    // ═══════════════════════════════════════════════════════════
    return {
      allowed: true, // ✅ Allow signup (don't block uncertain cases)
      action: 'FLAG',
      confidence: 50,
      method: 'UNCERTAIN',
      reason: 'Rules and AI disagree, flagging for human review',
      requiresReview: true
    };
  }

  // ═══════════════════════════════════════════════════════════════
  // FORMAT RESPONSE
  // ═══════════════════════════════════════════════════════════════
  formatResponse(data) {
    const response = {
      // ═══════════════════════════════════════════════════════════
      // SIMPLE FIELDS (For quick checks)
      // ═══════════════════════════════════════════════════════════
      allowed: data.allowed,
      action: data.action, // ALLOW, FLAG, BLOCK
      confidence: data.confidence,
      
      // ═══════════════════════════════════════════════════════════
      // DETAILED BREAKDOWN
      // ═══════════════════════════════════════════════════════════
      details: {
        checkId: data.checkId,
        decision: data.decision, // RULES_ONLY or RULES_AND_AI
        
        // Rules results
        rules: {
          action: data.rulesResult.action,
          riskScore: data.rulesResult.riskScore,
          confidence: data.rulesResult.confidence,
          violations: data.rulesResult.violations,
          scanTime: data.rulesResult.scanTime
        },
        
        // AI results (if used)
        ai: data.aiResult ? {
          classification: data.aiResult.classification,
          confidence: data.aiResult.confidence,
          isSpam: data.aiResult.isSpam,
          reasoning: data.aiResult.reasoning,
          scanTime: data.aiResult.scanTime,
          cost: data.aiResult.cost
        } : null,
        
        // Final decision
        final: data.finalDecision || {
          method: 'RULES_ONLY',
          reason: `Rules ${data.rulesResult.action} decision`
        }
      },
      
      // ═══════════════════════════════════════════════════════════
      // USER-FRIENDLY MESSAGE
      // ═══════════════════════════════════════════════════════════
      message: this.getUserMessage(data),
      
      // ═══════════════════════════════════════════════════════════
      // PERFORMANCE METRICS
      // ═══════════════════════════════════════════════════════════
      performance: {
        totalTime: data.totalTime,
        rulesTime: data.rulesResult.scanTime,
        aiTime: data.aiResult?.scanTime || 0,
        cost: data.aiResult?.cost?.formatted || '$0'
      }
    };

    // ═══════════════════════════════════════════════════════════
    // LOG DECISION (For Analysis/Improvement)
    // ═══════════════════════════════════════════════════════════
    if (this.config.logDecisions) {
      this.logDecision(response);
    }

    return response;
  }

  // ═══════════════════════════════════════════════════════════════
  // USER-FRIENDLY ERROR MESSAGES
  // ═══════════════════════════════════════════════════════════════
  getUserMessage(data) {
    if (data.allowed) {
      return 'Profile bio accepted';
    }

    if (data.action === 'FLAG') {
      return 'Your bio will be reviewed by our team';
    }

    // BLOCK message - be specific but friendly
    const topViolation = data.rulesResult.violations[0];
    
    if (topViolation?.type === 'PLATFORM_REDIRECT') {
      return `Please remove ${topViolation.platform} contact info. Keep conversations on our platform for your safety.`;
    }

    if (topViolation?.type === 'MULTIPLE_CONTACTS') {
      return 'Please remove external contact information from your bio. This helps keep our community safe.';
    }

    return 'Your bio contains content that violates our community guidelines. Please revise and try again.';
  }

  // ═══════════════════════════════════════════════════════════════
  // LOGGING & ANALYTICS
  // ═══════════════════════════════════════════════════════════════
  logDecision(response) {
    // TODO: Save to database for analysis
    console.log('[MODERATION]', {
      checkId: response.details.checkId,
      action: response.action,
      decision: response.details.decision,
      rulesScore: response.details.rules.riskScore,
      aiConfidence: response.details.ai?.confidence,
      totalTime: response.performance.totalTime,
      cost: response.performance.cost
    });
  }

  // ═══════════════════════════════════════════════════════════════
  // UTILITY: Generate unique check ID
  // ═══════════════════════════════════════════════════════════════
  generateCheckId() {
    return `mod_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}

export default AIEnhancedModerationSystem;