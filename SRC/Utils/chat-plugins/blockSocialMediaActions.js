/**
 * ════════════════════════════════════════════════════════════════
 * 📸 ADVANCED SOCIAL MEDIA & HANDLE EXTRACTOR
 * ════════════════════════════════════════════════════════════════
 * Catches full names, phonetic typos, AND ultra-short codes (ig, tg, fb)
 * paired with possessive or action words to prevent false positives.
 */

// ═══════════════════════════════════════════════════════════════
// ⚙️ COMPRESSED SOCIAL TARGETS
// ═══════════════════════════════════════════════════════════════
const SOCIALS_FULL = [
  'insta(?:gram)?', 'face(?:book)?', 'telegram', 'whatsapp', 
  'discord', 'snap(?:chat)?', 'tiktok', 'linked(?:in)?', 
  'twitter', 'x\\.com', 'signal', 'viber', 'wechat', 'skype','ig' , 'wa', 'fb', 'tg', 'dc', 'sc', 'wp'
].join('|');

// Ultra-short codes (Must be guarded by context so "ig" alone doesn't block "big", "dig")
const SOCIALS_SHORT = '(?:ig|fb|tg|dc|sc|wa|wp)';

// Digital identity nouns
const IDENTITIES = '(?:id|i\\.?d\\.?|handle|page|prof(?:ile)?|acc(?:ount)?|link|url|username)';

// Action & Possessive words
const ACTIONS = '(?:follow|add|connect|search|find|look|check|see|dekh)';
const POSSESSIVES = '(?:my|your|mer[ae]|tumh[ae]r[ae]|aapk[ae]|ter[ei]|our)';


// ═══════════════════════════════════════════════════════════════
// 🧱 PATTERN ASSEMBLY
// ═══════════════════════════════════════════════════════════════
const pattern = new RegExp([

  // 1. [ACTION] [ME/MY] ON [FULL SOCIAL] 
  // "follow me on insta", "add me on facebook"
  `\\b${ACTIONS}\\s+(?:me|my|us)\\s+(?:on|at|in)\\s+(?:${SOCIALS_FULL})\\b`,
  
  // 2. [POSSESSIVE] [FULL SOCIAL] [IDENTITY]
  // "my insta id", "mera facebook profile"
  `\\b(?:${POSSESSIVES}|check\\s*out)\\s+(?:${SOCIALS_FULL})\\s+${IDENTITIES}\\b`,

  // 3. [FULL SOCIAL] [IDENTITY] [IS/STATE]
  // "instagram id is", "snapchat handle :"
  `\\b(?:${SOCIALS_FULL})\\s+${IDENTITIES}\\s+(?:is|hai|he|h[ae]in|:|\\-|>>)\\b`,

  // ═══════════════════════════════════════════════════════════
  // 🚨 SHORT-CODE DEFENSE (The "Ig. Rudra" fix)
  // These REQUIRE surrounding context to prevent false positives
  // ═══════════════════════════════════════════════════════════

  // 4. [POSSESSIVE] [SHORT CODE] [IDENTITY]
  // "my ig id", "tera fb profile", "mera dc handle"
  `\\b${POSSESSIVES}\\s+${SOCIALS_SHORT}\\s+${IDENTITIES}\\b`,

  // 5. [ACTION] ON [SHORT CODE]
  // "follow on ig", "add on fb", "connect on tg"
  `\\b${ACTIONS}\\s+(?:on|at|in)\\s+${SOCIALS_SHORT}\\b`,

  // 6. [SHORT CODE] [IDENTITY] [STATE]
  // "ig id is", "fb handle :", "tg id hai"
  `\\b${SOCIALS_SHORT}\\s+${IDENTITIES}\\s+(?:is|hai|he|h[ae]in|:|\\-|>>)\\b`,

  // 7. Hinglish short demands
  // "ig check karo", "fb pe add karo", "dc id batao"
  `\\b${SOCIALS_SHORT}\\s+(?:pe|par|me)\\s+(?:add|check|dekh|bata|batao|karo|daalo)\\b`,
  `\\b(?:${IDENTITIES})\\s+(?:${SOCIALS_SHORT})\\s+(?:pe|par|me)\\s+(?:bata|batao|dedo|do)\\b`,

].join('|'), 'gi');


export default {
  type: 'SOCIAL_MEDIA',
  pattern,
  reason: '🚫 Sharing social media handles or requesting to connect externally is not allowed.'
};