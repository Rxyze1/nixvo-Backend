/**
 * ════════════════════════════════════════════════════════════════════════════
 * 🚪 ALIEN-ADVANCED OFF-PLATFORM ESCAPE ENGINE
 * ════════════════════════════════════════════════════════════════════════════
 * 
 * DESIGN PHILOSOPHY:
 * We DO NOT list app names here (wa, insta, etc). The TypoPlugin handles that.
 * This plugin ONLY catches the "INTENT TO ESCAPE" using contextual verbs, 
 * evasive nouns, Hinglish slang, and conversational bypasses.
 * 
 * CATCHES:
 * - "let's take this offline"
 * - "where else can I reach you?"
 * - "bahar baat karo"
 * - "drop your number"
 * - "is there any other way to chat?"
 * 
 */

// ═══════════════════════════════════════════════════════════════
// 🚨 CATEGORY 1: EXPLICIT ESCAPE VERBS (English)
// ═══════════════════════════════════════════════════════════════
const EXPLICIT_ESCAPES = [
  // "take/move/go offline"
  '(?:take|move|go|shift|carry|bring|switch)\\s+(?:this\\s+)?(?:chat|talk|conversation|discussion)\\s+(?:offline|off\\s*platform|outside|elsewhere|privately|externally|away)',
  
  // "not on here / avoid platform"
  "(?:not|don'?t|avoid|no|stop|do\\s*not)\\s+(?:chat|talk|discuss|share|send|pay|do)\\s+(?:here|on\\s*this|in\\s*this|on\\s*the\\s*app|on\\s*this\\s*platform|publicly)",
  
  // "continue somewhere else"
  '(?:continue|finish|complete|proceed|wrap\\s*up)\\s+(?:this\\s+)?(?:chat|talk|deal|discussion|transaction|payment)\\s+(?:somewhere\\s*else|elsewhere|outside|privately|there|over\\s*there)'
];


// ═══════════════════════════════════════════════════════════════
// 🔍 CATEGORY 2: EVASIVE QUESTIONS (The "Fishing" Attempts)
// ═══════════════════════════════════════════════════════════════
const EVASIVE_QUESTIONS = [
  // "where else can I contact you?"
  '(?:where|kaha|kahan)\\s+(?:else|aur)\\s+(?:can\\s*i|should\\s*i|to|could\\s*we)\\s+(?:reach|contact|message|talk|chat|ping|connect|pay|send\\s*money)\\s+(?:you|u|tumhe|aapko)\\??',
  
  // "is there another way?"
  '(?:is\\s*there|do\\s*you\\s*have|kya\\s*hai|koi\\s*bhi)\\s+(?:any|koi|some\\s*other)\\s+(?:other|aur)\\s+(?:way|method|option|mode|platform|app|place|tarika)\\s+(?:to\\s+)?(?:connect|talk|chat|pay|contact|discuss|reach)\\??',
  
  // "can I get your direct..."
  '(?:can\\s*i|let\\s*me\\s*get|i\\s*need|muje\\s*chahiye|dedo\\s*bhai)\\s+(?:your|ur|tumhara|aapka)\\s+(?:direct|personal|private|real)\\s+(?:contact|number|id|details|info)',
  
  // "how to contact you directly?"
  '(?:how\\s*(?:can|do|to)|kaise)\\s+(?:i|we|hum|mein)\\s+(?:contact|reach|talk|chat|connect|pay)\\s+(?:you|u|tumhe|aapko)\\s+(?:directly|personally|privately|outside|offline)\\??'
];


// ═══════════════════════════════════════════════════════════════
// 📞 CATEGORY 3: DIRECT CONTACT EXTRACTORS (Demanding info)
// ═══════════════════════════════════════════════════════════════
const CONTACT_EXTRACTORS = [
  // "drop your number / share your contact"
  '(?:drop|leave|share|give|send|provide|write|type|dikha|bata)\\s+(?:your|ur|apna|tumhara|aapka)\\s+(?:number|num|contact|phone|mobile|digits|mail|email|id|handle|details)\\s*(?:please|plz|bhai|bro|yaar)?\\b',
  
  // "give me your digits / send your personal"
  '(?:give|send|provide|dedo|do|bhejo)\\s+(?:me|muje|humko)\\s+(?:your|ur|tumhara|aapka)\\s+(?:personal|private|direct|real|actual)\\s+(?:number|contact|id|details|info)',
  
  // "what is your number / number kya hai"
  "(?:what\\s*is|what'?s|whats|kya\\s*hai|number\\s*kya)\\s+(?:your|ur|tumhara|aapka)\\s+(?:number|contact|phone|mobile|personal|id)\\??"
];


