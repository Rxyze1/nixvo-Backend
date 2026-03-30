// Service/Security/VideoValidator.js

import Tesseract from 'tesseract.js';
import Groq from 'groq-sdk';
import ffmpeg from 'fluent-ffmpeg';
import ffmpegStatic from 'ffmpeg-static';
import ffprobeStatic from 'ffprobe-static';
import { unlinkSync, existsSync, readFileSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import crypto from 'crypto';

// ✅ Import validation services
import validationService from '../validationService.js';
import AudioScanner from '../../scanners/AudioScanner.js';

// ✅ Import queue system
import PQueue from 'p-queue';

// Set ffmpeg paths
ffmpeg.setFfmpegPath(ffmpegStatic);
ffmpeg.setFfprobePath(ffprobeStatic.path);

// ✅ Use Groq instead of OpenAI
const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY
});

class VideoValidator {
  
  constructor() {
    // Limits
    this.maxVideoDuration = 300; // 5 minutes
    this.maxFileSize = 26 * 1024 * 1024; // 26MB
    this.framesToExtract = 3;
    
    // ✅ Queue system
    this.validationQueue = new PQueue({
      concurrency: parseInt(process.env.VIDEO_QUEUE_CONCURRENCY || '5'),
      timeout: 60000,
      throwOnTimeout: true
    });
    
    this.frameQueue = new PQueue({
      concurrency: 10,
      timeout: 10000
    });
    
    // ✅ Initialize audio scanner
    try {
      this.audioScanner = new AudioScanner(validationService);
      
      if (typeof this.audioScanner.scan !== 'function') {
        throw new Error('AudioScanner.scan() method not found');
      }
      
      console.log('✅ AudioScanner initialized successfully');
      
    } catch (error) {
      console.error('❌ CRITICAL: AudioScanner initialization failed!');
      console.error('   Error:', error.message);
      console.error('   Stack:', error.stack);
      this.audioScanner = null;
    }
    
    // Statistics
    this.stats = {
      totalProcessed: 0,
      totalBlocked: 0,
      totalAllowed: 0,
      avgProcessingTime: 0,
      queueSize: 0,
      peakQueueSize: 0
    };
    
    console.log('\n🎥 ═══════════════════════════════════════════════════════');
    console.log('🎥 VideoValidator initialized');
    console.log('🎥 ═══════════════════════════════════════════════════════');
    console.log(`   Vision AI: Groq Llama Vision (disabled)`);
    console.log(`   OCR: Tesseract.js (enabled)`);
    console.log(`   Audio Scanner: ${this.audioScanner ? '✅ READY' : '❌ NOT AVAILABLE'}`);
    console.log(`   Max concurrent validations: ${this.validationQueue.concurrency}`);
    console.log('🎥 ═══════════════════════════════════════════════════════\n');
  }
  
  // ═══════════════════════════════════════════════════════════════
  // PUBLIC API - VALIDATE VIDEO
  // ═══════════════════════════════════════════════════════════════
  
  async validate(videoBuffer, options = {}) {
    return this.validationQueue.add(async () => {
      this._updateQueueStats();
      return await this._validateVideo(videoBuffer, options);
    });
  }
  
  // ═══════════════════════════════════════════════════════════════
  // PRIVATE - MAIN VALIDATION LOGIC
  // ═══════════════════════════════════════════════════════════════
  
