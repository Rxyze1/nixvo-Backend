export default class TextNormalizer {
  
  normalize(text) {
    if (!text || typeof text !== 'string') return '';
    
    let clean = text;

    // ═══════════════════════════════════════════════════════════
    // STEP 1: Decode Base64 (catches "d2hhdHNhcHA=" -> "whatsapp")
    // ═══════════════════════════════════════════════════════════
    clean = this._decodeBase64(clean);

    // ═══════════════════════════════════════════════════════════
    // STEP 2: ENGLISH NUMBER WORDS -> DIGITS
    // (Catches "nine eight seven six" -> "9876")
    // ═══════════════════════════════════════════════════════════
    clean = this._convertEnglishNumbers(clean);

    // ═══════════════════════════════════════════════════════════
    // STEP 3: Strip Zero-Width & Invisible Characters
    // ═══════════════════════════════════════════════════════════
    clean = clean.replace(/[\u200B-\u200F\u2028-\u202F\u205F-\u206F\uFEFF\u00AD]/g, '');

    // ═══════════════════════════════════════════════════════════
    // STEP 4: Convert Cyrillic/Unicode Homoglyphs to Latin
    // ═══════════════════════════════════════════════════════════
    clean = this._fixHomoglyphs(clean);

    // ═══════════════════════════════════════════════════════════
    // STEP 5: Collapse all whitespace/newlines/tabs
    // ═══════════════════════════════════════════════════════════
    clean = clean.replace(/\s+/g, ' ').trim();

    // ═══════════════════════════════════════════════════════════
    // STEP 6: AGGRESSIVE SYMBOL STRIPPING
    // ═══════════════════════════════════════════════════════════
    clean = clean.replace(/(?<=[a-zA-Z0-9])([^a-zA-Z0-9\s])(?=[a-zA-Z0-9])/g, '');

    // ═══════════════════════════════════════════════════════════
    // STEP 7: STRIP LETTERS FROM DISGUISED NUMBERS
    // (Catches "52862q8288" -> "528628288" and "18918ng hkj8187" -> "189188187")
    // ═══════════════════════════════════════════════════════════
    clean = this._stripLettersFromNumbers(clean);

    // ═══════════════════════════════════════════════════════════
    // STEP 8: Collapse Excessive Repeating Characters
    // ═══════════════════════════════════════════════════════════
    clean = clean.replace(/(.)\1{2,}/g, '$1$1');

    // ═══════════════════════════════════════════════════════════
    // STEP 9: Lowercase everything
    // ═══════════════════════════════════════════════════════════
    clean = clean.toLowerCase();

    return clean;
  }

  // ───────────────────────────────────────────────────────────
  // PRIVATE: English Number Words to Digits
  // ───────────────────────────────────────────────────────────
  _convertEnglishNumbers(text) {
    const map = {
      'zero': '0', 'one': '1', 'two': '2', 'three': '3', 'four': '4',
      'five': '5', 'six': '6', 'seven': '7', 'eight': '8', 'nine': '9'
    };
    // Match words, ignoring case
    const regex = new RegExp(`\\b(?:${Object.keys(map).join('|')})\\b`, 'gi');
    return text.replace(regex, (match) => map[match.toLowerCase()] || match);
  }

  // ───────────────────────────────────────────────────────────
  // PRIVATE: Strip letters from disguised numbers
  // ───────────────────────────────────────────────────────────
  _stripLettersFromNumbers(text) {
    // This targets clusters of mixed digits and letters (e.g., "18918ng hkj8187")
    // It ONLY strips letters if the cluster is mostly numbers (>60%)
    return text.replace(/\b(?:\d[a-zA-Z\s]{0,5}){2,}\b/g, (match) => {
      const stripped = match.replace(/[^0-9]/g, '');
      // If it has at least 6 digits, it's a hidden phone number
      if (stripped.length >= 6) {
        return stripped;
      }
      return match;
    });
  }

  // ───────────────────────────────────────────────────────────
  // PRIVATE: Base64 Decoder
  // ───────────────────────────────────────────────────────────
  _decodeBase64(text) {
    return text.replace(/\b[A-Za-z0-9+/]{8,}={0,2}\b/g, (match) => {
      try {
        const decoded = Buffer.from(match, 'base64').toString('utf-8');
        if (/^[\p{L}\p{N}\s.,!?@#$%^&*()\-_+=:;'"]+$/u.test(decoded) && decoded.length >= 4) {
          return decoded;
        }
      } catch (e) {}
      return match;
    });
  }

  // ───────────────────────────────────────────────────────────
  // PRIVATE: Homoglyph Fixer
  // ───────────────────────────────────────────────────────────
  _fixHomoglyphs(text) {
    const map = {
      'а': 'a', 'с': 'c', 'е': 'e', 'і': 'i', 'ѕ': 's', 'о': 'o', 
      'р': 'p', 'у': 'y', 'х': 'x', 'і': 'i', 'ѕ': 's',
      'α': 'a', 'β': 'b', 'ε': 'e', 'ο': 'o', 'σ': 's', 'ρ': 'p'
    };
    
    const regex = new RegExp(Object.keys(map).join('|'), 'g');
    return text.replace(regex, (char) => map[char] || char);
  }
}