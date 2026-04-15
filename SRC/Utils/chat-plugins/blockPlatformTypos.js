/**
 * ════════════════════════════════════════════════════════════════════════════
 * ⌨️ MONSTER-LEVEL PLATFORM TYPO & OBFUSCATION ENGINE
 * ════════════════════════════════════════════════════════════════════════════
 * 
 * TextNormalizer handles: dots, spaces, zero-width, base64.
 * THIS plugin handles:
 * 1. Leetspeak (a->4, e->3, i->1, o->0, s->5, t->7)
 * 2. Vowel Dropping (whatsapp -> whtspp, insta -> nsta)
 * 3. Phonetic Swaps (Hindi speakers: v instead of w -> vatsapp)
 * 4. Keyboard Proximity Typos (z instead of s, i instead of o)
 * 5. Short-Code Context Guards (blocking "wa" only if used as a noun)
 * 
 */

// ═══════════════════════════════════════════════════════════════
// 🛡️ LEETSPEAK CHARACTER MAPPINGS (Used deep inside patterns)
// a = [a, 4, @]
// e = [e, 3]
// i = [i, 1, !]
// o = [o, 0]
// s = [s, 5, $]
// t = [t, 7]
// ═══════════════════════════════════════════════════════════════


// ═══════════════════════════════════════════════════════════════
// 🟢 WHATSAPP DEEP MATRIX
// ═══════════════════════════════════════════════════════════════
const WHATSAPP_LEET = [
  'wh[a4@][t7][s5$][a4@]pp',   // wh4ts4pp, wh@t$app
  'w[a4@][t7][s5$][a4@]pp',    // w4ts4pp
  'v[a4@][t7][s5$][a4@]pp',    // v4ts4pp (Phonetic 'v' for 'w')
  'wh[t7][s5$][a4@]pp',        // wh7s4pp (Dropped 'a')
];

const WHATSAPP_PHONETIC = [
  'whatsapp', 'watsapp', 'vatsapp', 'whtsapp', 'whatsapp',
  'whatzapp', 'watsap', 'watzap', 'vatsap', 'whtsap',
  'whutsapp', 'wutsap', 'hwatsapp', 'whasapp', 'wasapp',
  'whatsupp', 'watsupp', 'whatzupp', 'whatsap', 'whtsap'
];

const WHATSAPP_SHORTS = [
  'wa', 'wp', 'wts', 'wtz', 'wap'
];


// ═══════════════════════════════════════════════════════════════
// 📸 INSTAGRAM DEEP MATRIX
// ═══════════════════════════════════════════════════════════════
const INSTAGRAM_LEET = [
  '[i1!][n][s5$][t7][a4@][g9]r[a4@]m', // 1nsta9ram
  '[i1!][n][s5$][t7][a4@]',            // 1nst4
  '[i1!][n][s5$]t[a4@]g[r][a4@]m',     // 1nst@gr@m
];

const INSTAGRAM_PHONETIC = [
  'instagram', 'instgram', 'instagraam', 'instgrm', 'ingram',
  'instagarm', 'instagrem', 'instageram', 'instagaram',
  'insttagram', 'insagram', 'instarum', 'instagrum', 'instagran'
];

const INSTAGRAM_SHORTS = [
  'insta', 'igram', 'igrm', 'ig'
];


// ═══════════════════════════════════════════════════════════════
// ✈️ TELEGRAM DEEP MATRIX
// ═══════════════════════════════════════════════════════════════
const TELEGRAM_LEET = [
  '[t7][e3]l[e3]g[r][a4@]m',   // 7el3gr4m
  '[t7][e3]l[e3]',             // 7el3
  '[t7][e3]l[i1]g[r][a4@]m',   // 7el1gr4m
];

const TELEGRAM_PHONETIC = [
  'telegram', 'telegrem', 'telegrum', 'telegarm', 'telegeram',
  'telegrsm', 'tellegram', 'telegrarn', 'talegram', 'teelgram',
  'telegaram', 'telagram', 'telegrma', 'teelgram'
];

const TELEGRAM_SHORTS = [
  'tg', 'tgram', 'tele', 'teli', 'teli'
];


// ═══════════════════════════════════════════════════════════════
// 🎮 DISCORD DEEP MATRIX
// ═══════════════════════════════════════════════════════════════
const DISCORD_LEET = [
  'd[1!][s5$]c[0o]rd',   // d1sc0rd
  'd[1!][s5$][0o]',      // d1sc0
  'd[1!][s5$]c[o0]r[d]', // d!$c0rd
];

const DISCORD_PHONETIC = [
  'discord', 'discrod', 'disocrd', 'dsicord', 'dicsord',
  'discor', 'disord', 'discrd', 'descord', 'diskord',
  'dscord', 'disccord'
];

const DISCORD_SHORTS = [
  'dc', 'disco'
];


// ═══════════════════════════════════════════════════════════════
// 📘 FACEBOOK DEEP MATRIX
// ═══════════════════════════════════════════════════════════════
const FACEBOOK_LEET = [
  'f[a4@]c[e3]b[0o][0o]k', // f4c3b00k
  'f[a4@]c[e3][b8]',       // f4c3b
];

const FACEBOOK_PHONETIC = [
  'facebook', 'facebok', 'faceboo', 'facebbook', 'faceook',
  'facbook', 'fcebook', 'facebokk', 'faecbook', 'faceboook',
  'faceb00k'
];

const FACEBOOK_SHORTS = [
  'fb', 'fbook', 'fbk', 'fkb'
];


