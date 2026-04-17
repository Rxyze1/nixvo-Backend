/**
 * ════════════════════════════════════════════════════════════════════════════
 * 🇮🇳 ULTRA-FAST HINGLISH DIRECT ACTION ENGINE (No Loops = No Lag)
 * ════════════════════════════════════════════════════════════════════════════
 */

// ═══════════════════════════════════════════════════════════════
// 🗣️ MATRIX 1: HINGLISH PRONOUNS
// ═══════════════════════════════════════════════════════════════
const PRONOUNS_TARGET_ME = ['mujhe', 'muje', 'mujhko', 'mje', 'mereko', 'mere ko', 'mera', 'humko', 'humein', 'humen'];
const PRONOUNS_TARGET_YOU = ['apko', 'aapko', 'aap ko', 'tumhe', 'tumko', 'tumheko', 'tujhe', 'tu', 'tera', 'tumara'];
const PRONOUNS_TARGET_THEM = ['usko', 'ushe', 'isko', 'inko', 'unko', 'uska', 'iska', 'unka'];
const ALL_PRONOUNS = [...PRONOUNS_TARGET_ME, ...PRONOUNS_TARGET_YOU, ...PRONOUNS_TARGET_THEM];

// ═══════════════════════════════════════════════════════════════
// 🚫 MATRIX 2: NEGATIVE GUARDS
// ═══════════════════════════════════════════════════════════════
const NEGATIVE_WORDS = ['mat', 'math', 'maat', 'nahi', 'nahin', 'no', 'not', 'bilkul nahi', 'zaroor nahi'];
const NEGATIVE_LOOKAHEAD = `(?!\\s*(?:${NEGATIVE_WORDS.join('|')})\\b)`;

// ═══════════════════════════════════════════════════════════════
// 📞 MATRIX 3: ENGLISH ACTION VERBS
// ═══════════════════════════════════════════════════════════════
const VERBS_CALL = ['call', 'kal', 'kall', 'dial', 'dal', 'daal', 'ring', 'ringing', 'ring karo', 'bell', 'bell baja', 'bell bja'];
const VERBS_MESSAGE = ['msg', 'mgs', 'ems', 'massg', 'message', 'messege', 'mesage', 'messag', 'text', 'txt', 'tet', 'sms', 'esm', 'ping', 'peng', 'png', 'dm', 'dm karo', 'pm', 'inbox', 'inbux'];
const VERBS_MEDIA = ['vc', 'video call', 'video\\s*call', 'audio call', 'audio\\s*call', 'voice call', 'voice\\s*call', 'videocall', 'audiocall'];
const ALL_VERBS = [...VERBS_CALL, ...VERBS_MESSAGE, ...VERBS_MEDIA];

// ═══════════════════════════════════════════════════════════════
// 🇮🇳 MATRIX 4: HINDI SUFFIXES
// ═══════════════════════════════════════════════════════════════
const SUFFIXES_DO = ['karo', 'kro', 'kru', 'krlo', 'kar', 'kr', 'karna', 'krna', 'krdo', 'kar do', 'kar dena'];
const SUFFIXES_GIVE = ['do', 'dedo', 'de do', 'dijiye', 'de', 'dena', 'deiye'];
const SUFFIXES_SEND = ['bhejo', 'bhej', 'bhejna', 'bhej do', 'bhjeo', 'bhejdo', 'send', 'send karo'];
const SUFFIXES_PUT = ['daalo', 'dalo', 'dal do', 'daal do', 'lagao', 'laga', 'lagana'];
const SUFFIXES_MISC = ['utha', 'uthao', 'utha lo', 'mil', 'milna', 'milte', 'milte hain', 'jao', 'ja', 'jaye', 'jana', 'lena', 'le lo', 'lekarna', 'rakh', 'rakho', 'rakhna', 'check', 'dekho', 'dekh'];
const ALL_SUFFIXES = [...SUFFIXES_DO, ...SUFFIXES_GIVE, ...SUFFIXES_SEND, ...SUFFIXES_PUT, ...SUFFIXES_MISC];

// ═══════════════════════════════════════════════════════════════
// 🎯 MATRIX 5: TARGET LOCATIONS
// ═══════════════════════════════════════════════════════════════
const TARGETS_MEDIUM = ['pe', 'par', 'per', 'me', 'mein', 'men', 'se', 'tak', 'upar', 'niche', 'k andar', 'ke andar'];
const TARGETS_NOUNS = ['number', 'num', 'mobile', 'phone', 'cell', 'id', 'i\\.?d', 'handle', 'profile', 'personal', 'private', 'direct', 'wa', 'wp', 'watsapp', 'whatsapp', 'insta', 'instagram', 'ig', 'tg', 'telegram', 'tele', 'dc', 'discord', 'dscord', 'fb', 'facebook', 'snap', 'sc'];

