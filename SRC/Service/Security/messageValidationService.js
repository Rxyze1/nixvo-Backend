// Services/Chat/messageValidationService.js

import chatAIValidationService from '../../ai/chatAIValidationService.js';  // ✅ CHANGED

/**
 * ════════════════════════════════════════════════════════════════
 *              💬 MESSAGE VALIDATION SERVICE
 *     Chat-specific validation with cloud link support & AI integration
 * ════════════════════════════════════════════════════════════════
 */

class MessageValidationService {
  
  constructor() {
    console.log('💬 Message Validation Service initialized');
    console.log('   Mode: AI-Powered (Chat-Optimized) with Cloud Link Override');
  }

  // ═══════════════════════════════════════════════════════════════
  // 🔗 CLOUD STORAGE DOMAINS (ALLOWED)
  // ═══════════════════════════════════════════════════════════════
  
  ALLOWED_CLOUD_SERVICES = [
    'drive.google.com',
    'docs.google.com',
    'sheets.google.com',
    'slides.google.com',
    'forms.google.com',
    'drive.google',
    'dropbox.com',
    'dl.dropboxusercontent.com',
    'www.dropbox.com',
    'onedrive.live.com',
    '1drv.ms',
    'sharepoint.com',
    'wetransfer.com',
    'we.tl',
    'mega.nz',
    'mega.io',
    'box.com',
    'mediafire.com',
    'sendspace.com',
    'filemail.com',
    'transfernow.net',
    'smash.com',
    'gofile.io',
    'anonfiles.com',
    'temp.sh',
    'catbox.moe'
  ];




  // ═══════════════════════════════════════
// UPI HANDLE CHECK — runs FIRST
// ═══════════════════════════════════════
 upiHandles = [
  '@ybl', '@okaxis', '@okhdfcbank', '@okicici', 
  '@paytm', '@ibl', '@axl', '@upi', '@apl',
  '@waicici', '@wahdfcbank', '@oksbi', '@ptyes',
  '@ptsbi', '@pthdfc', '@ptaxis', '@amazonpay',
  '@freecharge', '@mobikwik', '@icici', '@hdfc',
  '@sbi', '@kotak', '@indus', '@rbl', '@yes'
];


  // ═══════════════════════════════════════════════════════════════
  // 🚫 BLOCKED DOMAINS (Social Media & Messaging)
  // ═══════════════════════════════════════════════════════════════
  
  BLOCKED_SERVICES = [
    'whatsapp.com',
    'wa.me',
    'telegram.org',
    't.me',
    'discord.com',
    'discord.gg',
    'skype.com',
    'snapchat.com',
    'tiktok.com',
    'instagram.com',
    'facebook.com',
    'fb.com',
    'fb.me',
    'messenger.com',
    'wechat.com',
    'line.me',
    'viber.com',
    'signal.org',
    'twitter.com',
    'x.com'
  ];

  // ═══════════════════════════════════════════════════════════════
  // 🔍 EXTRACT AND CLASSIFY URLs
  // ═══════════════════════════════════════════════════════════════
  
  extractAndClassifyUrls(text) {
    // Extract URLs using multiple patterns
    const urlPatterns = [
      /(https?:\/\/[^\s]+)/gi,
      /(www\.[^\s]+)/gi,
      /([a-zA-Z0-9-]+\.(com|org|net|io|me|co|in|xyz|app|dev|ai|tv|cc|biz|live|nz)[^\s]*)/gi
    ];
    
    const foundUrls = new Set();
    
    for (const pattern of urlPatterns) {
      const matches = text.match(pattern) || [];
      matches.forEach(url => {
        // Normalize URL
        let normalizedUrl = url.toLowerCase().trim();
        
        // Add https if missing
        if (!normalizedUrl.startsWith('http')) {
          normalizedUrl = 'https://' + normalizedUrl.replace(/^www\./, '');
        }
        
        foundUrls.add(normalizedUrl);
      });
    }
    
    const urls = Array.from(foundUrls);
    
    if (urls.length === 0) {
      return {
        hasUrls: false,
        cloudLinks: [],
        blockedLinks: [],
        unknownLinks: [],
        totalLinks: 0
      };
    }
    
    console.log(`   🔗 Found ${urls.length} URL(s):`, urls);
    
    const cloudLinks = [];
    const blockedLinks = [];
    const unknownLinks = [];
    
    for (const url of urls) {
      const urlLower = url.toLowerCase();
      
      // Check blocked services first (highest priority)
      const isBlocked = this.BLOCKED_SERVICES.some(domain => 
        urlLower.includes(domain)
      );
      
      if (isBlocked) {
        blockedLinks.push(url);
        console.log(`   ❌ Blocked link: ${url}`);
        continue;
      }
      
      // Check allowed cloud services
      const isCloud = this.ALLOWED_CLOUD_SERVICES.some(domain => 
        urlLower.includes(domain)
      );
      
      if (isCloud) {
        cloudLinks.push(url);
        console.log(`   ✅ Cloud link: ${url}`);
        continue;
      }
      
      // Unknown link (allow but warn)
      unknownLinks.push(url);
      console.log(`   ⚠️  Unknown link: ${url}`);
    }
    
    return {
      hasUrls: true,
      cloudLinks,
      blockedLinks,
      unknownLinks,
      totalLinks: urls.length
    };
  }

