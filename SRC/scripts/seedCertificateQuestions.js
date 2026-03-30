// scripts/seedCertificateQuestions.js
// Run: node scripts/seedCertificateQuestions.js
// Idempotent — safe to run multiple times


import { fileURLToPath } from 'url';
import path from 'path';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);

// .env is at project root — go up 2 levels from SRC/scripts/
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

// ✅ Dynamic imports AFTER dotenv runs (fixes ESM hoisting issue)
const mongoose                          = (await import('mongoose')).default;
const { default: CertificateQuestion }  = await import('../Models/Certificate/CertificateQuestion.Model.js');
// ═══════════════════════════════════════════════════════════════
// QUESTION BANK
// 6 skills × 6 questions = 36 total
// Required count: 4 per skill (required: true)
// Optional count: 2 per skill (required: false)
// ═══════════════════════════════════════════════════════════════

const QUESTIONS = [

  // ─────────────────────────────────────────────────────────────
  // 01 — VIDEO EDITING
  // ─────────────────────────────────────────────────────────────
  {
    skill:      'Video Editing',
    category:   'Tools & Setup',
    order:       1,
    tier:        'both',
    difficulty:  'beginner',
    required:    true,
    question:    'What video editing software do you primarily use (e.g. Premiere Pro, DaVinci Resolve, Final Cut Pro)? Describe your typical project setup — folder structure, naming conventions, and proxy workflow if applicable.',
    placeholder: 'e.g. I use DaVinci Resolve 18. My folder structure separates Raw / Audio / Graphics / Exports. I create H.264 proxies for 4K footage to keep the timeline responsive...',
    minLength:   50,
    maxLength:   1000,
  },
  {
    skill:      'Video Editing',
    category:   'Pacing & Rhythm',
    order:       2,
    tier:        'both',
    difficulty:  'intermediate',
    required:    true,
    question:    'How do you approach pacing and cut timing? How does your editing style change between a high-energy 30-second Reel and a 10-minute long-form YouTube video?',
    placeholder: 'Describe how you decide when to cut, how you use beat-sync, how you sustain attention in long-form content without losing energy...',
    minLength:   60,
    maxLength:   1000,
  },
  {
    skill:      'Video Editing',
    category:   'Color Grading',
    order:       3,
    tier:        'both',
    difficulty:  'intermediate',
    required:    true,
    question:    'Describe your color grading process from start to finish — from flat or log footage to a polished, color-consistent final look. What tools, nodes, or LUTs do you use?',
    placeholder: 'e.g. I start with a technical grade to fix exposure and white balance, apply a cinematic LUT at 40% opacity, then adjust per scene for consistency. I use scopes to stay accurate...',
    minLength:   50,
    maxLength:   1000,
  },
  {
    skill:      'Video Editing',
    category:   'Audio in Edit',
    order:       4,
    tier:        'both',
    difficulty:  'intermediate',
    required:    true,
    question:    'How do you handle audio within your edits — dialogue cleanup, syncing, music selection, SFX layering, and final loudness levels for different platforms (YouTube, Reels, client delivery)?',
    placeholder: 'e.g. I sync audio using multi-cam, clean dialogue with noise reduction, target -14 LUFS for YouTube, -16 LUFS for Reels. I duck music under dialogue at -18dB...',
    minLength:   50,
    maxLength:   1000,
  },
  {
    skill:      'Video Editing',
    category:   'Best Work',
    order:       5,
    tier:        'both',
    difficulty:  'intermediate',
    required:    false,
    question:    'Describe a video project you\'re most proud of. What was the brief, your creative approach, the challenges you faced, and what the final result looked like?',
    placeholder: 'This is your chance to showcase your thinking — be specific about your creative decisions, not just the outcome...',
    minLength:   80,
    maxLength:   1200,
  },
  {
    skill:      'Video Editing',
    category:   'Advanced Technique',
    order:       6,
    tier:        'pro',
    difficulty:  'advanced',
    required:    false,
    question:    'What\'s your approach to creating seamless transitions, multi-cam edits, or cinematic interview cuts? How do you make stylistic choices — J-cuts, L-cuts, match cuts — that serve the story rather than distract from it?',
    placeholder: 'Talk about your philosophy on transitions, when you favour a clean cut vs a stylised move, how you maintain flow across a scene...',
    minLength:   60,
    maxLength:   1000,
  },

  // ─────────────────────────────────────────────────────────────
  // 02 — PHOTO SHOOTING
  // ─────────────────────────────────────────────────────────────
  {
    skill:      'Photo Shooting',
    category:   'Gear & Format',
    order:       1,
    tier:        'both',
    difficulty:  'beginner',
    required:    true,
    question:    'What camera body and lenses do you primarily work with? Do you shoot RAW or JPEG and why? Describe your typical gear bag for a standard shoot.',
    placeholder: 'e.g. Sony A7IV + 85mm f/1.8 for portraits, 35mm f/1.4 for environmental shots. Always RAW — gives full latitude in post for exposure and white balance corrections...',
    minLength:   40,
    maxLength:   800,
  },
  {
    skill:      'Photo Shooting',
    category:   'Lighting',
    order:       2,
    tier:        'both',
    difficulty:  'intermediate',
    required:    true,
    question:    'How do you approach lighting across different shoot types — a controlled product shoot in studio, a natural-light outdoor portrait, and a dark indoor event? What\'s your process when you arrive on location?',
    placeholder: 'Describe your lighting setups, modifiers you use, how you read and shape natural light, what you do when lighting conditions are outside your control...',
    minLength:   60,
    maxLength:   1000,
  },
  {
    skill:      'Photo Shooting',
    category:   'Post-Processing',
    order:       3,
    tier:        'both',
    difficulty:  'intermediate',
    required:    true,
    question:    'Walk us through your post-processing workflow — from import and culling to final export. What software do you use and how do you maintain color consistency across a batch of images?',
    placeholder: 'e.g. Import to Lightroom → cull in Photo Mechanic → apply base preset → individual exposure tweaks → batch export 300dpi for print, sRGB 72dpi for web...',
    minLength:   60,
    maxLength:   1000,
  },
  {
    skill:      'Photo Shooting',
    category:   'Direction & Composition',
    order:       4,
    tier:        'both',
    difficulty:  'intermediate',
    required:    true,
    question:    'How do you direct subjects to capture natural, authentic moments rather than stiff posed shots? What compositional principles guide your framing and when do you break the rules?',
    placeholder: 'Talk about your direction style, how you create a relaxed atmosphere, verbal/non-verbal cues, and how rule of thirds, leading lines, or negative space inform your framing choices...',
    minLength:   50,
    maxLength:   900,
  },
  {
    skill:      'Photo Shooting',
    category:   'Problem Solving',
    order:       5,
    tier:        'both',
    difficulty:  'advanced',
    required:    false,
    question:    'Describe a genuinely challenging shoot — bad weather, a difficult client, total lighting failure, or a chaotic event environment. How did you adapt and what was the outcome?',
    placeholder: 'Be specific — what went wrong, the decision you made in the moment, and whether you\'d handle it differently now...',
    minLength:   80,
    maxLength:   1200,
  },
  {
    skill:      'Photo Shooting',
    category:   'Brand & Product',
    order:       6,
    tier:        'pro',
    difficulty:  'advanced',
    required:    false,
    question:    'How do you approach a brand or product shoot when the client has a strong existing visual identity? How do you balance creative input with staying on-brand, and how do you present concepts for approval before shooting?',
    placeholder: 'Describe your pre-shoot process — mood boards, shot lists, test frames — and how you handle creative differences with clients...',
    minLength:   60,
    maxLength:   1000,
  },

  // ─────────────────────────────────────────────────────────────
  // 03 — SOUND DESIGN
  // ─────────────────────────────────────────────────────────────
  {
    skill:      'Sound Design',
    category:   'DAW & Setup',
    order:       1,
    tier:        'both',
    difficulty:  'beginner',
    required:    true,
    question:    'What DAW do you primarily use and why? Describe your session template setup — buss routing, track naming conventions, and your monitoring chain.',
    placeholder: 'e.g. Logic Pro X — my template has pre-routed busses for Dialogue, SFX, Music, and Ambience. I monitor on KRK Rokits and always cross-check on earbuds for consumer reference...',
    minLength:   50,
    maxLength:   900,
  },
  {
    skill:      'Sound Design',
    category:   'Levels & Loudness',
    order:       2,
    tier:        'both',
    difficulty:  'intermediate',
    required:    true,
    question:    'How do you approach loudness normalisation and final levels? What LUFS targets do you use for YouTube, Instagram Reels, podcasts, and broadcast delivery?',
    placeholder: 'e.g. -14 LUFS integrated for YouTube, -16 for streaming, -23 LUFS for broadcast. I use a true peak limiter at -1 dBTP. I check with a loudness meter plugin at the end of every session...',
    minLength:   50,
    maxLength:   900,
  },
  {
    skill:      'Sound Design',
    category:   'Dialogue & Voice Cleanup',
    order:       3,
    tier:        'both',
    difficulty:  'intermediate',
    required:    true,
    question:    'Describe your dialogue cleanup workflow — how do you handle background noise, inconsistent room tone, plosives, sibilance, and mismatched audio quality across a multi-scene project?',
    placeholder: 'Talk about your noise reduction tools (RX, ReaFIR, etc.), EQ and de-essing approach, how you match audio across different recording conditions...',
    minLength:   60,
    maxLength:   1000,
  },
  {
    skill:      'Sound Design',
    category:   'Music & Sync',
    order:       4,
    tier:        'both',
    difficulty:  'intermediate',
    required:    true,
    question:    'How do you select or create music that matches the emotional intent of a project? Describe how you handle music editing, sync points, and ducking so music never competes with dialogue.',
    placeholder: 'Describe your music sourcing process, how you edit tracks to fit timing, automation for ducking, and how you use music to build emotional pacing in a video...',
    minLength:   60,
    maxLength:   1000,
  },
  {
    skill:      'Sound Design',
    category:   'Sound FX & Foley',
    order:       5,
    tier:        'both',
    difficulty:  'advanced',
    required:    false,
    question:    'How do you design or source sound effects? Describe a time you had to build a unique sound from scratch — what elements did you layer, process, and blend to achieve the final result?',
    placeholder: 'Describe your SFX library organisation, pitch/time processing, layering technique, and any Foley work you\'ve recorded yourself...',
    minLength:   50,
    maxLength:   1000,
  },
  {
    skill:      'Sound Design',
    category:   'Podcast Production',
    order:       6,
    tier:        'both',
    difficulty:  'intermediate',
    required:    false,
    question:    'Walk us through your full podcast production workflow — from raw multi-track recording through editing, mixing, mastering, and final export. What\'s your quality checklist before an episode goes live?',
    placeholder: 'Include your approach to removing filler words and bad takes, music intro/outro handling, chapter markers, and the export format + bitrate you deliver to clients...',
    minLength:   60,
    maxLength:   1000,
  },

  // ─────────────────────────────────────────────────────────────
  // 04 — VFX & MOTION
  // ─────────────────────────────────────────────────────────────
  {
    skill:      'VFX & Motion',
    category:   'Software & Pipeline',
    order:       1,
    tier:        'both',
    difficulty:  'beginner',
    required:    true,
    question:    'What software do you use for VFX and motion graphics (e.g. After Effects, Nuke, Blender, Cinema 4D, DaVinci Fusion)? Describe your typical pipeline from asset creation to final composite.',
    placeholder: 'e.g. After Effects for motion graphics, Cinema 4D for 3D, Premiere for editing. Pipeline: concept → style frames → 3D render → AE composite → colour grade → deliver...',
    minLength:   50,
    maxLength:   900,
  },
  {
    skill:      'VFX & Motion',
    category:   'Compositing',
    order:       2,
    tier:        'both',
    difficulty:  'intermediate',
    required:    true,
    question:    'Describe a compositing shot you\'ve created. What was the setup, what VFX techniques did you use, and how did you achieve a seamless integration with the live footage?',
    placeholder: 'Be specific — rotoscoping, colour matching, motion blur, grain matching, edge treatment. The details are what separates a good composite from a great one...',
    minLength:   60,
    maxLength:   1000,
  },
  {
    skill:      'VFX & Motion',
    category:   'Green Screen & Keying',
    order:       3,
    tier:        'both',
    difficulty:  'intermediate',
    required:    true,
    question:    'How do you approach green screen keying to achieve a clean, realistic result? Walk us through handling hair, semi-transparent elements, and colour spill removal.',
    placeholder: 'Describe your keying tools, edge matte treatment, spill suppression, and how you colour-match the subject to integrate them convincingly into the background plate...',
    minLength:   60,
    maxLength:   1000,
  },
  {
    skill:      'VFX & Motion',
    category:   'Motion Graphics Design',
    order:       4,
    tier:        'both',
    difficulty:  'intermediate',
    required:    true,
    question:    'Walk us through your motion graphics design process — from receiving a brief to delivering final animations. How do you approach easing, timing, and making motion feel intentional rather than mechanical?',
    placeholder: 'Talk about style frames, easing curves, overshoot, anticipation, and how you make sure motion serves the message rather than distracting from it...',
    minLength:   60,
    maxLength:   1000,
  },
  {
    skill:      'VFX & Motion',
    category:   'Camera Tracking & 3D',
    order:       5,
    tier:        'pro',
    difficulty:  'advanced',
    required:    false,
    question:    'How do you handle camera tracking and match-moving to integrate 3D elements or text into live footage? How do you manage difficult scenarios — shaky cam, low texture, or fast movement?',
    placeholder: 'Describe your tracking workflow, how you set up and solve tracks, handle reference markers or manual point tracking, and refine integration with motion blur and shadows...',
    minLength:   60,
    maxLength:   1000,
  },
  {
    skill:      'VFX & Motion',
    category:   'Render & Delivery',
    order:       6,
    tier:        'both',
    difficulty:  'intermediate',
    required:    false,
    question:    'What render settings, codecs, and export formats do you use for different deliverables — social media, client review, broadcast, and final archive? How do you manage colour space across the pipeline?',
    placeholder: 'Discuss codec choices (ProRes, H.264, EXR sequences), frame rates, colour space (rec709 vs ACES), and how you stay organised across multiple render passes on a large project...',
    minLength:   50,
    maxLength:   900,
  },

  // ─────────────────────────────────────────────────────────────
  // 05 — THUMBNAIL ART
  // ─────────────────────────────────────────────────────────────
  {
    skill:      'Thumbnail Art',
    category:   'Tools & Workspace',
    order:       1,
    tier:        'both',
    difficulty:  'beginner',
    required:    true,
    question:    'What design tools do you use to create thumbnails (e.g. Photoshop, Figma, Canva, Illustrator)? Describe your workspace setup — canvas dimensions, resolution, colour profile, and any template system you\'ve built for efficiency.',
    placeholder: 'e.g. Photoshop at 1280×720px, 72dpi, sRGB. I have a master PSD with pre-built text layers and smart objects for fast subject swapping. Saves me 40% per thumbnail...',
    minLength:   40,
    maxLength:   800,
  },
  {
    skill:      'Thumbnail Art',
    category:   'Research & Strategy',
    order:       2,
    tier:        'both',
    difficulty:  'intermediate',
    required:    true,
    question:    'How do you research a niche before designing its thumbnail? How do you analyse competitor thumbnails, spot what\'s working, and intentionally differentiate your designs to stand out in the feed?',
    placeholder: 'Describe how you use YouTube Studio CTR data, TubeBuddy, spy on top-performing channels, identify colour and composition patterns that dominate a niche...',
    minLength:   50,
    maxLength:   900,
  },
  {
    skill:      'Thumbnail Art',
    category:   'Composition & Hierarchy',
    order:       3,
    tier:        'both',
    difficulty:  'intermediate',
    required:    true,
    question:    'How do you design visual hierarchy in a thumbnail so the viewer\'s eye moves in the right order — even when seen at 100px on a mobile screen? What compositional rules do you apply and when do you break them?',
    placeholder: 'Talk about focal point, rule of thirds, contrast, how you test readability at small sizes, and when breaking composition rules creates more impact...',
    minLength:   50,
    maxLength:   900,
  },
  {
    skill:      'Thumbnail Art',
    category:   'Typography & Colour',
    order:       4,
    tier:        'both',
    difficulty:  'intermediate',
    required:    true,
    question:    'How do you use typography, colour contrast, and emotion to make a thumbnail impossible to scroll past? What font treatments, colour combinations, and text effects do you rely on most?',
    placeholder: 'Discuss your font selection, stroke/outline techniques, colour psychology, contrast ratios, and how you use faces and expressions to trigger curiosity or emotion...',
    minLength:   50,
    maxLength:   900,
  },
  {
    skill:      'Thumbnail Art',
    category:   'Client Workflow',
    order:       5,
    tier:        'both',
    difficulty:  'beginner',
    required:    false,
    question:    'Walk us through your process from a creator\'s brief to delivering a final thumbnail — concepts, revision rounds, file handoff, and how you maintain visual consistency across a channel over time.',
    placeholder: 'Describe how you interpret a brief, how many concepts you present, how you handle revision requests, and what files you deliver (PSD, PNG, layered?)...',
    minLength:   50,
    maxLength:   900,
  },
  {
    skill:      'Thumbnail Art',
    category:   'Performance & Data',
    order:       6,
    tier:        'pro',
    difficulty:  'advanced',
    required:    false,
    question:    'How do you measure whether a thumbnail is performing after it goes live? What metrics do you track, and can you share an example where you redesigned a thumbnail based on data — and what changed in performance?',
    placeholder: 'Discuss CTR benchmarks (what\'s good in your niche), impression data, A/B testing, and a specific before/after example with real or approximate numbers...',
    minLength:   60,
    maxLength:   1000,
  },

  // ─────────────────────────────────────────────────────────────
  // 06 — SCRIPT & COPY
  // ─────────────────────────────────────────────────────────────
  {
    skill:      'Script & Copy',
    category:   'Process & Research',
    order:       1,
    tier:        'both',
    difficulty:  'beginner',
    required:    true,
    question:    'What\'s your end-to-end process for writing a video script — from topic research and outlining to final draft? What tools do you use to organise your research and writing?',
    placeholder: 'Describe how you pick and validate topics, build your outline, write the first draft, and how your process changes for client briefs vs self-initiated content...',
    minLength:   60,
    maxLength:   1000,
  },
  {
    skill:      'Script & Copy',
    category:   'Hook & Retention',
    order:       2,
    tier:        'both',
    difficulty:  'intermediate',
    required:    true,
    question:    'How do you write a hook that captures attention in the first 5–10 seconds and converts impressions into full watches? Walk us through a hook structure you use consistently.',
    placeholder: 'Describe your hook formulas — open loops, bold claims, curiosity gaps, pattern interrupts. Give a real or illustrative example of a hook that performed well and why it worked...',
    minLength:   60,
    maxLength:   1000,
  },
  {
    skill:      'Script & Copy',
    category:   'Platform Adaptation',
    order:       3,
    tier:        'both',
    difficulty:  'intermediate',
    required:    true,
    question:    'How do you adapt your writing tone, script structure, and content length for different platforms — YouTube long-form, Instagram Reels, TikTok, and LinkedIn? What fundamentally changes and what stays the same?',
    placeholder: 'Describe how vocabulary, pacing, script length, call-to-action placement, and audience expectations shift across platforms...',
    minLength:   60,
    maxLength:   1000,
  },
  {
    skill:      'Script & Copy',
    category:   'Captions & Social Copy',
    order:       4,
    tier:        'both',
    difficulty:  'intermediate',
    required:    true,
    question:    'How do you write captions that drive comments, saves, and shares — not just describe the video? What caption structures or formulas do you rely on, and how do you write for both the algorithm and the human reader?',
    placeholder: 'Describe your caption frameworks (open question, story hook, listicle, controversy), how you write the first line to stop the scroll, and how you close with a CTA that feels natural...',
    minLength:   50,
    maxLength:   900,
  },
  {
    skill:      'Script & Copy',
    category:   'Narrative Structure',
    order:       5,
    tier:        'pro',
    difficulty:  'advanced',
    required:    false,
    question:    'How do you approach narrative structure for longer-form creator content — documentaries, branded storytelling, explainers, or series? How do you keep an audience engaged across 15–30 minutes without losing them?',
    placeholder: 'Discuss three-act structure, open loops at chapter breaks, tension and release in informational content, and how you decide what to cut when the script is too long...',
    minLength:   60,
    maxLength:   1000,
  },
  {
    skill:      'Script & Copy',
    category:   'Best Work',
    order:       6,
    tier:        'both',
    difficulty:  'intermediate',
    required:    false,
    question:    'Describe a piece of content you wrote that significantly outperformed expectations — more views, shares, comments, or conversions. What specific writing decisions do you believe drove that result?',
    placeholder: 'Be specific — what was the content format, what metrics improved, and what you\'d do differently or repeat next time...',
    minLength:   80,
    maxLength:   1200,
  },

];

