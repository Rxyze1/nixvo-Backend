/**
 * ════════════════════════════════════════════════════════════════
 * 🤬 TOXICITY & ABUSE FILTER
 * ════════════════════════════════════════════════════════════════
 */

const pattern = new RegExp([
  // ── English Core ───────────────────────────────────────
  '\\bf\\*ck\\b|\\bfucking\\b|\\bfuck\\s+you\\b|\\bfuk\\b|\\bfuker\\b',
  '\\bshit\\b|\\bshitty\\b|\\bshitter\\b|\\bbs\\b',
  '\\bbitch\\b|\\bbitches\\b|\\bson\\s+of\\s+a\\s+bitch\\b',
  '\\bastard\\b|\\bdick\\b|\\bdickhead\\b|\\basshole\\b',
  '\\bidiot\\b|\\bstupid\\b|\\bmoron\\b|\\bdumb\\b',
  
  // ── Hindi Core (Handles common misspellings) ───────────
  '\\bmad(?:ar)?ch(?:od|od|uda?)\\b',   // madarchod, madarchoda, madarchud
  '\\bb(?:hen)?ch(?:od|od|uda?)\\b',    // bhenchod, bc, bhenchuda
  '\\bch(?:ut|oot|iya)\\b',             // chut, choot, chutiya
  '\\bg(?:an)?d(?:u|oo)?\\b',           // gandu, gadu, gaand
  '\\bl(?:an)?d(?:a|u)?\\b',            // landa, lauda
  '\\bj(?:at)?t(?:a|u)?\\b',            // jatta, jatu
  '\\bkaminey\\b|\\bharami\\b|\\bkeeda\\b',
  '\\bsu(?:ar)?\\b',                    // suar / suar

  // ── Hinglish Combo Abuses ──────────────────────────────
  '\\b(?:teri|tumhari|meri)\\s+(?:maa|mother|mummy)\\b',
  '\\b(?:teri|tumhari)\\s+(?:maa|mother)\\s+ka\\b',

].join('|'), 'gi');


export default {
  type: 'TOXICITY',
  pattern,
  reason: '🚫 Using abusive language or slurs is not allowed. Keep the conversation professional.'
};
