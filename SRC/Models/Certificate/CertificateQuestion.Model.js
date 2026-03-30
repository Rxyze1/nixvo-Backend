// Models/Certificate/CertificateQuestion.Model.js

import mongoose from 'mongoose';
import { backupDocument } from '../../Service/Backup-DB/backupService.js';

// ═══════════════════════════════════════════════════════════════
// SKILL REGISTRY
// Single source of truth — import this wherever skill names are needed
// Keeps Certificate.skill + CertificateQuestion.skill in sync always
// ═══════════════════════════════════════════════════════════════

export const CERTIFICATE_SKILLS = [
  'Video Editing',
  'Photo Shooting',
  'Sound Design',
  'VFX & Motion',
  'Thumbnail Art',
  'Script & Copy',
];

export const SKILL_META = {
  'Video Editing': {
    tagline: 'YouTube, Reels, ads, documentaries, cinematic cuts',
    badge:   '01 · Most In-Demand',
    icon:    '🎬',
  },
  'Photo Shooting': {
    tagline: 'Product photography, portraits, brand shoots, event coverage',
    badge:   '02 · Brand Ready',
    icon:    '📸',
  },
  'Sound Design': {
    tagline: 'Audio mixing, music production, voiceover, podcast editing, sound FX',
    badge:   '03 · Audio Craft',
    icon:    '🎧',
  },
  'VFX & Motion': {
    tagline: 'Visual effects, motion graphics, 3D animation, compositing, title sequences',
    badge:   '04 · Next-Level',
    icon:    '✨',
  },
  'Thumbnail Art': {
    tagline: 'High-CTR YouTube thumbnails, social graphics, visual branding',
    badge:   '05 · Click Magnet',
    icon:    '🖼️',
  },
  'Script & Copy': {
    tagline: 'Video scripts, content writing, captions, narrative structures for creators',
    badge:   '06 · Word Power',
    icon:    '✍️',
  },
};


// Add this after SKILL_META:
export const SKILL_SLUGS = {
  'video-editing':  'Video Editing',
  'photo-shooting': 'Photo Shooting',
  'sound-design':   'Sound Design',
  'vfx-motion':     'VFX & Motion',
  'thumbnail-art':  'Thumbnail Art',
  'script-copy':    'Script & Copy',
};
// ═══════════════════════════════════════════════════════════════
// SCHEMA
// ═══════════════════════════════════════════════════════════════

const certificateQuestionSchema = new mongoose.Schema({

  // ─────────────────────────────────────────────
  // SKILL
  // ─────────────────────────────────────────────

  skill: {
    type:     String,
    enum:     CERTIFICATE_SKILLS,
    required: true,
    index:    true,
  },

  // ─────────────────────────────────────────────
  // QUESTION
  // ─────────────────────────────────────────────

  question: {
    type:      String,
    required:  true,
    trim:      true,
    maxlength: 500,
  },

  // Sub-group for UI display (e.g. 'Tools & Setup', 'Workflow', 'Technique')
  category: {
    type:    String,
    trim:    true,
    default: 'General',
  },

  // ─────────────────────────────────────────────
  // TIER VISIBILITY
  // 'basic' → shown only to basic cert applicants
  // 'pro'   → shown only to pro cert applicants
  // 'both'  → shown to everyone
  // ─────────────────────────────────────────────

  tier: {
    type:    String,
    enum:    ['basic', 'pro', 'both'],
    default: 'both',
  },

  difficulty: {
    type:    String,
    enum:    ['beginner', 'intermediate', 'advanced'],
    default: 'intermediate',
  },

  // ─────────────────────────────────────────────
  // ANSWER RULES
  // ─────────────────────────────────────────────

  // Must be answered to submit the form
  required: {
    type:    Boolean,
    default: true,
  },

  // Hint text shown inside the textarea
  placeholder: {
    type:      String,
    default:   'Share your experience and approach...',
    maxlength: 300,
  },

  minLength: {
    type:    Number,
    default: 30,
  },

  maxLength: {
    type:    Number,
    default: 1000,
  },

  // ─────────────────────────────────────────────
  // ORDERING & VISIBILITY
  // ─────────────────────────────────────────────

  order: {
    type:    Number,
    default: 0,
  },

  isActive: {
    type:    Boolean,
    default: true,
    index:   true,
  },

}, { timestamps: true });