  async _validateVideo(videoBuffer, options = {}) {
    const startTime = Date.now();
    const { filename = 'video.mp4', userId = null } = options;
    
    console.log(`\n🎥 ═══════════════════════════════════════════════════════`);
    console.log(`🎥  VIDEO VALIDATION STARTED`);
    console.log(`🎥  File: ${filename}`);
    console.log(`🎥  Size: ${(videoBuffer.length / 1024 / 1024).toFixed(2)} MB`);
    console.log(`🎥 ═══════════════════════════════════════════════════════`);
    
    let tempVideoPath = null;
    let frames = [];
    
    try {
      
      // ═══════════════════════════════════════════════════════
      // STEP 1: INSTANT CHECKS
      // ═══════════════════════════════════════════════════════
      
      console.log('   📋 Step 1: Running instant checks...');
      
      const instantCheck = this._instantChecks(videoBuffer);
      if (instantCheck.blocked) {
        console.log('   ❌ Failed instant checks');
        return this._finalizeResult(instantCheck, startTime);
      }
      
      console.log('   ✅ Instant checks passed');
      
      // ═══════════════════════════════════════════════════════
      // STEP 2: SAVE TEMP FILE
      // ═══════════════════════════════════════════════════════
      
      console.log('   💾 Step 2: Saving temp file...');
      tempVideoPath = this.saveTempFile(videoBuffer, filename);
      
      if (!existsSync(tempVideoPath)) {
        throw new Error('Temp file verification failed');
      }
      
      console.log('   ✅ Temp file saved');
      
      // ═══════════════════════════════════════════════════════
      // STEP 3: EXTRACT METADATA
      // ═══════════════════════════════════════════════════════
      
      console.log('   📊 Step 3: Extracting metadata...');
      const metadata = await this.getVideoMetadata(tempVideoPath);
      
      console.log(`   ✅ Duration: ${metadata.duration}s, ${metadata.width}x${metadata.height}`);
      
      // Duration check
      if (metadata.duration > this.maxVideoDuration) {
        this.cleanupTempFile(tempVideoPath);
        return this._finalizeResult(
          this.blockResult(
            `Video too long (${metadata.duration}s). Max: ${this.maxVideoDuration}s`,
            100,
            ['duration_exceeded'],
            0,
            ['metadata-check']
          ),
          startTime
        );
      }
      
      // ═══════════════════════════════════════════════════════
      // STEP 4: EXTRACT FRAMES
      // ═══════════════════════════════════════════════════════
      
      console.log(`   🖼️  Step 4: Extracting ${this.framesToExtract} frames...`);
      frames = await this.extractFrames(tempVideoPath, metadata.duration);
      
      if (frames.length === 0) {
        console.log('   ⚠️  No frames extracted');
      } else {
        console.log(`   ✅ Extracted ${frames.length} frames`);
      }
      
      // ═══════════════════════════════════════════════════════
      // STEP 5: PARALLEL VALIDATION
      // ═══════════════════════════════════════════════════════
      
      console.log('   🔍 Step 5: Running parallel validation...');
      
      const validationPromises = [];
      
      // ✅ Vision AI (DISABLED)
      validationPromises.push(Promise.resolve({
        blocked: false,
        confidence: 0,
        violations: [],
        reason: 'Vision AI disabled',
        source: 'groq_vision_disabled'
      }));
      
      // ✅ OCR
      if (frames.length > 0) {
        console.log('   📝 Queuing OCR...');
        validationPromises.push(this.extractTextFromFrames(frames));
      } else {
        validationPromises.push(Promise.resolve({
          blocked: false,
          extractedText: '',
          violations: [],
          reason: 'No frames for OCR',
          source: 'ocr_skipped'
        }));
      }
      
      // ✅ Audio validation (CRITICAL)
      if (this.audioScanner) {
        console.log('   🎤 Queuing Audio Validation...');
        validationPromises.push(this._validateAudio(tempVideoPath, metadata));
      } else {
        console.error('   ❌ CRITICAL: AudioScanner NOT AVAILABLE!');
        validationPromises.push(Promise.resolve({
          sttResult: { transcript: null, confidence: 0 },
          regexResult: { confidence: 0, violations: [] },
          aiResult: { blocked: false, confidence: 0 },
          checkedBy: ['audio-scanner-missing'],
          error: 'AudioScanner not initialized'
        }));
      }
      
      // Wait for all validations
      console.log('   ⏳ Waiting for validation results...\n');
      const results = await Promise.all(validationPromises);
      const [aiResult, ocrResult, audioResult] = results;
      
      // ═══════════════════════════════════════════════════════
      // STEP 6: LOG DETAILED RESULTS
      // ═══════════════════════════════════════════════════════
      
      console.log('   📊 ═══════════════════════════════════════');
      console.log('   📊 VALIDATION RESULTS');
      console.log('   📊 ═══════════════════════════════════════\n');
      
      // Vision AI Result (disabled)
      console.log(`   ⚪ Vision AI: DISABLED`);
      console.log();
      
      // OCR Result
      console.log(`   ${ocrResult.blocked ? '❌' : '✅'} OCR: ${ocrResult.blocked ? 'BLOCKED' : 'PASSED'}`);
      if (ocrResult.extractedText) {
        const preview = ocrResult.extractedText.substring(0, 60);
        console.log(`      Text: "${preview}${ocrResult.extractedText.length > 60 ? '...' : ''}"`);
      }
      console.log();
      
      // Audio Result
      console.log('   🎤 Audio Validation:');
      
      if (!audioResult) {
        console.error('   ❌ audioResult is NULL!');
      } else {
        console.log(`      CheckedBy: ${audioResult.checkedBy?.join(', ') || 'unknown'}`);
        
        // STT
        if (audioResult.sttResult && audioResult.sttResult.transcript) {
          console.log(`      📝 Transcript: "${audioResult.sttResult.transcript.substring(0, 80)}"`);
          console.log(`      📊 STT Confidence: ${audioResult.sttResult.confidence}%`);
        } else {
          console.log(`      📝 Transcript: (none)`);
        }
        
        // Regex
        if (audioResult.regexResult && audioResult.regexResult.violations.length > 0) {
          const types = audioResult.regexResult.violations.map(v => v.type || v).join(', ');
          console.log(`      ⚠️  Regex Violations: ${types}`);
          console.log(`      📊 Regex Confidence: ${audioResult.regexResult.confidence}%`);
        } else {
          console.log(`      ✅ No regex violations`);
        }
        
        // AI
        if (audioResult.aiResult) {
          console.log(`      🤖 AI Blocked: ${audioResult.aiResult.blocked ? 'YES' : 'NO'}`);
          if (audioResult.aiResult.decision) {
            console.log(`      🤖 AI Decision: ${audioResult.aiResult.decision}`);
          }
        }
        
        // Overall
        const audioBlocked = audioResult.aiResult?.blocked || 
                             (audioResult.regexResult?.confidence >= 95);
        
        console.log();
        console.log(`   ${audioBlocked ? '❌' : '✅'} Audio Overall: ${audioBlocked ? 'BLOCKED' : 'PASSED'}`);
      }
      
      console.log();
      
      // ═══════════════════════════════════════════════════════
      // STEP 7: AGGREGATE & CLEANUP
      // ═══════════════════════════════════════════════════════
      
      this.cleanupFrames(frames);
      this.cleanupTempFile(tempVideoPath);
      
      const finalResult = this.aggregateResults(aiResult, ocrResult, metadata, audioResult);
      
      return this._finalizeResult(finalResult, startTime);
      
    } catch (error) {
      console.error('\n   ❌ VALIDATION ERROR');
      console.error('   Message:', error.message);
      console.error('   Stack:', error.stack);
      
      // Cleanup
      if (frames.length > 0) this.cleanupFrames(frames);
      if (tempVideoPath) this.cleanupTempFile(tempVideoPath);
      
      return this._finalizeResult(
        {
          blocked: false,
          action: 'ALLOW',
          confidence: 0,
          violations: [],
          reason: `Validation error: ${error.message}`,
          checkedBy: ['error-handler'],
          error: error.message,
          metadata: { duration: 0, resolution: '0x0', format: 'unknown', codec: 'unknown' },
          audioResult: {
            transcript: null,
            confidence: 0,
            regexViolations: [],
            aiBlocked: false,
            checkedBy: []
          }
        },
        startTime
      );
    }
  }
  