// ═══════════════════════════════════════════════════════════════
// ⏱️ MATRIX 6: TIME & URGENCY MODIFIERS
// ═══════════════════════════════════════════════════════════════
const TIME_MODIFIERS = ['abhi', 'ab', 'aab', 'jaldi', 'jldi', 'fast', 'kal', 'kal ko', 'aaj', 'aaj hi', 'sham ko', 'shaam', 'evening', 'raat ko', 'rat ko', 'night', 'subah', 'morning', 'tb', 'tab', 'jab', 'kabhi', 'kbhi'];
const PLEASANTRIES = ['please', 'plz', 'plzz', 'pliz', 'bhai', 'bhaiya', 'bro', 'bros', 'yaar', 'yar', 'dost', 'frnd', 'ji', 'sahab', 'sir', 'madam'];
const ALL_MODIFIERS = [...TIME_MODIFIERS, ...PLEASANTRIES];

// ═══════════════════════════════════════════════════════════════
// 🧩 MATRIX 7: STANDALONE IDIOMATIC PHRASES
// ═══════════════════════════════════════════════════════════════
const IDIOMATIC_ACTIONS = [
  'phone\\s*(?:karo|kro|uthao|rakho|dekh|check)',
  'phone\\s*(?:pe|par|me)\\s*(?:aao|aa|milte|baat)',
  'call\\s*(?:lagao|laga|lagao|uthao)',
  'notification\\s*(?:baja|dekho|check|karo|dono)',
  'online\\s*(?:aao|aa|jao|dikha)',
  'green\\s*tick\\s*(?:aao|aa|dikha)',
  'main\\s*(?:call|kal)\\s*(?:karunga|karounga|krunga|karu)',
  'hum\\s*(?:call|kal|msg)\\s*(?:karenge|krenge|kare)',
  'haan\\s*bhi\\s*(?:call|msg|dm)\\s*(?:karo|kr|do)',
  'seedha\\s*(?:call|msg|dm)\\s*(?:karo|kr|do|jao)',
  '(?:dobara|fir\\s*se|again)\\s*(?:call|msg|dm|ping)\\s*(?:karo|kro|do|bhejo)',
  'ek\\s*(?:bar|baar)\\s*(?:call|msg)\\s*(?:karo|kr|do|bhejo)'
];

// ═══════════════════════════════════════════════════════════════
// ⚙️ ULTRA-FAST FLAT PATTERN ASSEMBLY (No Loops = No Lag)
// ═══════════════════════════════════════════════════════════════

const group = (arr) => `(?:${arr.join('|')})`;
const boundGroup = (arr) => `\\b(?:${arr.join('|')})\\b`;

// Combine all arrays into single flat groups
const G_PRONOUN = boundGroup(ALL_PRONOUNS);
const G_VERB = group([...VERBS_CALL, ...VERBS_MESSAGE, 'call', 'msg', 'dm', 'ping', 'vc']);
const G_SUFFIX = group(ALL_SUFFIXES);
const G_TARGET_NOUN = group(TARGETS_NOUNS);
const G_TARGET_MED = group(TARGETS_MEDIUM);
const G_TIME = group(TIME_MODIFIERS);
const G_NEGATIVE = `(?!\\s*(?:mat|math|maat|nahi|nahin|no|not|bilkul nahi|zaroor nahi)\\b)`;

// Formula 1: Pronoun + Negative Guard + Verb + Suffix
const formula1 = `${G_PRONOUN}${G_NEGATIVE}\\s+${G_VERB}\\s+${G_SUFFIX}\\b`;

// Formula 2: Pronoun + Target + Medium + Verb + Suffix
const formula2 = `${G_PRONOUN}\\s+${G_TARGET_NOUN}\\s+${G_TARGET_MED}\\s+${G_VERB}\\s+${G_SUFFIX}\\b`;

// Formula 3: Verb + Suffix + Pronoun (Inverted)
const formula3 = `\\b${G_VERB}\\s+(?:karo|kro|kru|krlo|kar|kr|karna|krna|krdo|do|dedo|de do|dijiye)\\s+${G_PRONOUN}\\b`;

// Formula 4: Time + Verb + Suffix + Pronoun
const formula4 = `\\b${G_TIME}\\s+${G_VERB}\\s+${G_SUFFIX}\\s+${G_PRONOUN}\\b`;

// Combine safely
const finalPatternString = [
  formula1,
  formula2,
  formula3,
  formula4,
  ...IDIOMATIC_ACTIONS
].join('|');

// 🚀 SUPER FAST REGEX
const pattern = new RegExp(finalPatternString, 'gi');

// ═══════════════════════════════════════════════════════════════
// 🚀 EXPORT
// ═══════════════════════════════════════════════════════════════
export default {
  type: 'HINDI_ACTION',
  pattern,
  reason: '🚫 Asking to initiate direct contact or off-platform communication is not allowed.'
};