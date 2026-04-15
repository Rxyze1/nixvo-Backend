/**
 * ════════════════════════════════════════════════════════════════════════════
 * 🇮🇳 MONSTER-LEVEL HINGLISH DIRECT ACTION ENGINE
 * ════════════════════════════════════════════════════════════════════════════
 * 
 * DESIGN PHILOSOPHY:
 * Hinglish is not random. It follows a strict grammatical structure:
 * [Pronoun] + [Negative Guard] + [English Verb] + [Hindi Suffix] + [Target]
 * Example: "Mujhe (Pronoun) call (Verb) karo (Suffix) number pe (Target)"
 * 
 * This file breaks down those components into massive arrays and uses 
 * programmatic combination to generate thousands of regex permutations.
 * 
 * ANTI-FALSE-POSITIVE:
 * Uses negative lookahead (?!mat|nahi|no) to ensure we don't block 
 * "mujhe call mat karo" (DON'T call me).
 * 
 */

// ═══════════════════════════════════════════════════════════════
// 🗣️ MATRIX 1: HINGLISH PRONOUNS (Who is doing the action)
// ═══════════════════════════════════════════════════════════════
const PRONOUNS_TARGET_ME = [
  'mujhe', 'muje', 'mujhko', 'mje',        // To me
  'mereko', 'mere ko', 'mera',              // My / To me
  'humko', 'humein', 'humen',               // To us
];

const PRONOUNS_TARGET_YOU = [
  'apko', 'aapko', 'aap ko',               // To you (formal)
  'tumhe', 'tumko', 'tumheko',              // To you (informal)
  'tujhe', 'tu', 'tera', 'tumara',          // To you (aggressive/informal)
];

const PRONOUNS_TARGET_THEM = [
  'usko', 'ushe', 'isko', 'inko', 'unko',   // To him/her/them
  'uska', 'iska', 'unka'                    // His/Her
];

const ALL_PRONOUNS = [
  ...PRONOUNS_TARGET_ME, 
  ...PRONOUNS_TARGET_YOU, 
  ...PRONOUNS_TARGET_THEM
];


// ═══════════════════════════════════════════════════════════════
// 🚫 MATRIX 2: NEGATIVE GUARDS (What makes it a NON-violation)
// ═══════════════════════════════════════════════════════════════
const NEGATIVE_WORDS = [
  'mat', 'math', 'maat',                     // Don't
  'nahi', 'nahin', 'no', 'not',              // No
  'bilkul nahi', 'zaroor nahi'               // Absolutely not
];

// Build the negative lookahead regex string
// e.g., "(?!(?:mat|nahi|no|not)\s+)"
const NEGATIVE_LOOKAHEAD = `(?!\\s*(?:${NEGATIVE_WORDS.join('|')})\\b)`;


// ═══════════════════════════════════════════════════════════════
// 📞 MATRIX 3: ENGLISH ACTION VERBS (The core contact action)
// ═══════════════════════════════════════════════════════════════
const VERBS_CALL = [
  'call', 'kal', 'kall',                     // Call (including phonetic 'kal')
  'dial', 'dal', 'daal',                     // Dial
  'ring', 'ringing', 'ring karo',            // Ring
  'bell', 'bell baja', 'bell bja',           // Bell
];

const VERBS_MESSAGE = [
  'msg', 'mgs', 'ems', 'massg',              // Msg (typos)
  'message', 'messege', 'mesage', 'messag',  // Message (typos)
  'text', 'txt', 'tet',                      // Text
  'sms', 'esm',                              // SMS
  'ping', 'peng', 'png',                     // Ping
  'dm', 'dm karo', 'pm',                     // DM
  'inbox', 'inbux',                          // Inbox
];

const VERBS_MEDIA = [
  'vc', 'video call', 'video\\s*call',       // Video Call
  'audio call', 'audio\\s*call',             // Audio Call
  'voice call', 'voice\\s*call',             // Voice Call
  'videocall', 'audiocall'                   // Combined
];

const ALL_VERBS = [
  ...VERBS_CALL, 
  ...VERBS_MESSAGE, 
  ...VERBS_MEDIA
];


// ═══════════════════════════════════════════════════════════════
// 🇮🇳 MATRIX 4: HINDI SUFFIXES (The grammatical action completor)
// ═══════════════════════════════════════════════════════════════
const SUFFIXES_DO = [
  'karo', 'kro', 'kru', 'krlo',             // Do
  'kar', 'kr', 'karna', 'krna',             // To do
  'krdo', 'kar do', 'kar dena',             // Get it done
];

