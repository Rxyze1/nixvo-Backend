/**
 * ════════════════════════════════════════════════════════════════
 * 📞 ADVANCED LIGHTWEIGHT DIRECT CONTACT EXTRACTOR
 * ════════════════════════════════════════════════════════════════
 * Uses ultra-compressed regex groups to catch massive variations
 * without hitting V8 engine size limits.
 */

// ═══════════════════════════════════════════════════════════════
// ⚙️ COMPRESSED LEXICON (Catches typos via optional letters)
// ═══════════════════════════════════════════════════════════════
const PRONOUNS = '(?:my|your|mer[ae]|tumh[ae]r[ae]|aapk[ae]|ter[ei])';
const CONTACTS = '(?:num(?:ber)?|mo(?:bile)?|ph(?:one)?|cell|tel|contact|det(?:ails)?|info(?:rmation)?)';
const DIGITAL = '(?:e?mail|g?mail|id|i\\.?d\\.?|user\\s*id|handle|prof(?:ile)?)';

// ── Action Verbs (Grouped by type) ───────────────────────
const VERBS_RECEIVE = '(?:take|get|have|save|cop(?:y)?|keep|note\\s*down|store)';
const VERBS_SEND = '(?:share|send|drop|leave|provide|give|forward|pass|show|reveal)';
const VERBS_STATE = '(?:is|are|was|were|hai|h[ae]in|he|equals|\\:|\\-|→|>>)';
const HINGLISH_ACT = '(?:do|dedo|bhejo?|b[ae]j|share|karo?|bat[ae]|daalo?|dikha)';

// ── Question Starters ────────────────────────────────────
const Q_STARTERS = '(?:what\\s*(?:is|are)|whats|kya\\s*hai|bat[ae]\\s*na|tell\\s*me)';


// ═══════════════════════════════════════════════════════════════
// 🧱 PATTERN ASSEMBLY (Lightweight but covers everything)
// ═══════════════════════════════════════════════════════════════
const pattern = new RegExp([

  // 1. [PRONOUN] [NOUN] [STATE] -> "my number is", "mera mobile hai"
  `\\b${PRONOUNS}\\s+(?:${CONTACTS}|${DIGITAL})\\s+${VERBS_STATE}\\b`,
  
  // 2. [RECEIVE VERB] [PRONOUN] [NOUN] -> "take my number", "get your contact"
  `\\b${VERBS_RECEIVE}\\s+${PRONOUNS}\\s+(?:${CONTACTS}|${DIGITAL})\\b`,
  
  // 3. [SEND VERB] [PRONOUN] [NOUN] -> "share my email", "give your id"
  `\\b${VERBS_SEND}\\s+${PRONOUNS}\\s+(?:${CONTACTS}|${DIGITAL})\\b`,

  // 4. Direct Dumps -> "here is my number", "reach me at email"
  `\\b(?:here\\s*(?:is|are)|find\\s*me\\s*at|reach\\s*me\\s*at|mail\\s*me\\s*at)\\s*[:\\-]?\\s*${PRONOUNS}?\\s*(?:${CONTACTS}|${DIGITAL})\\b`,

  // 5. Hinglish State -> "number kya hai", "id do", "mera mobile hai"
  `\\b(?:${CONTACTS}|${DIGITAL})\\s*(?:kya|kyu|kaise|konsa)\\s*(?:${VERBS_STATE}|${HINGLISH_ACT})\\b`,
  `\\bapn[ae]\\s*(?:${CONTACTS}|${DIGITAL})\\s*${HINGLISH_ACT}\\b`,
  `\\bmer[ae]\\s*(?:${CONTACTS}|${DIGITAL})\\s*(?:ye\\s*)?${VERBS_STATE}\\b`,
  `\\b(?:${CONTACTS}|${DIGITAL})\\s+${HINGLISH_ACT}\\b`, // "number dedo"

  // 6. Questions -> "what is your number?", "kya hai tumhara id"
  `\\b${Q_STARTERS}\\s+${PRONOUNS}\\s+(?:${CONTACTS}|${DIGITAL})\\??`,

  // 7. Extreme Short Codes (2 words) -> "number do", "id batao"
  `\\b(?:${CONTACTS}|${DIGITAL})\\s+${HINGLISH_ACT}\\b`

].join('|'), 'gi');


export default {
  type: 'DIRECT_CONTACT',
  pattern,
  reason: '🚫 Requesting, sharing, or extracting contact information is not allowed.'
};