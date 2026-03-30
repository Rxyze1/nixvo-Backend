// utils/RegexPatterns.js

/**
 * ════════════════════════════════════════════════════════════════
 *              🔍 REGEX PATTERNS - ULTRA AGGRESSIVE
 *          Zero False Negatives | No Professional Exceptions
 * ════════════════════════════════════════════════════════════════
 */

class RegexPatterns {
  
  constructor() {
    
    // ═══════════════════════════════════════════════════════════════
    // PHONE NUMBERS
    // ═══════════════════════════════════════════════════════════════
    
    this.phone = new RegExp([
      '\\+?91[\\s\\-]?[6-9]\\d{9}',
      '\\+\\d{1,4}[\\s\\-]?\\(?\\d{1,4}\\)?[\\s\\-]?\\d{1,4}[\\s\\-]?\\d{1,9}',
      '\\(?\\d{3}\\)?[\\s\\-]?\\d{3}[\\s\\-]?\\d{4}',
      '\\b\\d{10,15}\\b',
    ].join('|'), 'gi');
    
    // ═══════════════════════════════════════════════════════════════
    // EMAIL
    // ═══════════════════════════════════════════════════════════════
    
    this.email = new RegExp([
      '[a-z0-9._%+\\-]+@[a-z0-9.\\-]+\\.[a-z]{2,}',
      '[a-z0-9._%+\\-]+\\s*[\\[\\(]\\s*at\\s*[\\]\\)]\\s*[a-z0-9.\\-]+',
    ].join('|'), 'gi');
    
    // ═══════════════════════════════════════════════════════════════
    // URLs & DOMAINS (COMPREHENSIVE!)
    // ═══════════════════════════════════════════════════════════════
    
    this.url = new RegExp([
      // Standard URLs
      'https?:\\/\\/[^\\s]+',
      'www\\.[a-z0-9\\-]+\\.[a-z]{2,}',
      
      // ANY domain with TLD (THIS IS KEY!)
      '\\b[a-z0-9][a-z0-9\\-]{0,61}[a-z0-9]\\.[a-z]{2,}(?:\\.[a-z]{2,})?\\b',
      // Matches: wwe.rohan.in, example.com, sub.example.co.uk
      
      // Obfuscated
      '[a-z0-9\\-]+\\s*\\(\\s*dot\\s*\\)\\s*(?:com|net|org|io|in)',
      
    ].join('|'), 'gi');
    
    // ═══════════════════════════════════════════════════════════════
    // SOCIAL MEDIA HANDLES
    // ═══════════════════════════════════════════════════════════════
    
    this.socialMedia = new RegExp([
      '@[a-z0-9._]{3,30}\\b',
      '\\big_[a-z0-9._]{2,30}\\b',
      '\\binsta_[a-z0-9._]{2,30}\\b',
      't\\.me\\/[a-z0-9_]{3,}',
      'wa\\.me\\/\\d{10,}',
    ].join('|'), 'gi');
    
    // ═══════════════════════════════════════════════════════════════
    // OFF-PLATFORM COMMUNICATION (ULTRA AGGRESSIVE!)
    // ═══════════════════════════════════════════════════════════════
    
    this.offPlatform = new RegExp([
      // "lets talk in/on [app]"
      '(?:let\'?s?|we\\s+should|can\\s+we|shall\\s+we)\\s+(?:talk|chat|discuss|connect|message)\\s+(?:in|on|via|through|over|using)\\s+(?:telegram|whatsapp|discord|signal|wechat|snapchat|instagram|facebook|messenger)',
      
      // "talk in/on [app]"
      '(?:talk|chat|discuss|message|contact|reach)\\s+(?:in|on|via|through|over|using)\\s+(?:telegram|whatsapp|discord|signal|wechat)',
      
      // "contact me on [app]"
      '(?:contact|reach|find|message|text|add|dm|pm)\\s+(?:me|us)\\s+(?:on|via|in|through|at)\\s+(?:telegram|whatsapp|discord|signal|instagram|facebook)',
      
      // "outside" mentions
      '(?:talk|chat|discuss|message|contact)\\s+(?:outside|elsewhere|off)(?:\\s+(?:the\\s+)?(?:app|platform|here|this))?',
      
      // DM without context
      '\\b(?:dm|pm)\\s+(?:me|us)\\b',
      
    ].join('|'), 'gi');
    
    // ═══════════════════════════════════════════════════════════════
    // MESSAGING APPS (Standalone detection)
    // ═══════════════════════════════════════════════════════════════
    
    this.messagingApps = new RegExp([
      // Telegram with action context
      '(?:in|on|via|through|using)\\s+telegram\\b',
      'telegram\\s+(?:me|us|chat|group|channel)',
      
      // WhatsApp
      '(?:in|on|via|through)\\s+whatsapp\\b',
      'whatsapp\\s+(?:me|us|chat)',
      
      // Discord
      '(?:in|on|via)\\s+discord\\b',
      'discord\\s+(?:me|us|chat|server)',
      
      // Signal
      '(?:in|on|via)\\s+signal\\b',
      
    ].join('|'), 'gi');
    
    console.log('✅ RegexPatterns initialized - ULTRA AGGRESSIVE MODE');
  }
  