const SUFFIXES_GIVE = [
  'do', 'dedo', 'de do', 'dijiye',          // Give
  'de', 'dena', 'deiye'                     // To give
];

const SUFFIXES_SEND = [
  'bhejo', 'bhej', 'bhejna', 'bhej do',    // Send
  'bhjeo', 'bhejo', 'bhejdo',               // Send (typos)
  'send', 'send karo'                       // Send (Hinglish)
];

const SUFFIXES_PUT = [
  'daalo', 'dalo', 'dal do', 'daal do',     // Put/Drop
  'lagao', 'laga', 'lagana',                // Apply (e.g., call lagao)
];

const SUFFIXES_MISC = [
  'utha', 'uthao', 'utha lo',               // Pick up (phone uthao)
  'mil', 'milna', 'milte', 'milte hain',    // Meet/Connect
  'jao', 'ja', 'jaye', 'jana',              // Go
  'lena', 'le lo', 'lekarna',               // Take
  'rakh', 'rakho', 'rakhna',                // Keep
  'check', 'dekho', 'dekh',                 // Check
];

const ALL_SUFFIXES = [
  ...SUFFIXES_DO, 
  ...SUFFIXES_GIVE, 
  ...SUFFIXES_SEND, 
  ...SUFFIXES_PUT, 
  ...SUFFIXES_MISC
];


// ═══════════════════════════════════════════════════════════════
// 🎯 MATRIX 5: TARGET LOCATIONS (Where the action happens)
// ═══════════════════════════════════════════════════════════════
const TARGETS_MEDIUM = [
  'pe', 'par', 'per',                        // On
  'me', 'mein', 'men',                       // In
  'se', 'tak',                               // From / Till
  'upar', 'niche',                           // Above / Below
  'k andar', 'ke andar'                      // Inside
];

const TARGETS_NOUNS = [
  'number', 'num', 'mobile', 'phone', 'cell', // Contact info
  'id', 'i\\.?d', 'handle', 'profile',       // Social info
  'personal', 'private', 'direct',           // Privacy types
  'wa', 'wp', 'watsapp', 'whatsapp',         // Apps
  'insta', 'instagram', 'ig',                // Apps
  'tg', 'telegram', 'tele',                  // Apps
  'dc', 'discord', 'dscord',                 // Apps
  'fb', 'facebook', 'snap', 'sc'             // Apps
];


// ═══════════════════════════════════════════════════════════════
// ⏱️ MATRIX 6: TIME & URGENCY MODIFIERS (When to do it)
// ═══════════════════════════════════════════════════════════════
const TIME_MODIFIERS = [
  'abhi', 'ab', 'aab',                      // Now
  'jaldi', 'jldi', 'fast',                  // Quick/Fast
  'kal', 'kal ko',                           // Tomorrow
  'aaj', 'aaj hi',                           // Today
  'sham ko', 'shaam', 'evening',             // Evening
  'raat ko', 'rat ko', 'night',              // Night
  'subah', 'morning',                        // Morning
  'tb', 'tab', 'jab',                        // Then/When
  'kabhi', 'kbhi',                           // Ever/Whenever
];

const PLEASANTRIES = [
  'please', 'plz', 'plzz', 'pliz',           // Please
  'bhai', 'bhaiya', 'bro', 'bros',           // Bro
  'yaar', 'yar', 'dost', 'frnd',             // Friend
  'ji', 'sahab', 'sir', 'madam'              // Respect
];

const ALL_MODIFIERS = [...TIME_MODIFIERS, ...PLEASANTRIES];


// ═══════════════════════════════════════════════════════════════
// 🧩 MATRIX 7: STANDALONE IDIOMATIC PHRASES (Full sentences)
// ═══════════════════════════════════════════════════════════════
const IDIOMATIC_ACTIONS = [
  // Phone specific
  'phone\\s*(?:karo|kro|uthao|rakho|dekh|check)',
  'phone\\s*(?:pe|par|me)\\s*(?:aao|aa|milte|baat)',
  'call\\s*(?:lagao|laga|lagao|uthao)',
  
  // Notification / Silent requests
  'notification\\s*(?:baja|dekho|check|karo|dono)',
  'online\\s*(?:aao|aa|jao|dikha)',
  'green\\s*tick\\s*(?:aao|aa|dikha)',
  
  // "I will call you" (Intent to bypass)
  'main\\s*(?:call|kal)\\s*(?:karunga|karounga|krunga|karu)',
  'hum\\s*(?:call|kal|msg)\\s*(?:karenge|krenge|kare)',
  
  // Extreme slang
  'haan\\s*bhi\\s*(?:call|msg|dm)\\s*(?:karo|kr|do)',
  'seedha\\s*(?:call|msg|dm)\\s*(?:karo|kr|do|jao)',
  
  // Repeated urgency
  '(?:dobara|fir\\s*se|again)\\s*(?:call|msg|dm|ping)\\s*(?:karo|kro|do|bhejo)',
  'ek\\s*(?:bar|baar)\\s*(?:call|msg)\\s*(?:karo|kr|do|bhejo)'
];


