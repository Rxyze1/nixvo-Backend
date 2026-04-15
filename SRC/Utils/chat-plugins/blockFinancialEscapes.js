/**
 * 💰 Block "pay directly", "avoid platform fees"
 */
const pattern = new RegExp([
  '(?:pay|send|transfer|money|cash|UPI)\\s+(?:directly|outside|off|offline|manually|personally|there)',
  '(?:avoid|save|skip|no|without|bypass)\\s+(?:platform|app|website|here|this|fee|commission|charges)',
].join('|'), 'gi');

export default {
  type: 'FINANCIAL_ESCAPE',
  pattern,
  reason: '🚫 Discussing off-platform payments is not allowed.'
};