// ═══════════════════════════════════════════════════════════════
// 🇮🇳 CATEGORY 4: HINGLISH ESCAPE MATRIX (Deep Regional Slang)
// ═══════════════════════════════════════════════════════════════
const HINGLISH_ESCAPES = [
  // "bahar baat karo" (talk outside)
  '(?:bahar|alag|dusri|kisi\\s*aur)\\s+(?:jagah|place|id|app|pe|par|platform)\\s+(?:baat|chat|karo|kar|kriye|pe\\s*aao|pe\\s*milte)',
  
  // "personal pe bhejo" (send on personal)
  '(?:personal|private|apni|real)\\s+(?:pe|par|id|chat|number)\\s+(?:bhejo|bhej|do|dedo|daalo|karo|share|send|msg)',
  
  // "seedha contact karo" (contact directly)
  '(?:seedha|sidha|directly|direct)\\s+(?:contact|call|msg|message|pay|karo|kar|paise|bhijwa|bhej)',
  
  // "dm pe aa / inbox karo"
  '(?:dm|inbox|pm|direct)\\s+(?:pe|par|me|inside)\\s+(?:aao|aa|jao|ja|karo|kar|daalo|check|dekh|bhejo|milte)',
  
  // "yahan pe mat bolo" (don't talk here)
  '(?:yahan|ye|idhar|iske\\s*andar|iske\\s*upar)\\s+(?:pe|par|me)\\s*(?:mat|nahi|no)\\s+(?:bolo|baat|karo|likh|share|bhejo|batna)',
  
  // "platform fee bachane ke liye" (to save platform fee)
  '(?:platform|app|website)\\s+(?:fee|charge|commission|cut)\\s+(?:bachane|save|avoid|kam)\\s+(?:ke\\s*liye|karo|karke|waje|se)'
];


// ═══════════════════════════════════════════════════════════════
// 🛡️ CATEGORY 5: INBOX / DM REDIRECTS (Sneaky routing)
// ═══════════════════════════════════════════════════════════════
const INBOX_REDIRECTS = [
  // "check your dm/inbox"
  '(?:check|dekh|see)\\s+(?:your|ur|tumhara|aapka)\\s+(?:dm|inbox|direct|pm|messages|requests)',
  
  // "I've sent you a dm/request"
  "(?:i\\s*(?:have|'?ve|sent)|muje\\s*bhej\\s*diya|hume\\s*bhej\\s*diya)\\s+(?:you|u|tumhe|aapko)\\s+(?:a|the|ek)\\s+(?:dm|request|message|inbox|mail)",
  
  // "accept my request there"
  '(?:accept|approve|confirm|receive|receive)\\s+(?:my|meri|hamari)\\s+(?:request|dm|invite|connection)\\s+(?:there|wahan|please|plz)\\b'
];


// ═══════════════════════════════════════════════════════════════
// 💀 CATEGORY 6: CODED / CRYPTO ESCAPE ATTEMPTS
// ═══════════════════════════════════════════════════════════════
const CODED_ESCAPES = [
  // "google my name" / "search my username"
  '(?:google|search|look\\s*up|find)\\s+(?:my|meri)\\s+(?:name|username|handle|id|profile|number)\\s*(?:please|plz|bro|bhai)?\\b',
  
  // "check my bio" / "link is in my profile"
  '(?:check|see|dekh)\\s+(?:my|meri)\\s+(?:bio|profile|about|description|status)\\s+(?:for|pe|me)\\s+(?:details|contact|info|link|number)',
  
  // "my number is on my profile"
  '(?:my|meri)\\s+(?:number|contact|details|id|info)\\s+(?:is\\s+)?(?:on\\s+)?(?:my|meri)\\s+(?:profile|bio|about|page|account)'
];


// ═══════════════════════════════════════════════════════════════
// ⚙️ MASTER PATTERN ASSEMBLY
// ═══════════════════════════════════════════════════════════════

const finalPatternArray = [
  ...EXPLICIT_ESCAPES,
  ...EVASIVE_QUESTIONS,
  ...CONTACT_EXTRACTORS,
  ...HINGLISH_ESCAPES,
  ...INBOX_REDIRECTS,
  ...CODED_ESCAPES
];

// Combine with case-insensitive, global flags
const pattern = new RegExp(finalPatternArray.join('|'), 'gi');


// ═══════════════════════════════════════════════════════════════
// 🚀 EXPORT
// ═══════════════════════════════════════════════════════════════
export default {
  type: 'OFF_PLATFORM',
  pattern,
  reason: '🚫 Asking to move the conversation, share contact details, or bypass this platform is not allowed.'
};