  // ═══════════════════════════════════════════════════════════════
  // ✅ FIXED: CHECK ALL - Returns correct format for validationService
  // ═══════════════════════════════════════════════════════════════
  
  checkAll(text) {
    if (!text || typeof text !== 'string') {
      return {
        confidence: 0,
        reasons: [],
        matched: [],
        violations: []
      };
    }
    
    const violations = [];
    const reasons = [];
    const matched = [];
    let maxConfidence = 0;
    
    console.log('🔍 Checking:', text.substring(0, 100) + '...');
    
    // ═══════════════════════════════════════════════════════════════
    // NO PROFESSIONAL CONTEXT BYPASS!
    // Check EVERYTHING regardless of professional keywords
    // ═══════════════════════════════════════════════════════════════
    
    // Check phone
    const phoneMatches = text.match(this.phone);
    if (phoneMatches) {
      console.log('🚨 PHONE detected:', phoneMatches);
      violations.push({ 
        type: 'PHONE_NUMBER', 
        confidence: 100,
        matches: phoneMatches
      });
      reasons.push('Phone number detected');
      matched.push('PHONE');
      maxConfidence = 100;
    }
    
    // Check email
    const emailMatches = text.match(this.email);
    if (emailMatches) {
      console.log('🚨 EMAIL detected:', emailMatches);
      violations.push({ 
        type: 'EMAIL', 
        confidence: 100,
        matches: emailMatches
      });
      reasons.push('Email address detected');
      matched.push('EMAIL');
      maxConfidence = 100;
    }
    
    // Check URL (ALWAYS!)
    const urlMatches = text.match(this.url);
    if (urlMatches) {
      console.log('🚨 URL detected:', urlMatches);
      violations.push({ 
        type: 'URL', 
        confidence: 100,
        matches: urlMatches
      });
      reasons.push('External URL detected');
      matched.push('URL');
      maxConfidence = 100;
    }
    
    // Check social media
    const socialMatches = text.match(this.socialMedia);
    if (socialMatches) {
      console.log('🚨 SOCIAL_MEDIA detected:', socialMatches);
      violations.push({ 
        type: 'SOCIAL_MEDIA', 
        confidence: 90,
        matches: socialMatches
      });
      reasons.push('Social media handle detected');
      matched.push('SOCIAL_MEDIA');
      maxConfidence = Math.max(maxConfidence, 90);
    }
    
    // Check off-platform (ALWAYS!)
    const offPlatformMatches = text.match(this.offPlatform);
    if (offPlatformMatches) {
      console.log('🚨 OFF_PLATFORM detected:', offPlatformMatches);
      violations.push({ 
        type: 'OFF_PLATFORM', 
        confidence: 95,
        matches: offPlatformMatches
      });
      reasons.push('Off-platform communication detected');
      matched.push('OFF_PLATFORM');
      maxConfidence = Math.max(maxConfidence, 95);
    }
    
    // Check messaging apps (ALWAYS!)
    const appMatches = text.match(this.messagingApps);
    if (appMatches) {
      console.log('🚨 MESSAGING_APP detected:', appMatches);
      violations.push({ 
        type: 'MESSAGING_APP', 
        confidence: 90,
        matches: appMatches
      });
      reasons.push('Messaging app mention detected');
      matched.push('MESSAGING_APP');
      maxConfidence = Math.max(maxConfidence, 90);
    }
    
    if (violations.length === 0) {
      console.log('✅ No violations found');
    } else {
      console.log('🚨 Total violations:', violations.length);
    }
    
    // ✅ RETURN FORMAT COMPATIBLE WITH validationService.js
    return {
      confidence: maxConfidence,      // Number (0-100)
      reasons: reasons,                // Array of strings
      matched: matched,                // Array of violation types
      violations: violations,          // Full violation details
      isProfessional: false            // We don't care anymore!
    };
  }
  
  // ═══════════════════════════════════════════════════════════════
  // EXTRACT MATCHES
  // ═══════════════════════════════════════════════════════════════
  
  extractMatches(text) {
    if (!text || typeof text !== 'string') {
      return {};
    }
    
    return {
      phones: text.match(this.phone) || [],
      emails: text.match(this.email) || [],
      urls: text.match(this.url) || [],
      socialMedia: text.match(this.socialMedia) || [],
      offPlatform: text.match(this.offPlatform) || [],
      messagingApps: text.match(this.messagingApps) || []
    };
  }
}

// ✅ EXPORT AS SINGLETON INSTANCE (not the class!)
export default new RegexPatterns();