// src/services/moderation/config.js

/**
 * ═══════════════════════════════════════════════════════════════════
 *              🔧 MODERATION SYSTEM CONFIGURATION
 * ═══════════════════════════════════════════════════════════════════
 * Centralized config for all moderation settings
 * 
 * ✅ FIXED ISSUES:
 * - Weight mismatch (now matches actual scoring: 40/30/30)
 * - Threshold too high (35 → 25 for blocking)
 * - Missing obfuscated Telegram patterns
 * - Enhanced off-platform detection
 */

export const ModerationConfig = {
  
  // ═══════════════════════════════════════════════════════════════
  // 🤖 AI SETTINGS
  // ═══════════════════════════════════════════════════════════════
  ai: {
    // OpenAI API Key (from environment)
    apiKey:'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',
    
    // Model selection
    model: 'omni-moderation-latest',
    
    // Groq API Key (for secondary AI)
    groqApiKey: process.env.GROQ_API_KEY,
    
    // When to use AI
    // Options: 'ALL' | 'FLAGGED' | 'NEVER'
    useFor: process.env.USE_AI_FOR || 'FLAGGED',
    
    // AI decision weight (0-1)
    weight: parseFloat(process.env.AI_WEIGHT || '0.30'),
    
    // Minimum confidence to trust AI decision (0-100)
    minConfidence: parseInt(process.env.MIN_AI_CONFIDENCE || '70'),
    
    // Temperature (0-2) - only for GPT-based analysis
    temperature: 0.1,
    
    // Max tokens for response - only for GPT-based analysis
    maxTokens: 500,
    
    // Timeout (ms)
    timeout: 10000,
    
    // Retry settings
    maxRetries: 2,
    retryDelay: 1000,
    
    // OpenAI Moderation specific weights
    categoryWeights: {
      'sexual': 100,
      'sexual/minors': 100,
      'hate': 90,
      'hate/threatening': 95,
      'harassment': 80,
      'harassment/threatening': 85,
      'self-harm': 70,
      'self-harm/intent': 75,
      'self-harm/instructions': 80,
      'violence': 85,
      'violence/graphic': 90
    }
  },

  // ═══════════════════════════════════════════════════════════════
  // 🔍 RULES SCANNER SETTINGS (TRIPLE-LAYER WEIGHTS)
  // ═══════════════════════════════════════════════════════════════
  rules: {
    // Triple-layer weights - FIXED TO MATCH ACTUAL SCORING
    weights: {
      regex: 0.40,      // ✅ 40% (matches your output)
      openai: 0.30,     // ✅ 30% (matches your output)
      groq: 0.30        // ✅ 30% (matches your output)
    },
    
    // Risk score thresholds - FIXED & STRICTER
    thresholds: {
      safe: 12,           // ✅ < 12 = Safe (lowered from 15)
      suspicious: 25,     // ✅ >= 25 = Block (lowered from 35)
      regexInstant: 70,   // ✅ >= 70 = Instant block (regex only)
      aiInstant: 80       // ✅ >= 80 = Instant block (any AI layer)
    },
    
    // Risk weights for different violation types - ENHANCED
    violationWeights: {
      platformRedirect: 35,         // Instagram, Telegram, etc. (increased)
      spamPhrase: 20,               // "DM me", "contact me" (increased)
      suspiciousPattern: 8,         // Repeated chars, all caps (increased)
      multipleContacts: 45,         // 2+ platform redirects
      explicitContent: 50,          // Sexual/violent content
      offPlatformRequest: 40,       // ✅ "outside platform" (increased)
      telegramReference: 35,        // ✅ NEW: Specific Telegram patterns
      obfuscatedContact: 30,        // ✅ NEW: "t me", "insta", etc.
      urgencyTactics: 15,           // ✅ NEW: "act now", "limited time"
      moneyScam: 25                 // ✅ NEW: "earn money", "free $$$"
    },
    
    // Confidence levels
    confidence: {
      clean: 95,        // No violations
      obvious: 95,      // Clear spam (score >= 25)
      likely: 70,       // Likely spam (score 12-24)
      uncertain: 50     // Needs review (score < 12)
    },
    
    // Enable/disable specific checks
    enabledChecks: {
      platformRedirect: true,
      spamPhrases: true,
      suspiciousPatterns: true,
      multipleContacts: true,
      urlDetection: true,
      emailDetection: true,
      phoneDetection: true,
      offPlatformRequests: true,
      obfuscatedContacts: true,     // ✅ NEW
      telegramDetection: true       // ✅ NEW
    }
  },

  // ═══════════════════════════════════════════════════════════════
  // 🎯 SPAM DETECTION PATTERNS - MASSIVELY ENHANCED
  // ═══════════════════════════════════════════════════════════════
  patterns: {
    // Platform keywords (case-insensitive)
    platforms: {
      telegram: [
        'telegram', 't.me', 'tg://', '@telegram', 'tlgrm',
        't me',           // ✅ NEW: Obfuscated
        't . me',         // ✅ NEW: Spaced
        't-me',           // ✅ NEW: Hyphenated
        'tg me',          // ✅ NEW: Short form
        'telegrm',        // ✅ NEW: Misspelled
        'telegr',         // ✅ NEW: Abbreviated
        'tele gram'       // ✅ NEW: Spaced
      ],
      whatsapp: [
        'whatsapp', 'wa.me', 'whatsapp.com', 'whatsup', 'watsapp',
        'wa me',          // ✅ NEW: Obfuscated
        'whats app',      // ✅ NEW: Spaced
        'whtsapp',        // ✅ NEW: Missing vowel
        'wapp'            // ✅ NEW: Abbreviated
      ],
      instagram: [
        'instagram', 'insta', 'ig://', '@ig', 'instgrm',
        'instagr',        // ✅ NEW: Abbreviated
        'inst@',          // ✅ NEW: Symbol
        'igram',          // ✅ NEW: Short
        'insta gram'      // ✅ NEW: Spaced
      ],
      snapchat: [
        'snapchat', 'snap:', 'sc:', 'snapcode', 'snap chat',
        'snpchat',        // ✅ NEW: Missing vowel
        'snapcht',        // ✅ NEW: Misspelled
        'sn@p'            // ✅ NEW: Symbol
      ],
      discord: ['discord.gg', 'discordapp.com', 'discord#', 'disc0rd', 'dscrd'],
      twitter: ['twitter.com', 'x.com', '@twitter', 'twtr', 'twitt3r'],
      facebook: ['facebook.com', 'fb.com', 'fb.me', 'faceb00k', 'f@cebook'],
      tiktok: ['tiktok.com', '@tiktok', 'tiktok://', 'tik tok', 'tikt0k'],
      onlyfans: ['onlyfans', 'of.com', 'only fans', 'onlyfan', '0nlyfans'],
      cashapp: ['cash.app', 'cashapp', '$cashtag', 'cash app', 'c@shapp'],
      venmo: ['venmo.com', '@venmo', 'venm0', 'venmoo']
    },
    
    // Spam trigger phrases - MASSIVELY ENHANCED
    spamPhrases: [
      // ═══════════════════════════════════════════════════════
      // 🚨 OFF-PLATFORM REQUESTS (PRIORITY #1)
      // ═══════════════════════════════════════════════════════
      'outside platform',
      'off platform',
      'outside this platform',
      'outside the platform',
      'off this platform',
      'off the platform',
      'come in outside',           // ✅ Catches "come in outside platform"
      'lets go in',                // ✅ Catches "lets go in t me"
      'let\'s go in',
      'lets go to',
      'let\'s go to',
      'move to',
      'switch to',
      'head to',
      'hop on',
      'jump on',
      'outside this app',
      'off this app',
      'outside here',
      'off here',
      'not on here',
      'not here',
      'somewhere else',
      'another platform',
      'different platform',
      'other platform',
      'continue on',
      'chat elsewhere',
      'talk elsewhere',
      
      // ═══════════════════════════════════════════════════════
      // 📱 DIRECT CONTACT REQUESTS
      // ═══════════════════════════════════════════════════════
      'dm me',
      'direct message',
      'text me',
      'contact me',
      'reach out',
      'message me',
      'call me',
      'email me',
      'hmu',                       // ✅ Hit me up
      'hit me up',
      'ping me',
      'drop me',
      'shoot me',
      
      // ═══════════════════════════════════════════════════════
      // 🔗 PLATFORM REDIRECTION
      // ═══════════════════════════════════════════════════════
      'add me on',
      'follow me on',
      'find me on',
      'meet me on',
      'talk on',
      'chat on',
      'message on',
      'reach me on',
      'contact on',
      'connect on',
      'see me on',
      'catch me on',
      
      // ═══════════════════════════════════════════════════════
      // 📲 OBFUSCATED TELEGRAM (PRIORITY #2)
      // ═══════════════════════════════════════════════════════
      't me',                      // ✅ Most common obfuscation
      't.me',
      't . me',
      't- me',
      't -me',
      't_me',
      'tg me',
      'tg.me',
      'tlgrm',
      'telegrm',
      'telegr',
      'in telegram',
      'on telegram',
      'via telegram',
      'through telegram',
      'telegram me',
      'tele gram',
      'talk in t',                 // ✅ "talk in t me"
      'chat in t',                 // ✅ "chat in t me"
      'message in t',              // ✅ "message in t me"
      'go in t',                   // ✅ "go in t me"
      'come in t',                 // ✅ "come in t me"
      
      // ═══════════════════════════════════════════════════════
      // 📱 OBFUSCATED OTHER PLATFORMS
      // ═══════════════════════════════════════════════════════
      'insta',
      'ig',
      'igram',
      'snap',
      'sc',
      'wa me',
      'whats app',
      'fb me',
      'tiktk',
      
      // ═══════════════════════════════════════════════════════
      // 🔗 LINK MANIPULATION
      // ═══════════════════════════════════════════════════════
      'click here',
      'click link',
      'check bio',
      'check link',
      'check profile',
      'link in bio',
      'tap link',
      'visit link',
      'see link',
      'my link',
      'bio link',
      'profile link',
      
      // ═══════════════════════════════════════════════════════
      // 💰 MONEY/BUSINESS SCAMS
      // ═══════════════════════════════════════════════════════
      'earn money',
      'make money',
      'work from home',
      'business opportunity',
      'investment opportunity',
      'side hustle',
      'passive income',
      'financial freedom',
      'get rich',
      'make $$$',
      'easy money',
      'quick money',
      'fast cash',
      'make $$',
      'earn $$',
      
      // ═══════════════════════════════════════════════════════
      // ⏰ URGENCY TACTICS
      // ═══════════════════════════════════════════════════════
      'limited time',
      'limited offer',
      'limited slots',
      'act now',
      'hurry up',
      'dont miss',
      'don\'t miss',
      'last chance',
      'expires soon',
      'only today',
      'today only',
      'right now',
      
      // ═══════════════════════════════════════════════════════
      // 🎁 FREE STUFF SCAMS
      // ═══════════════════════════════════════════════════════
      'free money',
      'free gift',
      'get paid',
      'claim now',
      'win prize',
      'free cash',
      'free $$$'
    ],
    
    // Suspicious patterns (regex) - ENHANCED
    suspicious: {
      repeatedChars: /(.)\1{4,}/,                       // aaaaa
      excessiveEmojis: /([\u{1F300}-\u{1F9FF}]){5,}/u, // 🔥🔥🔥🔥🔥
      allCaps: /^[A-Z\s!@#$%^&*()]{20,}$/,             // ALL CAPS
      excessiveSpaces: /\s{5,}/,                        // Too many spaces
      excessivePunctuation: /[!?.,]{5,}/,               // !!!!!!!
      leetSpeak: /[a-z0-9@$!]{3,}\d+[a-z0-9@$!]*/i,   // h3ll0, gr8
      hiddenText: /[\u200B-\u200D\uFEFF]/,             // Zero-width chars
      mixedScripts: /[\u0400-\u04FF].*[a-zA-Z]/,       // Cyrillic + Latin
      
      // ✅ NEW: Obfuscated Telegram patterns
      telegramObfuscated: /\bt[\s._-]*m?e?\b/i,        // t me, t.me, t_me
      telegramSpaced: /\bt\s+m\s*e\b/i,                 // t m e
      telegramInPhrase: /(?:lets?|come|go|talk|chat|message)\s+(?:in|on|to)\s+t(?:\s|\.|-|_)?m?e?\b/i,
      
      // ✅ NEW: Off-platform phrases
      offPlatformPhrase: /(?:outside|off|leave|move\s+(?:to|from))\s+(?:platform|app|here|this)/i,
      
      // ✅ NEW: Contact obfuscation
      contactObfuscation: /(?:insta|snap|wa|tg|ig)[\s._-]*(?:me|gram)?/i
    },
    
    // URL patterns
    urls: {
      standard: /(?:https?:\/\/)?(?:www\.)?[a-z0-9-]+\.[a-z]{2,}(?:\/[^\s]*)?/gi,
      shortener: /(?:bit\.ly|tinyurl\.com|goo\.gl|ow\.ly|t\.co|short\.link|cutt\.ly)/i,
      suspicious: /(?:\.tk|\.ml|\.ga|\.cf|\.gq)(?:\/|$)/i,
      ipAddress: /\b(?:\d{1,3}\.){3}\d{1,3}\b/
    },
    
    // Contact info patterns
    contact: {
      email: /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/gi,
      phone: /(?:\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/g,
      phoneInternational: /\+\d{1,4}[-.\s]?\d{6,}/g,
      username: /@[a-z0-9_]{3,}/gi,
      hashtag: /#[a-z0-9_]+/gi
    }
  },

  // ═══════════════════════════════════════════════════════════════
  // 🚫 MODERATION ACTIONS
  // ═══════════════════════════════════════════════════════════════
  actions: {
    // Action types
    types: {
      ALLOW: 'ALLOW',
      WARNING: 'WARNING',
      FLAG: 'FLAG',
      BLOCK: 'BLOCK'
    },
    
    // User-facing messages - IMPROVED
    messages: {
      ALLOW: 'Profile bio accepted ✅',
      
      WARNING: 'Your bio contains suspicious content but was allowed. Please avoid promotional language or off-platform contact requests.',
      
      FLAG: 'Your bio will be reviewed by our team. You can continue using the app.',
      
      BLOCK: {
        default: 'Your bio violates our community guidelines. Please remove inappropriate content and try again.',
        
        platformRedirect: 'Please remove {{platform}} contact information. Keep conversations on our platform for your safety.',
        
        multipleContacts: 'Your bio contains multiple contact methods. Please remove external contact information.',
        
        offPlatform: 'Your bio requests moving conversations off-platform, which violates our guidelines. Please keep all communication within the app.',
        
        telegramReference: 'Please remove Telegram references. All communication should happen within our app for your safety.',
        
        obfuscatedContact: 'Your bio contains obfuscated contact information. Please remove all external contact methods.',
        
        spamContent: 'Your bio appears to contain promotional or spam content. Please focus on describing yourself genuinely.',
        
        explicitContent: 'Your bio contains inappropriate content. Please keep your profile family-friendly.',
        
        suspiciousPattern: 'Your bio contains suspicious formatting or hidden characters. Please use natural language.',
        
        generic: 'Please revise your bio to comply with our community guidelines.'
      }
    },
    
    // Auto-actions (based on score/confidence) - FIXED
    autoActions: {
      enabled: true,
      rules: [
        { condition: 'finalScore >= 25', action: 'BLOCK' },      // ✅ Lowered from 35
        { condition: 'finalScore >= 12 && finalScore < 25', action: 'WARNING' }, // ✅ Lowered from 15/35
        { condition: 'finalScore < 12', action: 'ALLOW' }        // ✅ Lowered from 15
      ]
    }
  },

  // ═══════════════════════════════════════════════════════════════
  // 📊 LOGGING & ANALYTICS
  // ═══════════════════════════════════════════════════════════════
  logging: {
    enabled: process.env.LOG_MODERATION_DECISIONS !== 'false',
    level: process.env.LOG_LEVEL || 'info',
    
    logDecisions: true,
    logViolations: true,
    logAIAnalysis: true,
    logPerformance: true,
    logCosts: true,
    
    database: {
      enabled: true,
      collection: 'moderation_logs',
      retentionDays: 90
    },
    
    file: {
      enabled: false,
      path: './logs/moderation.log',
      maxSize: '10mb',
      maxFiles: 5
    },
    
    console: {
      colors: true,
      timestamps: true,
      pretty: process.env.NODE_ENV === 'development'
    }
  },

  // ═══════════════════════════════════════════════════════════════
  // ⚡ PERFORMANCE SETTINGS
  // ═══════════════════════════════════════════════════════════════
  performance: {
    cache: {
      enabled: true,
      ttl: 3600,
      maxSize: 10000,
      cacheKeyPrefix: 'mod:'
    },
    
    rateLimit: {
      enabled: true,
      maxRequestsPerMinute: 60,
      maxRequestsPerHour: 1000,
      maxRequestsPerDay: 10000
    },
    
    async: {
      enabled: false,
      queueName: 'moderation-queue',
      maxConcurrent: 10
    },
    
    timeouts: {
      regex: 100,            // ✅ Increased from 50ms
      openai: 5000,
      groq: 5000,
      total: 15000
    },
    
    warnings: {
      slowRequest: 3000,
      verySlowRequest: 5000
    }
  },

  // ═══════════════════════════════════════════════════════════════
  // 💰 COST MANAGEMENT
  // ═══════════════════════════════════════════════════════════════
  costs: {
    budget: {
      daily: 5.00,
      monthly: 100.00,
      perCheck: 0.01
    },
    
    tracking: {
      enabled: true,
      alertThreshold: 0.8
    },
    
    onBudgetExceeded: 'RULES_ONLY',
    
    pricing: {
      'omni-moderation-latest': {
        perRequest: 0.0002
      },
      'gpt-4o-mini': {
        input: 0.150 / 1000000,
        output: 0.600 / 1000000
      },
      'gpt-4o': {
        input: 2.50 / 1000000,
        output: 10.00 / 1000000
      },
      'groq': {
        input: 0.0,
        output: 0.0
      }
    }
  },

  // ═══════════════════════════════════════════════════════════════
  // 🔔 ALERTS & NOTIFICATIONS
  // ═══════════════════════════════════════════════════════════════
  alerts: {
    enabled: true,
    
    channels: {
      email: {
        enabled: false,
        recipients: ['admin@yourdatingapp.com']
      },
      slack: {
        enabled: false,
        webhook: process.env.SLACK_WEBHOOK_URL
      },
      discord: {
        enabled: false,
        webhook: process.env.DISCORD_WEBHOOK_URL
      }
    },
    
    triggers: {
      highSpamRate: {
        enabled: true,
        threshold: 0.5,
        interval: 3600
      },
      aiFailures: {
        enabled: true,
        threshold: 5,
        interval: 300
      },
      budgetWarning: {
        enabled: true,
        threshold: 0.8
      },
      performanceIssues: {
        enabled: true,
        threshold: 5000
      }
    }
  },

  // ═══════════════════════════════════════════════════════════════
  // 🧪 TESTING & DEBUG
  // ═══════════════════════════════════════════════════════════════
  debug: {
    enabled: process.env.NODE_ENV === 'development',
    testMode: process.env.TEST_MODE === 'true',
    verbose: process.env.VERBOSE === 'true',
    
    mockAI: process.env.MOCK_AI === 'true',
    mockResponses: {
      openai: {
        flagged: false,
        categories: {},
        category_scores: {}
      },
      groq: {
        decision: 'ALLOW',
        confidence: 85,
        violations: []
      }
    }
  },

  // ═══════════════════════════════════════════════════════════════
  // 📋 REVIEW QUEUE
  // ═══════════════════════════════════════════════════════════════
  reviewQueue: {
    enabled: true,
    
    priorities: {
      CRITICAL: {
        name: 'Critical',
        condition: 'finalScore >= 50',
        sla: 1800
      },
      HIGH: {
        name: 'High',
        condition: 'finalScore >= 25 && finalScore < 50',
        sla: 3600
      },
      MEDIUM: {
        name: 'Medium',
        condition: 'finalScore >= 12 && finalScore < 25',
        sla: 86400
      },
      LOW: {
        name: 'Low',
        condition: 'finalScore < 12',
        sla: 604800
      }
    },
    
    autoReview: {
      enabled: true,
      minAge: 86400,
      minConfidence: 75
    }
  },

  // ═══════════════════════════════════════════════════════════════
  // 🔒 SECURITY
  // ═══════════════════════════════════════════════════════════════
  security: {
    sanitizeInputs: true,
    maxBioLength: 500,
    maxUsernameLength: 30,
    minUsernameLength: 3,
    
    userRateLimit: {
      enabled: true,
      maxAttemptsPerHour: 10,
      maxAttemptsPerDay: 50,
      blockDuration: 3600
    },
    
    encryptLogs: false,
    
    ipRateLimit: {
      enabled: true,
      maxRequestsPerMinute: 30,
      blockDuration: 900
    }
  },

  // ═══════════════════════════════════════════════════════════════
  // 📈 ANALYTICS
  // ═══════════════════════════════════════════════════════════════
  analytics: {
    enabled: true,
    
    metrics: {
      totalChecks: true,
      spamRate: true,
      falsePositiveRate: true,
      averageConfidence: true,
      aiUsageRate: true,
      averageCost: true,
      averageTime: true,
      layerPerformance: true
    },
    
    reports: {
      enabled: true,
      frequency: 'daily',
      recipients: ['admin@yourdatingapp.com']
    }
  }
};

// ═══════════════════════════════════════════════════════════════
// 🎯 PRESET CONFIGURATIONS
// ═══════════════════════════════════════════════════════════════

export const PresetConfigs = {
  // 🚀 PRODUCTION
  production: {
    ...ModerationConfig,
    ai: {
      ...ModerationConfig.ai,
      useFor: 'FLAGGED',
      weight: 0.30
    },
    rules: {
      ...ModerationConfig.rules,
      weights: {
        regex: 0.40,
        openai: 0.30,
        groq: 0.30
      },
      thresholds: {
        safe: 12,
        suspicious: 25,
        regexInstant: 70,
        aiInstant: 80
      }
    },
    performance: {
      ...ModerationConfig.performance,
      cache: { enabled: true, ttl: 3600, maxSize: 10000 }
    },
    debug: {
      enabled: false,
      testMode: false,
      verbose: false
    }
  },

  // 💰 BUDGET
  budget: {
    ...ModerationConfig,
    ai: {
      ...ModerationConfig.ai,
      useFor: 'FLAGGED'
    },
    rules: {
      ...ModerationConfig.rules,
      weights: {
        regex: 0.60,
        openai: 0.20,
        groq: 0.20
      },
      thresholds: {
        safe: 10,
        suspicious: 30,
        regexInstant: 65,
        aiInstant: 85
      }
    }
  },

  // 🎯 ACCURACY
  accuracy: {
    ...ModerationConfig,
    ai: {
      ...ModerationConfig.ai,
      useFor: 'ALL'
    },
    rules: {
      ...ModerationConfig.rules,
      weights: {
        regex: 0.20,
        openai: 0.40,
        groq: 0.40
      },
      thresholds: {
        safe: 15,
        suspicious: 20,
        regexInstant: 75,
        aiInstant: 80
      }
    }
  },

  // ⚡ SPEED
  speed: {
    ...ModerationConfig,
    ai: {
      ...ModerationConfig.ai,
      useFor: 'NEVER'
    },
    rules: {
      ...ModerationConfig.rules,
      weights: {
        regex: 1.0,
        openai: 0.0,
        groq: 0.0
      }
    },
    performance: {
      ...ModerationConfig.performance,
      cache: { enabled: true, ttl: 7200, maxSize: 50000 }
    }
  },

  // 🧪 DEVELOPMENT
  development: {
    ...ModerationConfig,
    debug: {
      enabled: true,
      testMode: false,
      verbose: true
    },
    logging: {
      ...ModerationConfig.logging,
      level: 'debug',
      console: {
        colors: true,
        timestamps: true,
        pretty: true
      }
    }
  }
};

// ═══════════════════════════════════════════════════════════════
// 🔧 HELPER FUNCTIONS
// ═══════════════════════════════════════════════════════════════

export function getConfig(preset = null) {
  if (preset && PresetConfigs[preset]) {
    return PresetConfigs[preset];
  }

  const env = process.env.NODE_ENV || 'development';
  return PresetConfigs[env] || ModerationConfig;
}

export function validateConfig(config) {
  const errors = [];

  if (!config.ai.apiKey && config.ai.useFor !== 'NEVER') {
    errors.push('OPENAI_API_KEY is required when AI is enabled');
  }

  if (!config.ai.groqApiKey && config.ai.useFor !== 'NEVER') {
    errors.push('GROQ_API_KEY is required when AI is enabled');
  }

  if (config.ai.weight < 0 || config.ai.weight > 1) {
    errors.push('AI weight must be between 0 and 1');
  }

  const weightSum = config.rules.weights.regex + 
                    config.rules.weights.openai + 
                    config.rules.weights.groq;
  
  if (Math.abs(weightSum - 1.0) > 0.01) {
    errors.push(`Rule weights must sum to 1.0 (currently ${weightSum})`);
  }

  if (config.ai.minConfidence < 0 || config.ai.minConfidence > 100) {
    errors.push('AI minConfidence must be between 0 and 100');
  }

  if (config.rules.thresholds.safe >= config.rules.thresholds.suspicious) {
    errors.push('Safe threshold must be less than suspicious threshold');
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

export function mergeConfig(customConfig) {
  return {
    ...ModerationConfig,
    ...customConfig,
    ai: { ...ModerationConfig.ai, ...(customConfig.ai || {}) },
    rules: { ...ModerationConfig.rules, ...(customConfig.rules || {}) },
    performance: { ...ModerationConfig.performance, ...(customConfig.performance || {}) }
  };
}

export default ModerationConfig;