  // ═══════════════════════════════════════════════════════════════
  // INSTANT CHECKS
  // ═══════════════════════════════════════════════════════════════
  
  _instantChecks(videoBuffer) {
    if (!Buffer.isBuffer(videoBuffer) || videoBuffer.length === 0) {
      return this.blockResult('Invalid video buffer', 100, ['invalid_buffer'], 0, ['buffer-check']);
    }
    
    if (videoBuffer.length > this.maxFileSize) {
      const sizeMB = (videoBuffer.length / 1024 / 1024).toFixed(2);
      return this.blockResult(
        `Video too large (${sizeMB}MB). Max: 26MB`,
        100,
        ['file_size'],
        0,
        ['size-check']
      );
    }
    
    const signature = videoBuffer.slice(0, 12).toString('hex');
    if (!this.isValidVideoSignature(signature)) {
      return this.blockResult('Invalid video format', 100, ['invalid_format'], 0, ['signature-check']);
    }
    
    return { blocked: false };
  }
  
  // ═══════════════════════════════════════════════════════════════
  // AUDIO VALIDATION
  // ═══════════════════════════════════════════════════════════════
  
  async _validateAudio(videoPath, metadata) {
    const emptyResult = {
      sttResult: { transcript: null, confidence: 0 },
      regexResult: { confidence: 0, violations: [] },
      aiResult: { blocked: false, confidence: 0 },
      checkedBy: []
    };
    
    try {
      console.log('      🎤 Extracting audio from video...');
      const audioBuffer = await this.extractAudioFromVideo(videoPath);
      
      if (!audioBuffer || audioBuffer.length < 1024) {
        console.log('      ⚠️  Audio too small or silent (< 1KB)');
        return {
          ...emptyResult,
          checkedBy: ['audio-silent']
        };
      }
      
      console.log(`      ✅ Audio extracted: ${(audioBuffer.length / 1024).toFixed(2)}KB`);
      console.log('      🔍 Scanning audio...');
      
      const scanResult = await this.audioScanner.scan(audioBuffer, {
        duration: metadata.duration,
        language: 'en'
      });
      
      console.log('      ✅ Audio scan complete');
      
      if (!scanResult) {
        console.error('      ❌ Audio scan returned NULL!');
        return {
          ...emptyResult,
          checkedBy: ['audio-scan-null'],
          error: 'AudioScanner.scan() returned null'
        };
      }
      
      // ✅ Ensure proper structure
      return {
        sttResult: scanResult.sttResult || { transcript: null, confidence: 0 },
        regexResult: scanResult.regexResult || { confidence: 0, violations: [] },
        aiResult: scanResult.aiResult || { blocked: false, confidence: 0 },
        checkedBy: scanResult.checkedBy || ['audio-unknown'],
        error: scanResult.error || null
      };
      
    } catch (error) {
      console.error('      ❌ Audio validation FAILED:', error.message);
      
      return {
        ...emptyResult,
        checkedBy: ['audio-error'],
        error: error.message
      };
    }
  }
  
