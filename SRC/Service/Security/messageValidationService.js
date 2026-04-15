// Services/Chat/messageValidationService.js

import ChatRegexPatterns from "../../Utils/ChatRegexPatterns.js";

/**
 * ════════════════════════════════════════════════════════════════
 *              💬 MESSAGE VALIDATION SERVICE
 *   Orchestrator using ChatRegexPatterns (NLP + Strict Regex)
 * ════════════════════════════════════════════════════════════════
 */

class MessageValidationService {
  
  constructor() {
    this.chatRegex = ChatRegexPatterns; // ✅ Bind the new engine
    console.log('💬 Message Validation Service initialized');
    console.log('   Mode: Multi-Language NLP + Strict Regex (ZERO COST)');
  }

  // ═══════════════════════════════════════════════════════════════
  // 📝 MAIN VALIDATION - FOR CHAT MESSAGES
  // ═══════════════════════════════════════════════════════════════
  
  // ═══════════════════════════════════════════════════════════════
  // 📝 MAIN VALIDATION - FOR CHAT MESSAGES
  // ═══════════════════════════════════════════════════════════════
  
  async validateMessage(text, userId = 'anonymous') { // <--- ADDED userId HERE
    console.log(`💬 [Message Validation] Starting...`);
    console.log(`   📝 Text: "${text.substring(0, 50)}..."`);
    
    try {
      // PASS userId TO THE ENGINE
      const result = this.chatRegex.validateChatMessage(text, userId); // <--- ADDED userId HERE

      if (result.blocked) {
        console.log(`   🚫 BLOCKED: ${result.type} - ${result.reason}`);
        return {
          allowed: false,
          blocked: true,
          reason: result.reason,
          warning: result.reason,
          action: 'BLOCK',
          layer: `regex_${result.type?.toLowerCase()}`,
          cached: false
        };
      }
      
      console.log(`   ✅ APPROVED: ${result.type}`);
      
      return {
        allowed: true,
        blocked: false,
        warning: result.warning || null,
        reason: result.reason,
        hasLinks: !!result.warning,
        cloudLinks: result.type === 'ALLOW_LINKS' ? true : false,
        unknownLinks: [],
        action: result.type === 'ALLOW_LINKS' ? 'ALLOW_CLOUD_LINKS' : 'ALLOW',
        layer: result.type === 'ALLOW_LINKS' ? 'allowed_link_fast_path' : 'regex_pass',
        cached: false
      };
      
    } catch (error) {
      console.error('   ❌ Message validation error:', error);
      return {
        allowed: true,
        blocked: false,
        warning: '⚠️ Message sent but flagged for review',
        reason: 'Validation error - message allowed but logged',
        error: error.message,
        needsReview: true,
        action: 'ALLOW_WITH_FLAG'
      };
    }
  }
  // ═══════════════════════════════════════════════════════════════
  // 📊 GET STATISTICS
  // ═══════════════════════════════════════════════════════════════
  
  getStats() {
    return {
      mode: 'MULTI_LANGUAGE_REGEX',
      cost: '$0.00',
      timestamp: new Date().toISOString()
    };
  }

  // ═══════════════════════════════════════════════════════════════
  // 🏥 HEALTH CHECK
  // ═══════════════════════════════════════════════════════════════
  
  async getHealth() {
    return {
      status: 'healthy',
      ready: true,
      mode: 'MULTI_LANGUAGE_REGEX',
      timestamp: new Date().toISOString()
    };
  }

  // ═══════════════════════════════════════════════════════════════
  // 🧹 CLEAR CACHE
  // ═══════════════════════════════════════════════════════════════
  
  clearCache() {
    console.log('🧹 Message validation cache cleared');
  }
}

export default new MessageValidationService();