// ═══════════════════════════════════════════════════════════════
// SEED RUNNER
// ═══════════════════════════════════════════════════════════════

const seed = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URL);
    console.log('✅ MongoDB connected\n');

    let created = 0, skipped = 0, errors = 0;

    for (const q of QUESTIONS) {
      try {
        const exists = await CertificateQuestion.findOne({
          skill:    q.skill,
          question: q.question,
        });

        if (exists) {
          console.log(`⏭️  Skip  [${q.skill}] Q${q.order} — already exists`);
          skipped++;
        } else {
          await CertificateQuestion.create(q);
          console.log(`✅ Added [${q.skill}] Q${q.order} — ${q.question.substring(0, 55)}...`);
          created++;
        }
      } catch (err) {
        console.error(`❌ Error [${q.skill}] Q${q.order}:`, err.message);
        errors++;
      }
    }

    // ── Summary ───────────────────────────────────────────────
    console.log('\n' + '─'.repeat(60));
    console.log(`🎉 Seeding complete`);
    console.log(`   ✅ Created : ${created}`);
    console.log(`   ⏭️  Skipped : ${skipped}`);
    console.log(`   ❌ Errors  : ${errors}`);
    console.log(`   📦 Total   : ${QUESTIONS.length}`);
    console.log('─'.repeat(60));

    const summary = await CertificateQuestion.getSkillSummary();
    console.log('\n📋 Question Bank by Skill:');
    summary.forEach(s => {
      console.log(`   ${s._id.padEnd(18)} ${s.total} questions  (${s.required} required)`);
    });

    console.log('');
    process.exit(0);

  } catch (err) {
    console.error('❌ Seeder failed:', err.message);
    process.exit(1);
  }
};

seed();