  // ═══════════════════════════════════════════════════════════════
  // EXTRACT AUDIO FROM VIDEO
  // ═══════════════════════════════════════════════════════════════
  
  async extractAudioFromVideo(videoPath) {
    const audioPath = join(tmpdir(), `audio-${crypto.randomBytes(8).toString('hex')}.mp3`);
    
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Audio extraction timeout (15s)'));
      }, 15000);
      
      ffmpeg(videoPath)
        .output(audioPath)
        .audioCodec('libmp3lame')
        .audioBitrate('128k')
        .noVideo()
        .on('end', () => {
          clearTimeout(timeout);
          
          if (!existsSync(audioPath)) {
            return reject(new Error('Audio file not created'));
          }
          
          try {
            const audioBuffer = readFileSync(audioPath);
            unlinkSync(audioPath);
            resolve(audioBuffer);
          } catch (error) {
            reject(error);
          }
        })
        .on('error', (err) => {
          clearTimeout(timeout);
          if (existsSync(audioPath)) {
            try { unlinkSync(audioPath); } catch (e) {}
          }
          reject(err);
        })
        .run();
    });
  }
  
  // ═══════════════════════════════════════════════════════════════
  // FILE SIGNATURE CHECK
  // ═══════════════════════════════════════════════════════════════
  
  isValidVideoSignature(signature) {
    const hex = signature.toLowerCase();
    
    const validSignatures = [
      '000000', '667479', '6d6f6f', '6d646174',
      '1a45dfa3', '52494646', '000001ba', '000001b3', '464c5601'
    ];
    
    return validSignatures.some(sig => hex.includes(sig));
  }
  
  // ═══════════════════════════════════════════════════════════════
  // SAVE TEMP FILE
  // ═══════════════════════════════════════════════════════════════
  
  saveTempFile(buffer, filename) {
    const ext = filename.split('.').pop() || 'mp4';
    const tempFilename = `video-${crypto.randomBytes(8).toString('hex')}.${ext}`;
    const tempPath = join(tmpdir(), tempFilename);
    
    try {
      writeFileSync(tempPath, buffer);
      
      if (!existsSync(tempPath)) {
        throw new Error('File verification failed');
      }
      
      return tempPath;
    } catch (error) {
      throw new Error(`Failed to save temp file: ${error.message}`);
    }
  }
  
  // ═══════════════════════════════════════════════════════════════
  // GET VIDEO METADATA
  // ═══════════════════════════════════════════════════════════════
  
  getVideoMetadata(videoPath) {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Metadata extraction timeout (10s)'));
      }, 10000);
      
      ffmpeg.ffprobe(videoPath, (err, metadata) => {
        clearTimeout(timeout);
        
        if (err) {
          return reject(new Error(`ffprobe error: ${err.message}`));
        }
        
        const videoStream = metadata.streams?.find(s => s.codec_type === 'video');
        
        if (!videoStream) {
          return reject(new Error('No video stream found'));
        }
        
        resolve({
          duration: Math.floor(parseFloat(metadata.format.duration) || 0),
          width: videoStream.width || 0,
          height: videoStream.height || 0,
          format: metadata.format.format_name || 'unknown',
          bitrate: parseInt(metadata.format.bit_rate) || 0,
          codec: videoStream.codec_name || 'unknown'
        });
      });
    });
  }
  
  // ═══════════════════════════════════════════════════════════════
  // EXTRACT FRAMES
  // ═══════════════════════════════════════════════════════════════
  
  async extractFrames(videoPath, duration) {
    const frameCount = Math.min(this.framesToExtract, Math.floor(duration));
    
    if (frameCount === 0 || duration < 1) {
      return [];
    }
    
    const interval = duration / (frameCount + 1);
    const extractPromises = [];
    
    for (let i = 1; i <= frameCount; i++) {
      const timestamp = interval * i;
      extractPromises.push(
        this.frameQueue.add(() => this._extractSingleFrame(videoPath, timestamp, i))
      );
    }
    
    try {
      const frames = await Promise.all(extractPromises);
      return frames.filter(f => f !== null);
    } catch (error) {
      console.error('      ⚠️  Frame extraction failed:', error.message);
      return [];
    }
  }
  
  _extractSingleFrame(videoPath, timestamp, frameNumber) {
    return new Promise((resolve) => {
      const framePath = join(tmpdir(), `frame-${crypto.randomBytes(8).toString('hex')}.jpg`);
      
      const timeout = setTimeout(() => resolve(null), 8000);
      
      ffmpeg(videoPath)
        .seekInput(timestamp)
        .frames(1)
        .output(framePath)
        .outputOptions(['-q:v 5', '-vf scale=640:-1'])
        .on('end', () => {
          clearTimeout(timeout);
          resolve(framePath);
        })
        .on('error', () => {
          clearTimeout(timeout);
          resolve(null);
        })
        .run();
    });
  }
  
  // ═══════════════════════════════════════════════════════════════
  // EXTRACT TEXT FROM FRAMES (OCR)
  // ═══════════════════════════════════════════════════════════════
  
  async extractTextFromFrames(framePaths) {
    if (framePaths.length === 0) {
      return {
        blocked: false,
        extractedText: '',
        violations: [],
        reason: 'No frames for OCR',
        source: 'ocr_skipped'
      };
    }
    
    try {
      const framesToOCR = framePaths.slice(0, 2);
      
      const ocrPromises = framesToOCR.map(async (framePath) => {
        try {
          const result = await Tesseract.recognize(framePath, 'eng', {
            logger: () => {}
          });
          return result.data.text;
        } catch {
          return '';
        }
      });
      
      const texts = await Promise.all(ocrPromises);
      const extractedText = texts.join(' ').trim();
      
      if (!extractedText || extractedText.length < 5) {
        return {
          blocked: false,
          extractedText: '',
          violations: [],
          reason: 'No text detected',
          source: 'ocr'
        };
      }
      
      const textValidation = await validationService.validateContent(extractedText, 'video_text');
      
      return {
        blocked: textValidation.action === 'BLOCK' || textValidation.blocked,
        confidence: textValidation.confidence || 0,
        violations: textValidation.violations || [],
        reason: textValidation.reason || 'No violations',
        extractedText,
        source: 'ocr'
      };
      
    } catch (error) {
      return {
        blocked: false,
        extractedText: '',
        violations: [],
        reason: 'OCR failed',
        source: 'ocr_error'
      };
    }
  }
  
  // ═══════════════════════════════════════════════════════════════
  // AGGREGATE RESULTS
  // ═══════════════════════════════════════════════════════════════
  
  aggregateResults(aiResult, ocrResult, metadata, audioResult = null) {
    const allViolations = [...ocrResult.violations];
    
    let audioBlocked = false;
    
    // ✅ Extract audio violations
    if (audioResult) {
      if (audioResult.regexResult && audioResult.regexResult.violations) {
        const audioViolations = audioResult.regexResult.violations.map(v => v.type || v);
        allViolations.push(...audioViolations);
      }
      
      if (audioResult.aiResult && audioResult.aiResult.violations) {
        allViolations.push(...audioResult.aiResult.violations);
      }
      
      audioBlocked = (audioResult.aiResult && audioResult.aiResult.blocked) || 
                     (audioResult.regexResult && audioResult.regexResult.confidence >= 95);
    }
    
    const maxConfidence = Math.max(
      ocrResult.confidence || 0,
      audioResult?.regexResult?.confidence || 0,
      audioResult?.aiResult?.confidence || 0
    );
    
    const isBlocked = ocrResult.blocked || audioBlocked;
    
    const reasons = [];
    if (ocrResult.blocked) reasons.push(`Text: ${ocrResult.reason}`);
    if (audioBlocked) {
      if (audioResult.aiResult && audioResult.aiResult.blocked) {
        reasons.push(`Audio: ${audioResult.aiResult.decision || 'Policy violation'}`);
      } else if (audioResult.regexResult && audioResult.regexResult.violations && audioResult.regexResult.violations.length > 0) {
        const types = audioResult.regexResult.violations.map(v => v.type || v).join(', ');
        reasons.push(`Audio: ${types}`);
      }
    }
    
    // ✅ Format audio result properly
    const audioResultFormatted = audioResult ? {
      transcript: audioResult.sttResult?.transcript || null,
      confidence: audioResult.sttResult?.confidence || 0,
      regexViolations: audioResult.regexResult?.violations || [],
      aiBlocked: audioResult.aiResult?.blocked || false,
      checkedBy: audioResult.checkedBy || []
    } : {
      transcript: null,
      confidence: 0,
      regexViolations: [],
      aiBlocked: false,
      checkedBy: []
    };
    
    return {
      blocked: isBlocked,
      action: isBlocked ? 'BLOCK' : maxConfidence >= 50 ? 'WARN' : 'ALLOW',
      confidence: maxConfidence,
      violations: [...new Set(allViolations)],
      reason: reasons.length > 0 ? reasons.join('. ') : 'Video passed all checks',
      checkedBy: [
        ocrResult.source,
        ...(audioResult?.checkedBy || [])
      ].filter(s => s && !s.includes('error') && !s.includes('skipped') && !s.includes('missing')),
      metadata: {
        duration: metadata.duration,
        resolution: `${metadata.width}x${metadata.height}`,
        format: metadata.format,
        codec: metadata.codec
      },
      ocrResult: {
        text: ocrResult.extractedText || null
      },
      audioResult: audioResultFormatted
    };
  }
  
  // ═══════════════════════════════════════════════════════════════
  // FINALIZE RESULT
  // ═══════════════════════════════════════════════════════════════
  
  _finalizeResult(result, startTime) {
    result.scanTime = Date.now() - startTime;
    
    this.stats.totalProcessed++;
    if (result.blocked) {
      this.stats.totalBlocked++;
    } else {
      this.stats.totalAllowed++;
    }
    
    const prevAvg = this.stats.avgProcessingTime;
    const count = this.stats.totalProcessed;
    this.stats.avgProcessingTime = (prevAvg * (count - 1) + result.scanTime) / count;
    
    console.log(`🎥 ${result.blocked ? '❌ BLOCKED' : '✅ PASSED'} (${result.scanTime}ms)`);
    if (result.blocked) {
      console.log(`🎥 Reason: ${result.reason}`);
      if (result.violations && result.violations.length > 0) {
        console.log(`🎥 Violations: ${result.violations.join(', ')}`);
      }
    }
    console.log(`🎥 ═══════════════════════════════════════════════════════\n`);
    
    return result;
  }
  
  _updateQueueStats() {
    this.stats.queueSize = this.validationQueue.size + this.validationQueue.pending;
    if (this.stats.queueSize > this.stats.peakQueueSize) {
      this.stats.peakQueueSize = this.stats.queueSize;
    }
  }
  
  cleanupFrames(framePaths) {
    if (!Array.isArray(framePaths)) return;
    framePaths.forEach(path => {
      try {
        if (existsSync(path)) unlinkSync(path);
      } catch (e) {}
    });
  }
  
  cleanupTempFile(filePath) {
    if (!filePath) return;
    try {
      if (existsSync(filePath)) unlinkSync(filePath);
    } catch (e) {}
  }
  
  blockResult(reason, confidence, violations, scanTime, checkedBy = []) {
    return {
      blocked: true,
      action: 'BLOCK',
      confidence,
      violations,
      reason,
      checkedBy,
      scanTime,
      metadata: { duration: 0, resolution: '0x0', format: 'unknown', codec: 'unknown' },
      audioResult: {
        transcript: null,
        confidence: 0,
        regexViolations: [],
        aiBlocked: false,
        checkedBy: []
      }
    };
  }
  
  allowResult(reason, confidence, scanTime, checkedBy = []) {
    return {
      blocked: false,
      action: 'ALLOW',
      confidence,
      violations: [],
      reason,
      checkedBy,
      scanTime,
      metadata: { duration: 0, resolution: '0x0', format: 'unknown', codec: 'unknown' },
      audioResult: {
        transcript: null,
        confidence: 0,
        regexViolations: [],
        aiBlocked: false,
        checkedBy: []
      }
    };
  }
  
  getStats() {
    return {
      totalProcessed: this.stats.totalProcessed,
      totalBlocked: this.stats.totalBlocked,
      totalAllowed: this.stats.totalAllowed,
      blockRate: ((this.stats.totalBlocked / (this.stats.totalProcessed || 1)) * 100).toFixed(2) + '%',
      avgProcessingTime: Math.round(this.stats.avgProcessingTime) + 'ms',
      currentQueueSize: this.validationQueue.size + this.validationQueue.pending,
      peakQueueSize: this.stats.peakQueueSize
    };
  }
  
  getHealth() {
    return {
      status: 'healthy',
      validator: 'VideoValidator',
      ready: true,
      queueActive: this.validationQueue.size + this.validationQueue.pending > 0,
      audioScannerReady: this.audioScanner ? true : false
    };
  }
  
  async shutdown() {
    console.log('🎥 [VideoValidator] Shutting down...');
    
    await this.validationQueue.onIdle();
    await this.frameQueue.onIdle();
    
    if (this.audioScanner) {
      await this.audioScanner.shutdown();
    }
    
    console.log('🎥 [VideoValidator] Shutdown complete');
  }
}

export default new VideoValidator();