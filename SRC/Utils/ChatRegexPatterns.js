import TextNormalizer from './TextNormalizer.js';
import IntentDetector from './IntentDetector.js';

/**
 * ════════════════════════════════════════════════════════════════
 *              💬 CHAT SECURITY GATEWAY (Clean Architecture)
 * ════════════════════════════════════════════════════════════════
 */
class ChatRegexPatterns {
  
  constructor() {
    console.log('💬 ChatRegexPatterns initialized (Clean Gateway)');
    console.log(`   🛡️ TextNormalizer active`);
    console.log(`   🧠 IntentDetector active`);

    this.normalizer = new TextNormalizer();
    this.intentEngine = new IntentDetector();

    this.ALLOWED_DOMAINS = [
      'drive.google.com', 'docs.google.com', 'dropbox.com', 'dl.dropboxusercontent.com',
      'onedrive.live.com', '1drv.ms', 'wetransfer.com', 'mega.nz', 'box.com',
      'amazonaws.com', 'cloudflare.com', 'r2.cloudflarestorage.com',
      'rzp.io', 'phonepe.com', 'paytm.com', 'pay.google.com', 'amazonpay.in',
      'bhimupi.org.in', 'mobikwik.com', 'freecharge.in'
    ];

    this.BLOCKED_DOMAINS = [
      'whatsapp.com', 'wa.me', 'web.whatsapp.com',
      'telegram.org', 't.me', 'web.telegram.org',
      'discord.com', 'discord.gg',
      'instagram.com', 'instagr.am',
      'facebook.com', 'fb.com', 'm.me',
      'twitter.com', 'x.com', 't.co',
      'snapchat.com', 'tiktok.com', 'linkedin.com',
      'messenger.com', 'signal.org', 'viber.com', 'wechat.com'
    ];

    this.UPI_HANDLES = [
      '@ybl', '@okaxis', '@okhdfcbank', '@okicici', '@paytm', '@ibl', 
      '@axl', '@upi', '@apl', '@oksbi', '@sbi', '@hdfc', '@kotak'
    ];

    this.PHONE_REGEX = /(?:(?:\+?\d{1,3}[-.\s]?)?\(?\d{1,4}\)?[-.\s]?)?\d{3}[-.\s]?\d{3}[-.\s]?\d{4}|\b\d{8}\b/gi;
    this.EMAIL_REGEX = /\b[A-Za-z0-9._%+-]+@(?!gmail|yahoo|outlook|hotmail|protonmail|icloud)[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/gi;
    this.PAYMENT_REGEX = /\b(paypal|venmo|cashapp|cash\s*app|zelle|bitcoin|btc|eth|crypto|wire\s*transfer)\b/gi;
    this.URL_REGEX = /(https?:\/\/[^\s]+)|(www\.[^\s]+)|([a-zA-Z0-9][a-zA-Z0-9-]{0,61}[a-zA-Z0-9]?\.[a-zA-Z]{2,}[^\s]*)/gi;
  }

  validateChatMessage(text, userId = 'anonymous') {
    if (!text || typeof text !== 'string') return { blocked: false, reason: 'Empty message', type: 'ALLOW' };

    const rawText = text;
    const normalizedText = this.normalizer.normalize(text);
    
    let warning = null;
    let allowedLinks = [];

    // ── UPI GUARD ────────────────────────────────────────────
    const hasUpi = this.UPI_HANDLES.some(h => rawText.toLowerCase().includes(h));
    let cleanText = rawText;
    if (hasUpi) {
      cleanText = this.UPI_HANDLES.reduce((t, handle) => 
        t.replace(new RegExp(handle.replace('@', '\\@'), 'gi'), ''), rawText);
    }

    // ── URL SYNERGY ─────────────────────────────────────────
    const urlMatches = rawText.match(this.URL_REGEX) || [];
    if (urlMatches.length > 0) {
      for (const url of urlMatches) {
        const urlLower = url.toLowerCase();
        const isBlocked = this.BLOCKED_DOMAINS.some(d => urlLower.includes(d));
        if (isBlocked) return { blocked: true, reason: `🚫 Sharing social media or messaging links is not allowed.`, type: 'BLOCKED_LINK' };
        
        const isAllowed = this.ALLOWED_DOMAINS.some(d => urlLower.includes(d));
        if (isAllowed) {
          allowedLinks.push(url);
          warning = '⚠️ Message contains an external file sharing or payment link.';
        }
      }
      if (allowedLinks.length === urlMatches.length && !this._checkPhones(normalizedText).blocked) {
        return { blocked: false, reason: 'Allowed external links', warning, type: 'ALLOW_LINKS' };
      }
    }

    // ── SMART PHONE CHECK ───────────────────────────────────
    const phoneCheck = this._checkPhones(normalizedText);
    if (phoneCheck.blocked) return phoneCheck;

    // ── EMAIL CHECK ──────────────────────────────────────────
    if (rawText.match(this.EMAIL_REGEX)?.length > 0) {
      return { blocked: true, reason: `🚫 Sharing personal email addresses is not allowed.`, type: 'EMAIL' };
    }

    // ── PAYMENT ESCAPE CHECK ────────────────────────────────
    if (normalizedText.match(this.PAYMENT_REGEX)?.length > 0) {
      return { blocked: true, reason: `🚫 Sharing direct payment method details is not allowed.`, type: 'PAYMENT' };
    }

    // ═══════════════════════════════════════════════════════════
    // 🧠 LAYER 2: INTENT & PLUGIN ENGINE (Delegated)
    // ═══════════════════════════════════════════════════════════
    const intentResult = this.intentEngine.analyzeIntent(normalizedText, rawText, userId);
    
    // If null, it's innocent. If object, it's blocked.
    if (intentResult) {
      return intentResult; 
    }

    return { blocked: false, reason: 'Message approved', warning, type: 'ALLOW' };
  }

  _checkPhones(text) {
    const strippedText = text.replace(/[.\-\s]/g, '');
    if (strippedText.match(/\d{8,15}/)) {
      return { blocked: true, reason: `🚫 Sharing phone numbers is not allowed.`, type: 'PHONE' };
    }
    const normalMatch = text.match(this.PHONE_REGEX);
    if (normalMatch && normalMatch[0].replace(/\D/g, '').length >= 8) {
      return { blocked: true, reason: `🚫 Sharing phone numbers is not allowed.`, type: 'PHONE' };
    }
    return { blocked: false };
  }
}

export default new ChatRegexPatterns();