// ═══════════════════════════════════════════════════════════════
// 👻 SNAPCHAT / SIGNAL / OTHERS MATRIX
// ═══════════════════════════════════════════════════════════════
const SNAPCHAT_MATRIX = [
  'snapchat', 'snapcaht', 'snapcht', 'snapshat', 'snappchat',
  'snap', 'snpchat', 'sc'
];

const SIGNAL_MATRIX = [
  'signal', 'signl', 'signaal', 'siggnal', 'siignal', 'signall'
];

const MESSENGER_MATRIX = [
  'messenger', 'messanger', 'messengr', 'messenger', 'mesenger',
  'massenger', 'msgnger'
];


// ═══════════════════════════════════════════════════════════════
// 🚨 SHORT-CODE CONTEXT GUARD (CRITICAL FOR NO FALSE POSITIVES)
// ═══════════════════════════════════════════════════════════════
// We cannot just block "wa", "ig", "dc" alone. It breaks chat.
// We ONLY block them if preceded/followed by context words.
// Examples: "msg me on wa", "my ig id", "join dc", "wa pe"
// ═══════════════════════════════════════════════════════════════

const CONTEXT_PRECEEDING = [
  'my', 'me', 'on', 'at', 'to', 'in', 'via', 'use', 'using',
  'join', 'add', 'find', 'search', 'check', 'dm', 'ping',
  'text', 'call', 'msg', 'message', 'contact', 'reach', 'send'
];

const CONTEXT_FOLLOWING = [
  'pe', 'par', 'id', 'handle', 'profile', 'account', 'link',
  'karo', 'kro', 'do', 'dedo', 'lena', 'jao', 'pay', 'group',
  'server', 'channel'
];

// Build short code context regex patterns
function buildContextPatterns(shortCodes) {
  const patterns = [];
  
  // Preceeding context: "(msg|my|on) wa"
  const preRegex = `(?:${CONTEXT_PRECEEDING.join('|')})\\s+(?:${shortCodes.join('|')})\\b`;
  patterns.push(preRegex);

  // Following context: "wa (pe|id|karo)"
  const folRegex = `\\b(?:${shortCodes.join('|')})\\s+(?:${CONTEXT_FOLLOWING.join('|')})\\b`;
  patterns.push(folRegex);

  return patterns;
}

const WA_CONTEXT = buildContextPatterns(WHATSAPP_SHORTS);
const IG_CONTEXT = buildContextPatterns(INSTAGRAM_SHORTS);
const TG_CONTEXT = buildContextPatterns(TELEGRAM_SHORTS);
const DC_CONTEXT = buildContextPatterns(DISCORD_SHORTS);
const FB_CONTEXT = buildContextPatterns(FACEBOOK_SHORTS);


// ═══════════════════════════════════════════════════════════════
// 🧩 ACTION PHRASE MATRIX (Implicit references)
// ═══════════════════════════════════════════════════════════════
const ACTION_PHRASES = [
  // Generic app references
  '(?:green|blue|double\\s*tick|tick\\s*tick)\\s*(?:app|message|chat)',
  '(?:bird|paper\\s*plane|blue\\s*icon)\\s*(?:app|message|chat)',
  '(?:purple|robot|game)\\s*(?:app|chat|server)',
  '(?:camera|yellow|story)\\s*(?:app|chat|handle)',
  
  // Direct actions with generic nouns
  '(?:add\\s*me\\s*on|join\\s*my|check\\s*my)\\s+(?:app|chat|socials|profile|handle)',
  '(?:move\\s*to|shift\\s*to|continue\\s*on)\\s+(?:dm|direct|personal|private)',
  
  // Number + app combo bypasses
  '(?:\\d{4,}\\s*(?:is\\s*my|on\\s*my)\\s*(?:wa|ig|tg|dc|fb|snap))'
];


// ═══════════════════════════════════════════════════════════════
// ⚙️ MASTER PATTERN ASSEMBLY
// ═══════════════════════════════════════════════════════════════

// Helper to wrap arrays in non-capturing groups and word boundaries
const bound = (arr) => arr.map(p => `\\b(?:${p})\\b`);
const exact = (arr) => arr.map(p => `(?:${p})`);

// 1. Compile Long Words (No context needed, unique enough)
const longWords = [
  ...exact(WHATSAPP_LEET),
  ...bound(WHATSAPP_PHONETIC),
  ...exact(INSTAGRAM_LEET),
  ...bound(INSTAGRAM_PHONETIC),
  ...exact(TELEGRAM_LEET),
  ...bound(TELEGRAM_PHONETIC),
  ...exact(DISCORD_LEET),
  ...bound(DISCORD_PHONETIC),
  ...exact(FACEBOOK_LEET),
  ...bound(FACEBOOK_PHONETIC),
  ...bound(SNAPCHAT_MATRIX),
  ...bound(SIGNAL_MATRIX),
  ...bound(MESSENGER_MATRIX)
];

// 2. Compile Short Words (REQUIRES context to avoid false positives)
const shortWords = [
  ...WA_CONTEXT,
  ...IG_CONTEXT,
  ...TG_CONTEXT,
  ...DC_CONTEXT,
  ...FB_CONTEXT
];

// 3. Compile Action Phrases
const actions = exact(ACTION_PHRASES);

// Combine everything into the final monster regex
const finalPatternArray = [
  ...longWords,
  ...shortWords,
  ...actions
];

const pattern = new RegExp(finalPatternArray.join('|'), 'gi');


// ═══════════════════════════════════════════════════════════════
// 🚀 EXPORT
// ═══════════════════════════════════════════════════════════════
export default {
  type: 'PLATFORM_TYPO',
  pattern,
  reason: '🚫 Sharing messaging app names or attempting to bypass filters is not allowed.'
};