  // ═══════════════════════════════════════════════════════════════
  // 📞 CHECK FOR CONTACT INFORMATION (Quick pre-check)                     // ***** It need to change after  Registration **** //
  // ═══════════════════════════════════════════════════════════════
  
  quickContactCheck(text) {
   
  
  // ═══════════════════════════════════════
  // UPI GUARD — runs FIRST, strips handles
  // ═══════════════════════════════════════
  const textLower = text.toLowerCase();
  const hasUpiHandle = this.upiHandles.some(handle => textLower.includes(handle));
  
  // Remove UPI handles from text before other checks run
  let cleanText = text;
  if (hasUpiHandle) {
    cleanText = this.upiHandles.reduce((t, handle) => {
      const escaped = handle.replace('@', '\\@');
      return t.replace(new RegExp(escaped, 'gi'), '');
    }, text);
    console.log('   💰 UPI handle detected — stripping before checks');
  }

  // Phone numbers (various formats) — now runs on cleanText ↓
  const phonePatterns = [
    /\b\d{10,}\b/g,
    /\b\d{3}[-.\s]?\d{3}[-.\s]?\d{4}\b/g,
    /\b\+\d{1,3}[-.\s]?\d{9,}\b/g
  ];
  
  for (const pattern of phonePatterns) {
    const matches = cleanText.match(pattern);  // ← cleanText not text
    if (matches && matches.some(m => m.replace(/\D/g, '').length >= 10)) {
      return { hasContactInfo: true, type: 'PHONE', matches };
    }
  }

  // Email — runs on cleanText so @ybl @okaxis don't false-trigger ↓
  const emailPattern = /\b[A-Za-z0-9._%+-]+@(?!gmail|yahoo|outlook|hotmail|protonmail|icloud)[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/gi;
  const emails = cleanText.match(emailPattern);  // ← cleanText not text
  if (emails) {
    return { hasContactInfo: true, type: 'EMAIL', matches: emails };
  }

  // Payment keywords — remove wallet, keep real threats ↓
  const paymentPattern = /\b(paypal|venmo|cashapp|cash\s*app|zelle|bitcoin|btc|eth|crypto|wire\s*transfer)\b/gi;
  const payment = cleanText.match(paymentPattern);  // ← cleanText not text
  if (payment) {
    return { hasContactInfo: true, type: 'PAYMENT', matches: payment };
  }

  return { hasContactInfo: false, type: null, matches: [] };
}





  // ═══════════════════════════════════════════════════════════════
  // 📝 MAIN VALIDATION - FOR CHAT MESSAGES
  // ═══════════════════════════════════════════════════════════════
  
  async validateMessage(text) {
    console.log('\n💬 [Message Validation] Starting...');
    console.log(`   📝 Text length: ${text.length}`);
    
    try {
      // ═══════════════════════════════════════════════════════════
      // STEP 1: Quick pre-checks (no AI needed)
      // ═══════════════════════════════════════════════════════════
      
      // 1a. Check for blocked links FIRST
      const urlAnalysis = this.extractAndClassifyUrls(text);
      
      if (urlAnalysis.blockedLinks.length > 0) {
        console.log('   🚫 INSTANT BLOCK: Blocked links detected');
        return {
          allowed: false,
          blocked: true,
          reason: `Message contains prohibited links: ${urlAnalysis.blockedLinks.join(', ')}. Social media and messaging app links are not allowed for your security.`,
          warning: '🚫 Social media and messaging app links are not allowed',
          blockedLinks: urlAnalysis.blockedLinks,
          action: 'BLOCK',
          layer: 'link_detection',
          cached: false
        };
      }
      
      // 1b. Quick contact info check
      const contactCheck = this.quickContactCheck(text);
      
      if (contactCheck.hasContactInfo) {
        console.log(`   🚫 INSTANT BLOCK: ${contactCheck.type} detected`);
        return {
          allowed: false,
          blocked: true,
          reason: `Message contains personal ${contactCheck.type.toLowerCase()}. For your security, please use the platform's messaging system.`,
          warning: `🚫 Sharing personal ${contactCheck.type.toLowerCase()} is not allowed`,
          contactInfo: contactCheck.matches,
          action: 'BLOCK',
          layer: 'contact_detection',
          cached: false
        };
      }
      
      // ═══════════════════════════════════════════════════════════
      // STEP 2: Check if message has ONLY cloud links (safe fast path)
      // ═══════════════════════════════════════════════════════════
      
      const hasOnlyCloudLinks = 
        urlAnalysis.cloudLinks.length > 0 && 
        urlAnalysis.blockedLinks.length === 0 &&
        urlAnalysis.unknownLinks.length === 0 &&
        !contactCheck.hasContactInfo &&
        text.length < 200;  // Short message with just a link
      
      if (hasOnlyCloudLinks) {
        console.log('   ✅ Cloud-only links detected - ALLOWING without AI check');
        return {
          allowed: true,
          blocked: false,
          warning: '⚠️ Message contains file sharing links. Always verify the source before opening files.',
          reason: 'Message approved (cloud storage links)',
          hasLinks: true,
          cloudLinks: urlAnalysis.cloudLinks,
          action: 'ALLOW_CLOUD_LINKS',
          layer: 'cloud_link_fast_path',
          cached: false
        };
      }
      
      // ═══════════════════════════════════════════════════════════
      // STEP 3: Run CHAT AI validation (dedicated chat AI)
      // ═══════════════════════════════════════════════════════════
      
      console.log('   🤖 Running Chat AI validation...');
      
      const aiResult = await chatAIValidationService.validateChatMessage(text, {
        hasCloudLinks: urlAnalysis.cloudLinks.length > 0,
        hasUnknownLinks: urlAnalysis.unknownLinks.length > 0,
        hasBlockedLinks: urlAnalysis.blockedLinks.length > 0,
        hasOnlyCloudLinks: hasOnlyCloudLinks,
         hasUpiHandle: this.upiHandles.some(h => text.toLowerCase().includes(h)) // ← add this
      });
      
      console.log(`   📊 AI Decision: ${aiResult.action}`);
      console.log(`   📊 Confidence: ${aiResult.confidence}%`);
      console.log(`   📊 Layer: ${aiResult.layer}`);
      
      // ═══════════════════════════════════════════════════════════
      // STEP 4: Process AI result
      // ═══════════════════════════════════════════════════════════
      
      if (aiResult.action === 'BLOCK') {
        console.log('   🚫 AI BLOCKED');
        return {
          allowed: false,
          blocked: true,
          reason: aiResult.reason,
          warning: '🚫 Your message contains prohibited content',
          confidence: aiResult.confidence,
          violations: aiResult.violations,
          matches: aiResult.matches,
          action: 'BLOCK',
          layer: aiResult.layer,
          cached: aiResult.cached || false
        };
      }
      
      // ✅ ALLOW
      console.log('   ✅ Message APPROVED');
      
      let warning = null;
      
      if (urlAnalysis.cloudLinks.length > 0) {
        warning = '⚠️ Message contains file sharing links. Always verify the source before opening files.';
      } else if (urlAnalysis.unknownLinks.length > 0) {
        warning = '⚠️ Message contains external links. Be cautious when clicking unknown links.';
      }
      
      return {
        allowed: true,
        blocked: false,
        warning,
        reason: aiResult.reason || 'Message approved',
        hasLinks: urlAnalysis.hasUrls,
        cloudLinks: urlAnalysis.cloudLinks,
        unknownLinks: urlAnalysis.unknownLinks,
        action: 'ALLOW',
        layer: aiResult.layer,
        aiValidation: {
          decision: aiResult.action,
          confidence: aiResult.confidence,
          cached: aiResult.cached || false,
          originalDecision: aiResult.originalDecision
        }
      };
      
    } catch (error) {
      console.error('   ❌ Message validation error:', error);
      
      // Fail-safe: Allow but flag for review
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
      allowedCloudServices: this.ALLOWED_CLOUD_SERVICES.length,
      blockedServices: this.BLOCKED_SERVICES.length,
      chatAI: chatAIValidationService.getStats(),  // ✅ CHANGED
      timestamp: new Date().toISOString()
    };
  }

  // ═══════════════════════════════════════════════════════════════
  // 🏥 HEALTH CHECK
  // ═══════════════════════════════════════════════════════════════
  
  async getHealth() {
    const chatAIHealth = await chatAIValidationService.healthCheck();  // ✅ CHANGED
    
    return {
      status: chatAIHealth.status === 'healthy' ? 'healthy' : 'degraded',
      ready: true,
      services: {
        linkDetection: { status: 'active' },
        contactDetection: { status: 'active' },
        chatAI: chatAIHealth  // ✅ CHANGED
      },
      timestamp: new Date().toISOString()
    };
  }

  // ═══════════════════════════════════════════════════════════════
  // 🧹 CLEAR CACHE
  // ═══════════════════════════════════════════════════════════════
  
  clearCache() {
    chatAIValidationService.clearCache();  // ✅ CHANGED
    console.log('🧹 Message validation cache cleared');
  }
}

export default new MessageValidationService();