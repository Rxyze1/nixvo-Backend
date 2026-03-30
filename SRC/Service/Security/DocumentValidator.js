// Service/Security/DocumentValidator.js

import AIValidationService from '../moderation/aiValidationService.js';
import crypto from 'crypto';
import { createRequire } from 'module';
import sharp from 'sharp';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';
import { uploadToR2 } from '../../Config/r2Config.js';
import TesseractManager from './TesseractManager.js';
import { fromBuffer } from 'pdf2pic';  // ✅ Replaced pdf-poppler (Linux compatible)

const require = createRequire(import.meta.url);

// ── Safe pdf-parse loader ─────────────────────────────────────────────────────
let pdfParse = null;
try {
  process.env.PDF_PARSE_NO_NATIVE = '1';
  const mod = require('pdf-parse');
  pdfParse  = typeof mod === 'function' ? mod : (mod?.default ?? null);
  if (pdfParse) console.log('✅ pdf-parse loaded');
} catch (e) {
  console.warn('⚠️  pdf-parse unavailable, OCR-only mode:', e.message);
}
// ─────────────────────────────────────────────────────────────────────────────

class DocumentValidator {

  constructor() {
    this.ai           = AIValidationService;
    this.cleanupTimer = null;

    this.config = {
      minTextLength:      10,
      enableCaching:      true,
      cacheExpiry:        24 * 60 * 60 * 1000,
      maxImagesPerPDF:    10,
      tempBaseDir:        path.join(os.tmpdir(), 'editcraft-validator'),
      cleanupInterval:    3600000,
      uploadOCRToR2:      process.env.UPLOAD_OCR_FILES     !== 'false',
      uploadProcessedPDF: process.env.UPLOAD_PROCESSED_PDF === 'true',
    };

    this.cache = new Map();

    this.contactPatterns = {
      email:               /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/gi,
      phone: [
        /\+\d{1,3}[-.\s]?\(?\d{1,4}\)?[-.\s]?\d{6,}/g,
        /\b\d{3}[-.\s]\d{3}[-.\s]\d{4}\b/g,
        /\b\d{10,12}\b/g,
        /\(\d{3}\)\s?\d{3}[-.\s]?\d{4}/g,
      ],
      directUrl:           /https?:\/\/[^\s<>"]+/gi,
      bareUrl:             /\b(?:www\.)[a-zA-Z0-9-]+\.[a-zA-Z]{2,}[^\s]*/gi,
      socialHandle:        /@[a-zA-Z0-9._]{3,}/g,
      contactInstructions: /\b(contact me|reach me|email me|call me|dm me|message me|find me on|hit me up|whatsapp me|telegram me|reach out to me)\b/gi,
    };

    this._startPeriodicCleanup();

    console.log('🧠 DocumentValidator ready');
    console.log(`   Upload OCR to R2     : ${this.config.uploadOCRToR2     ? 'YES' : 'NO'}`);
    console.log(`   Upload Processed PDF : ${this.config.uploadProcessedPDF ? 'YES' : 'NO'}\n`);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // R2 UPLOAD HELPER
  // ═══════════════════════════════════════════════════════════════════════════

  async _uploadFileToR2(filePath, destination, mimetype = 'image/png') {
    try {
      const buf = await fs.readFile(filePath);
      const url = await uploadToR2(buf, destination, mimetype);
      console.log(`      📤 R2: ${path.basename(filePath)} → ${url}`);
      return url;
    } catch (err) {
      console.warn(`      ⚠️  R2 upload skipped (${path.basename(filePath)}): ${err.message}`);
      return null;
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // OCR — delegates entirely to TesseractManager singleton
  // ═══════════════════════════════════════════════════════════════════════════

  async _runOCR(imageBuffer) {
    try {
      const processed = await sharp(imageBuffer)
        .greyscale()
        .normalize()
        .sharpen()
        .png()
        .toBuffer();

      const worker = await TesseractManager.getWorker();
      if (!worker) {
        console.warn('      ⚠️  No Tesseract worker available — skipping OCR');
        return '';
      }

      const dataUrl            = `data:image/png;base64,${processed.toString('base64')}`;
      const { data: { text } } = await worker.recognize(dataUrl);
      return text || '';

    } catch (err) {
      console.warn('      ⚠️  OCR error:', err.message);
      return '';
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // MAIN VALIDATE
  // ═══════════════════════════════════════════════════════════════════════════

  async validate(buffer, options = {}) {
    const startTime      = Date.now();
    const uploadedFiles  = [];
    const uniqueId       = `${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;
    const tempDir        = path.join(this.config.tempBaseDir, `job-${uniqueId}`);
    let   tempDirCreated = false;

    console.log('\n🧠 ══════════════════════════════════════════════════');
    console.log('🧠  DOCUMENT VALIDATOR');
    console.log('🧠 ══════════════════════════════════════════════════\n');
    console.log(`   File : ${options.filename || 'unknown'}`);
    console.log(`   Type : ${options.mimetype  || 'unknown'}`);
    console.log(`   Size : ${(buffer.length / 1024).toFixed(2)} KB\n`);

    try {
      let allExtractedText = '';
      let pdfText          = '';
      const imageTexts     = [];

      // ── Unsupported format ─────────────────────────────────────────
      if (
        options.mimetype === 'application/msword' ||
        options.mimetype === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
      ) {
        return this._blocked(
          ['unsupported_format'],
          'DOC/DOCX format is not supported. Please upload as PDF or image (JPG/PNG).',
          ['format-check'],
          startTime,
          uploadedFiles,
        );
      }

      // ── PDF pipeline ───────────────────────────────────────────────
      if (options.mimetype === 'application/pdf') {

        // STEP 1 — text layer
        console.log('📄 STEP 1: Extracting PDF text layer...\n');
        try {
          if (pdfParse) {
            const pdfData = await pdfParse(buffer);
            pdfText       = pdfData?.text || '';
            if (pdfText.length > 50) {
              const preview = pdfText.substring(0, 200).replace(/\n/g, ' ').trim();
              console.log(`   ✅ ${pdfText.length} chars extracted`);
              console.log(`   📝 "${preview}..."\n`);
            } else if (pdfText.length > 0) {
              console.log(`   ✅ ${pdfText.length} chars: "${pdfText}"\n`);
            } else {
              console.log('   ℹ️  No text layer — will rely on OCR\n');
            }
          } else {
            console.log('   ℹ️  pdf-parse unavailable — will rely on OCR\n');
          }
        } catch (err) {
          console.warn('   ⚠️  PDF text extraction failed:', err.message, '\n');
        }

        // STEP 2 — PDF → images → OCR
        console.log('📷 STEP 2: Converting PDF pages to images for OCR...\n');
        try {
          await fs.mkdir(tempDir, { recursive: true });
          tempDirCreated = true;

          const tempPdfPath = path.join(tempDir, 'input.pdf');
          await fs.writeFile(tempPdfPath, buffer);

          if (this.config.uploadProcessedPDF) {
            const url = await this._uploadFileToR2(
              tempPdfPath,
              `ocr-processing/${uniqueId}/original.pdf`,
              'application/pdf',
            );
            if (url) uploadedFiles.push({ type: 'original-pdf', url });
          }

          // ✅ pdf2pic — works on Windows, Mac, AND Linux
          const convert = fromBuffer(buffer, {
            density:      150,
            saveFilename: 'page',
            savePath:     tempDir,
            format:       'png',
            width:        2048,
            height:       2048,
          });
          await convert.bulk(-1, { responseType: 'image' }); // convert ALL pages

          const pageFiles = (await fs.readdir(tempDir))
            .filter(f => f.startsWith('page') && f.endsWith('.png'))
            .sort();

          console.log(`   ✅ ${pageFiles.length} page(s) converted\n`);

          if (pageFiles.length > 0) {
            console.log('🔍 Running OCR...\n');

            for (let i = 0; i < Math.min(pageFiles.length, this.config.maxImagesPerPDF); i++) {
              const imgPath = path.join(tempDir, pageFiles[i]);
              const pageNum = i + 1;
              console.log(`   📸 Page ${pageNum}: ${pageFiles[i]}`);

              try {
                const imgBuf = await fs.readFile(imgPath);

                if (this.config.uploadOCRToR2) {
                  const url = await this._uploadFileToR2(
                    imgPath,
                    `ocr-processing/${uniqueId}/page-${pageNum}.png`,
                    'image/png',
                  );
                  if (url) uploadedFiles.push({ type: 'ocr-page', page: pageNum, url });
                }

                const ocrText = await this._runOCR(imgBuf);

                if (ocrText && ocrText.length > 10) {
                  imageTexts.push(ocrText);
                  const preview = ocrText.substring(0, 80).replace(/\n/g, ' ').trim();
                  console.log(`      ✅ ${ocrText.length} chars — "${preview}..."`);
                } else {
                  console.log('      ⚠️  No text detected on this page');
                }

              } catch (pageErr) {
                console.warn(`      ⚠️  Page ${pageNum} OCR failed: ${pageErr.message}`);
              }

              console.log();
            }
          }

        } catch (convErr) {
          console.warn('   ⚠️  PDF→image conversion failed:', convErr.message);
          console.log('   ℹ️  Continuing with text-layer only\n');
        }

        allExtractedText = [pdfText, ...imageTexts].join('\n\n').trim();

        console.log('📊 EXTRACTION SUMMARY:');
        console.log(`   PDF text  : ${pdfText.length} chars`);
        console.log(`   OCR pages : ${imageTexts.length}`);
        console.log(`   OCR text  : ${imageTexts.join('').length} chars`);
        console.log(`   R2 uploads: ${uploadedFiles.length}`);
        console.log(`   TOTAL     : ${allExtractedText.length} chars\n`);
      }

      // ── No readable text ───────────────────────────────────────────
      if (!allExtractedText || allExtractedText.length < this.config.minTextLength) {
        console.log('⚠️  NO READABLE TEXT FOUND\n');
        return this._blocked(
          ['no_readable_text'],
          'No readable text could be extracted from your resume. Please ensure the file is not password-protected or corrupted.',
          ['text-extraction', 'ocr-scanner'],
          startTime,
          uploadedFiles,
          { extractedTextLength: allExtractedText?.length ?? 0 },
        );
      }

      console.log('✅ Text extracted successfully\n');

      // ── Cache check ────────────────────────────────────────────────
      const textHash = this._hashText(allExtractedText);
      if (this.config.enableCaching) {
        const cached = this._checkCache(textHash);
        if (cached) {
          console.log('💾 Cache hit — returning cached result\n');
          return { ...cached, cached: true, uploadedFiles, scanTime: Date.now() - startTime };
        }
      }

      // ── STEP 3: Quick regex pre-scan ───────────────────────────────
      console.log('🔍 STEP 3: Pattern pre-scan (building AI context)...\n');
      const quickScan = this._quickContactScan(allExtractedText);

      console.log(`   Emails       : ${quickScan.emails.length}`);
      console.log(`   Phones       : ${quickScan.phones.length}`);
      console.log(`   URLs         : ${quickScan.urls.length}`);
      console.log(`   Handles      : ${quickScan.handles.length}`);
      console.log(`   Instructions : ${quickScan.instructions.length}\n`);

      if (quickScan.emails.length)       console.log(`   📧 ${quickScan.emails.slice(0, 3).join(' | ')}`);
      if (quickScan.phones.length)       console.log(`   📱 ${quickScan.phones.slice(0, 3).join(' | ')}`);
      if (quickScan.urls.length)         console.log(`   🔗 ${quickScan.urls.slice(0, 3).join(' | ')}`);
      if (quickScan.handles.length)      console.log(`   📲 ${quickScan.handles.slice(0, 3).join(' | ')}`);
      if (quickScan.instructions.length) console.log(`   💬 ${quickScan.instructions.slice(0, 2).join(' | ')}`);
      console.log();

      // ── STEP 4: AI validation ──────────────────────────────────────
      console.log('🤖 STEP 4: AI content validation...\n');
      const aiResult = await this._smartAIValidation({ text: allExtractedText, hints: quickScan });

      console.log(`   Decision   : ${aiResult.decision}`);
      console.log(`   Confidence : ${aiResult.confidence}%`);
      console.log(`   Reasoning  : "${aiResult.reasoning}"`);
      if (aiResult.violations?.length) {
        console.log(`   Violations : ${aiResult.violations.join(', ')}`);
      }
      console.log();

      const blocked = aiResult.decision === 'BLOCK';

      const result = {
        action:     aiResult.decision,
        blocked,
        confidence: aiResult.confidence,
        violations: aiResult.violations || [],
        reason:     aiResult.reasoning,
        quickScan,
        aiResult,
        uploadedFiles,
        scanDetails: {
          pdfTextLength:   pdfText.length,
          pagesScanned:    imageTexts.length,
          totalTextLength: allExtractedText.length,
          r2FilesUploaded: uploadedFiles.length,
        },
        scanTime:  Date.now() - startTime,
        checkedBy: ['pdf-extractor', 'ocr-scanner', 'pattern-scan', 'ai-validation'],
      };

      this._saveToCache(textHash, result);

      console.log(blocked ? '🚫 FINAL: BLOCKED' : '✅ FINAL: ALLOWED');
      console.log(`⏱️  Total: ${result.scanTime}ms\n`);

      return result;

    } catch (err) {
      console.error('❌ Validation error:', err.message);
      return this._blocked(
        ['validation_error'],
        'Document validation failed due to an internal error. Please try again.',
        ['error-handler'],
        startTime,
        uploadedFiles,
        { error: err.message },
      );

    } finally {
      if (tempDirCreated) {
        try {
          await fs.rm(tempDir, { recursive: true, force: true });
          console.log(`🗑️  Cleaned: job-${uniqueId}\n`);
        } catch (cleanErr) {
          console.warn(`⚠️  Cleanup failed for job-${uniqueId}: ${cleanErr.message}`);
        }
      }
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // QUICK CONTACT PRE-SCAN
  // ═══════════════════════════════════════════════════════════════════════════

  _quickContactScan(text) {
    const scan = { emails: [], phones: [], urls: [], handles: [], instructions: [] };

    const emails = text.match(this.contactPatterns.email);
    if (emails) scan.emails = [...new Set(emails)];

    let phones = [];
    this.contactPatterns.phone.forEach(pattern => {
      const matches = text.match(pattern);
      if (matches) phones.push(...matches);
    });
    phones = phones.filter(p => {
      const digits = p.replace(/\D/g, '');
      return digits.length >= 10 && digits.length <= 15;
    });
    scan.phones = [...new Set(phones)];

    const urls = text.match(this.contactPatterns.directUrl);
    if (urls) scan.urls = [...new Set(urls)];

    const bareUrls = text.match(this.contactPatterns.bareUrl);
    if (bareUrls) scan.urls = [...new Set([...scan.urls, ...bareUrls])];

    const handles = text.match(this.contactPatterns.socialHandle);
    if (handles) scan.handles = [...new Set(handles)];

    const instructions = text.match(this.contactPatterns.contactInstructions);
    if (instructions) scan.instructions = [...new Set(instructions)];

    return scan;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // AI VALIDATION
  // ═══════════════════════════════════════════════════════════════════════════

  async _smartAIValidation({ text, hints }) {
    try {
      const prompt = `You are a strict content moderator for a freelance platform resume validator.

YOUR TASK: Decide if this resume should be BLOCKED or ALLOWED based on one rule only.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
THE ONE RULE:
BLOCK if the resume contains ANY attempt to share contact information or
redirect someone to contact the person outside of this platform.

ALLOW everything else — skills, experience, education, tools, achievements.
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

RESUME TEXT:
"""
${text.substring(0, 3000)}
"""

PRE-SCANNED PATTERNS FOUND:
  Emails       : ${hints.emails.length       ? hints.emails.join(', ')       : 'none'}
  Phone numbers: ${hints.phones.length       ? hints.phones.join(', ')       : 'none'}
  URLs / links : ${hints.urls.length         ? hints.urls.join(', ')         : 'none'}
  @Handles     : ${hints.handles.length      ? hints.handles.join(', ')      : 'none'}
  Contact hints: ${hints.instructions.length ? hints.instructions.join(', ') : 'none'}

━━━ BLOCK EXAMPLES ━━━
✗  john@gmail.com                       → email address
✗  +91 9876543210                       → phone number
✗  www.johnportfolio.com               → personal website
✗  "DM me / reach me at / contact me"  → off-platform contact instruction
✗  "Find me on Instagram: @john"       → redirecting to social media

━━━ ALLOW EXAMPLES ━━━
✓  "Expert in Instagram Reels editing" → skill mention
✓  "YouTube content creator"           → experience
✓  "Adobe Premiere Pro, After Effects" → tools
✓  "5 years experience in video editing"

KEY DISTINCTION:
  Platform as SKILL   = ALLOW  ("I edit YouTube videos")
  Platform as CONTACT = BLOCK  ("Find me on YouTube @channel")

Respond ONLY with this JSON:
{
  "decision": "ALLOW" or "BLOCK",
  "confidence": 0-100,
  "reasoning": "one clear sentence",
  "violations": []
}

violations values (only if BLOCK):
  "email_address" | "phone_number" | "personal_url" | "social_handle_contact" | "contact_instruction"`;

      const response = await this.ai.groq.chat.completions.create({
        messages:    [{ role: 'user', content: prompt }],
        model:       this.ai.model,
        temperature: 0.1,
        max_tokens:  300,
      });

      const raw       = response.choices[0]?.message?.content || '{}';
      const jsonMatch = raw.match(/\{[\s\S]*?\}/);

      if (jsonMatch) {
        let parsed;
        try   { parsed = JSON.parse(jsonMatch[0]); }
        catch { return this._aiParseError(); }

        const decision = ['ALLOW', 'BLOCK'].includes(parsed.decision?.toUpperCase?.())
          ? parsed.decision.toUpperCase()
          : 'BLOCK';

        const confidence = typeof parsed.confidence === 'number'
          ? Math.min(100, Math.max(0, Math.round(parsed.confidence)))
          : 50;

        const reasoning = typeof parsed.reasoning === 'string' && parsed.reasoning.trim()
          ? parsed.reasoning.trim()
          : 'Unable to determine';

        const validViolationTypes = [
          'email_address', 'phone_number', 'personal_url',
          'social_handle_contact', 'contact_instruction',
        ];
        const violations = Array.isArray(parsed.violations)
          ? parsed.violations.filter(v => validViolationTypes.includes(v))
          : [];

        return { decision, confidence, reasoning, violations };
      }

      return this._aiParseError();

    } catch (err) {
      console.error('❌ AI validation error:', err.message);
      return {
        decision:   'BLOCK',
        confidence: 50,
        reasoning:  'AI validation temporarily unavailable.',
        violations: ['ai_error'],
      };
    }
  }

  _aiParseError() {
    return {
      decision:   'BLOCK',
      confidence: 50,
      reasoning:  'Could not parse AI response — defaulting to block for safety.',
      violations: ['ai_parse_error'],
    };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // BLOCKED RESPONSE BUILDER
  // ═══════════════════════════════════════════════════════════════════════════

  _blocked(violations, reason, checkedBy, startTime, uploadedFiles, extra = {}) {
    return {
      action:       'BLOCK',
      blocked:      true,
      confidence:   90,
      violations,
      reason,
      uploadedFiles,
      scanTime:     Date.now() - startTime,
      checkedBy,
      ...extra,
    };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // CACHE
  // ═══════════════════════════════════════════════════════════════════════════

  _hashText(text) {
    return crypto
      .createHash('md5')
      .update(text.toLowerCase().replace(/\s+/g, ' ').trim())
      .digest('hex');
  }

  _checkCache(hash) {
    const entry = this.cache.get(hash);
    if (!entry) return null;
    if (Date.now() - entry.timestamp > this.config.cacheExpiry) {
      this.cache.delete(hash);
      return null;
    }
    return entry.result;
  }

  _saveToCache(hash, result) {
    if (this.cache.size >= 1000) {
      this.cache.delete(this.cache.keys().next().value);
    }
    this.cache.set(hash, {
      result: {
        action:     result.action,
        blocked:    result.blocked,
        confidence: result.confidence,
        reason:     result.reason,
        violations: result.violations,
      },
      timestamp: Date.now(),
    });
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // PERIODIC CLEANUP
  // ═══════════════════════════════════════════════════════════════════════════

  _startPeriodicCleanup() {
    this.cleanupTimer = setInterval(async () => {
      try {
        const base   = this.config.tempBaseDir;
        const exists = await fs.access(base).then(() => true).catch(() => false);
        if (!exists) return;

        const entries = await fs.readdir(base);
        const now     = Date.now();

        for (const entry of entries) {
          if (entry === 'tesseract-cache') continue;

          const fullPath = path.join(base, entry);
          const stats    = await fs.stat(fullPath).catch(() => null);
          if (!stats) continue;

          if (now - stats.mtimeMs > this.config.cleanupInterval) {
            await fs.rm(fullPath, { recursive: true, force: true });
            console.log(`🗑️  Auto-cleaned stale temp: ${entry}`);
          }
        }
      } catch {
        // best-effort, silent
      }
    }, this.config.cleanupInterval);

    if (this.cleanupTimer.unref) this.cleanupTimer.unref();
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // SHUTDOWN
  // ═══════════════════════════════════════════════════════════════════════════

  async shutdown() {
    console.log('[DocumentValidator] Shutting down...');

    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }

    await TesseractManager.shutdown();

    try {
      const exists = await fs.access(this.config.tempBaseDir).then(() => true).catch(() => false);
      if (exists) {
        await fs.rm(this.config.tempBaseDir, { recursive: true, force: true });
        console.log('✅ Temp directories cleaned');
      }
    } catch (err) {
      console.warn('⚠️  Temp cleanup error:', err.message);
    }

    this.cache.clear();
    console.log('[DocumentValidator] Shutdown complete');
  }
}

export default DocumentValidator;