// ═══════════════════════════════════════════════════════════════
// INDEXES
// ═══════════════════════════════════════════════════════════════

certificateQuestionSchema.index({ skill: 1, isActive: 1, order: 1 });
certificateQuestionSchema.index({ skill: 1, tier: 1, isActive: 1 });

// ═══════════════════════════════════════════════════════════════
// STATICS
// ═══════════════════════════════════════════════════════════════

// ── Get ordered questions for a skill + cert tier ────────────
// Used by: GET /certificates/questions?skill=Video Editing&tier=pro
certificateQuestionSchema.statics.getBySkill = async function (skill, tier = 'both') {
  const tierFilter = tier === 'both'
    ? { $in: ['basic', 'pro', 'both'] }
    : { $in: [tier, 'both'] };

  return this.find({ skill, isActive: true, tier: tierFilter })
    .sort({ order: 1 })
    .lean();
};

// ── Summary for admin / skill-picker UI ─────────────────────
certificateQuestionSchema.statics.getSkillSummary = async function () {
  return this.aggregate([
    { $match: { isActive: true } },
    {
      $group: {
        _id:      '$skill',
        total:    { $sum: 1 },
        required: { $sum: { $cond: ['$required', 1, 0] } },
      },
    },
    { $sort: { _id: 1 } },
  ]);
};

// ── Validate answers submitted by user ───────────────────────
// Called inside submitForm() controller before creating the certificate
//
// Checks:
//   1. All required questions are answered
//   2. No rogue question IDs (wrong skill / tampered)
//   3. Each answer meets min/max length for its question
certificateQuestionSchema.statics.validateAnswers = async function (skill, tier, answers = []) {
  if (!answers.length) throw new Error('At least one answer is required');

  const questions = await this.find({ skill, isActive: true }).lean();
  if (!questions.length) throw new Error(`No active questions found for skill: ${skill}`);

  const allIds = questions.map(q => q._id.toString());

  const requiredIds = questions
    .filter(q => q.required && (q.tier === 'both' || q.tier === tier))
    .map(q => q._id.toString());

  const answeredIds = answers.map(a => a.questionId?.toString());

  // 1 — Every required question must have an answer
  const missing = requiredIds.filter(id => !answeredIds.includes(id));
  if (missing.length)
    throw new Error(`${missing.length} required question(s) left unanswered`);

  // 2 — No answer can reference a question from a different skill
  const rogue = answeredIds.filter(id => !allIds.includes(id));
  if (rogue.length)
    throw new Error(`${rogue.length} invalid question ID(s) detected`);

  // 3 — Length check per question
  for (const a of answers) {
    const q = questions.find(q => q._id.toString() === a.questionId?.toString());
    if (!q) continue;

    if (a.answer.trim().length < q.minLength)
      throw new Error(`Answer too short for: "${q.question.substring(0, 45)}..." (min ${q.minLength} chars)`);

    if (a.answer.trim().length > q.maxLength)
      throw new Error(`Answer too long for: "${q.question.substring(0, 45)}..." (max ${q.maxLength} chars)`);
  }

  return true;
};

// ═══════════════════════════════════════════════════════════════
// BACKUP HOOKS
// ═══════════════════════════════════════════════════════════════

// ✅ Fix
certificateQuestionSchema.pre('save', function () {
  this._wasNew = this.isNew;
});

certificateQuestionSchema.post('save', async function (doc) {
  try {
    await backupDocument('certificate_questions', doc._wasNew ? 'create' : 'update', doc);
  } catch (err) {
    console.error('⚠️ [BACKUP] post.save failed (certificate_questions):', err.message);
  }
});

certificateQuestionSchema.post('findOneAndDelete', async function (doc) {
  if (!doc) return;
  try {
    await backupDocument('certificate_questions', 'delete', doc);
  } catch (err) {
    console.error('⚠️ [BACKUP] post.findOneAndDelete failed (certificate_questions):', err.message);
  }
});

// ═══════════════════════════════════════════════════════════════
// EXPORT
// ═══════════════════════════════════════════════════════════════

const CertificateQuestion =
  mongoose.models.CertificateQuestion ||
  mongoose.model('CertificateQuestion', certificateQuestionSchema);

export default CertificateQuestion;