// ═══════════════════════════════════════════════════════════════
// ⚙️ COMBINATOR ENGINE (Builds the monster regex mathematically)
// ═══════════════════════════════════════════════════════════════

/**
 * Helper to safely join arrays into regex non-capturing groups (?:a|b|c)
 */
const group = (arr) => `(?:${arr.join('|')})`;
const boundGroup = (arr) => `\\b(?:${arr.join('|')})\\b`;
const optionalGroup = (arr) => `(?:\\s+(?:${arr.join('|')}))?`;

/**
 * FORMULA 1: PRONOUN + VERB + SUFFIX
 * Catches: "mujhe call karo", "apko msg do", "usko ping krdo"
 */
const formula1 = [];
for (const pronoun of ALL_PRONOUNS) {
  for (const verb of ALL_VERBS) {
    // Pronoun + Negative Guard + Verb + Suffix + Optional Modifier
    const base = `${boundGroup([pronoun])}${NEGATIVE_LOOKAHEAD}\\s+${group([verb])}\\s+${group(ALL_SUFFIXES)}${optionalGroup(ALL_MODIFIERS)}\\b`;
    formula1.push(base);
  }
}

/**
 * FORMULA 2: PRONOUN + TARGET + VERB + SUFFIX
 * Catches: "mere number pe call karo", "uske id pe msg do"
 */
const formula2 = [];
for (const pronoun of ALL_PRONOUNS) {
  for (const target of TARGETS_NOUNS) {
    for (const verb of ALL_VERBS) {
      // Limit combinations to prevent regex engine overflow (DOS protection)
      // Only use top verbs for this deep combination
      if (['call', 'kal', 'msg', 'dm', 'ping'].includes(verb)) {
        const base = `${boundGroup([pronoun])}\\s+${group([target])}\\s+${group(TARGETS_MEDIUM)}\\s+${group([verb])}\\s+${group(ALL_SUFFIXES)}\\b`;
        formula2.push(base);
      }
    }
  }
}

/**
 * FORMULA 3: VERB + SUFFIX + PRONOUN (Inverted grammar)
 * Catches: "call karo mujhe", "msg do apko"
 */
const formula3 = [];
for (const verb of ALL_VERBS) {
  for (const suffix of SUFFIXES_DO) { // Only use direct action suffixes
    for (const pronoun of ALL_PRONOUNS) {
      const base = `\\b${group([verb])}\\s+${group([suffix])}\\s+${boundGroup([pronoun])}\\b`;
      formula3.push(base);
    }
  }
}

/**
 * FORMULA 4: TIME + VERB + PRONOUN
 * Catches: "abhi call karo mujhe", "jaldi msg do"
 */
const formula4 = [];
for (const time of TIME_MODIFIERS) {
  for (const verb of ALL_VERBS) {
    if (['call', 'kal', 'msg', 'dm', 'ping', 'vc'].includes(verb)) {
      const base = `\\b${group([time])}\\s+${group([verb])}\\s+${group(ALL_SUFFIXES)}\\s+${boundGroup(ALL_PRONOUNS)}\\b`;
      formula4.push(base);
    }
  }
}


// ═══════════════════════════════════════════════════════════════
// 🧱 MASTER PATTERN ASSEMBLY
// ═══════════════════════════════════════════════════════════════

const finalPatternArray = [
  ...formula1,
  ...formula2,
  ...formula3,
  ...formula4,
  ...IDIOMATIC_ACTIONS
];

// Join all thousands of permutations into one massive Regex
const pattern = new RegExp(finalPatternArray.join('|'), 'gi');


// ═══════════════════════════════════════════════════════════════
// 🚀 EXPORT
// ═══════════════════════════════════════════════════════════════
export default {
  type: 'HINDI_ACTION',
  pattern,
  reason: '🚫 Asking to initiate direct contact or off-platform communication is not allowed.'
};