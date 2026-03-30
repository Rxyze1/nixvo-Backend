/**
 * ═══════════════════════════════════════════════════════════════════════════
 *                          🎙️ AUDIO SCANNER v3.1
 *                   Self-Contained Audio Validation (FIXED)
 * ═══════════════════════════════════════════════════════════════════════════
 */

import Groq from 'groq-sdk';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { tmpdir } from 'os';

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY
});

class AudioScanner {
  
  constructor(validationService) {
    
    if (!validationService) {
      throw new Error('AudioScanner requires validationService');
    }
    
    this.validationService = validationService;
    
    // Configuration
    this.config = {
      maxFileSize: 25 * 1024 * 1024, // 25MB
      maxAudioDuration: 300, // 5 minutes
      minTranscriptLength: 10
    };
    
    // Statistics
    this.stats = {
      totalScans: 0,
      withTranscript: 0,
      withoutTranscript: 0,
      regexBlocks: 0,
      aiChecks: 0,
      avgScanTime: 0,
      avgSTTTime: 0
    };
    
    console.log('✅ AudioScanner initialized (self-contained mode)');
    console.log('   Groq API Key:', process.env.GROQ_API_KEY ? `SET (${process.env.GROQ_API_KEY.substring(0, 20)}...)` : '❌ MISSING');
  }
  
  // ═══════════════════════════════════════════════════════════════════════════
  // MAIN SCAN METHOD
  // ═══════════════════════════════════════════════════════════════════════════
  
  async scan(audioBuffer, metadata = {}) {
    const startTime = Date.now();
    this.stats.totalScans++;
    
    console.log('\n🎙️  ═══════════════════════════════════════════════════════');
    console.log('🎙️  AUDIO SCANNER STARTED');
    console.log('🎙️  ═══════════════════════════════════════════════════════');
    console.log(`   Size: ${(audioBuffer.length / 1024).toFixed(2)}KB`);
    console.log(`   Duration: ${metadata.duration || 'unknown'}s`);
    console.log(`   Language: ${metadata.language || 'en'}\n`);
    
    try {
      
      // ═══════════════════════════════════════════════════════
      // STEP 1: File Validation
      // ═══════════════════════════════════════════════════════
      
      console.log('   📋 Step 1: Validating audio file...');
      
      if (!audioBuffer || !Buffer.isBuffer(audioBuffer)) {
        console.log('   ❌ Invalid buffer\n');
        return this._createResult('error', 'Invalid audio buffer');
      }
      
      if (audioBuffer.length < 1024) {
        console.log('   ❌ File too small\n');
        return this._createResult('error', 'Audio file too small');
      }
      
      if (audioBuffer.length > this.config.maxFileSize) {
        console.log('   ❌ File too large\n');
        return this._createResult('error', 'Audio file too large');
      }
      
      console.log('   ✅ File validation passed\n');
      
      // ═══════════════════════════════════════════════════════
      // STEP 2: Transcribe Audio (Groq Whisper)
      // ═══════════════════════════════════════════════════════
      
      console.log('   🎤 Step 2: Transcribing with Groq Whisper...');
      const sttStartTime = Date.now();
      
      const sttResult = await this._transcribeAudio(audioBuffer, metadata);
      
      const sttTime = Date.now() - sttStartTime;
      this._updateSTTTime(sttTime);
      
      console.log(`   ✅ Transcription complete (${sttTime}ms)`);
      console.log(`   📏 Length: ${sttResult.transcript?.length || 0} chars`);
      
      if (sttResult.transcript) {
        const preview = sttResult.transcript.substring(0, 80);
        console.log(`   📝 Preview: "${preview}${sttResult.transcript.length > 80 ? '...' : ''}"\n`);
      } else {
        console.log('   ⚠️  No transcript generated\n');
      }
      
      // ═══════════════════════════════════════════════════════
      // STEP 3: Check if meaningful transcript exists
      // ═══════════════════════════════════════════════════════
      
      if (!sttResult.transcript || 
          sttResult.transcript.trim().length < this.config.minTranscriptLength) {
        
        console.log('   ℹ️  No significant speech detected');
        console.log('🎙️  ✅ PASSED (silent/music only)');
        console.log('🎙️  ═══════════════════════════════════════════════════════\n');
        
        this.stats.withoutTranscript++;
        
        return this._createResult('clean', 'No speech detected', {
          sttResult,
          scanTime: Date.now() - startTime
        });
      }
      
      this.stats.withTranscript++;
      
      // ═══════════════════════════════════════════════════════
      // STEP 4: Regex Validation
      // ═══════════════════════════════════════════════════════
      
      console.log('   🔍 Step 3: Regex pattern matching...');
      const regexResult = await this.validationService.validateWithRegex(sttResult.transcript);
      
      console.log(`   📊 Confidence: ${regexResult.confidence}%`);
      console.log(`   📋 Violations: ${regexResult.violations.length}`);
      
      if (regexResult.violations.length > 0) {
        const types = regexResult.violations.map(v => v.type).join(', ');
        console.log(`   ⚠️  Types: ${types}\n`);
      } else {
        console.log('   ✅ No violations\n');
      }
      
      // ═══════════════════════════════════════════════════════
      // STEP 5: Determine if AI check is needed
      // ═══════════════════════════════════════════════════════
      
      const needsAI = this._needsAICheck(regexResult);
      
      if (!needsAI) {
        const blocked = regexResult.confidence >= 95;
        
        console.log(`   ℹ️  ${blocked ? 'Regex confidence high - blocking' : 'Clean - skipping AI'}`);
        console.log(`🎙️  ${blocked ? '❌ BLOCKED' : '✅ PASSED'} (${Date.now() - startTime}ms)`);
        console.log('🎙️  ═══════════════════════════════════════════════════════\n');
        
        if (blocked) {
          this.stats.regexBlocks++;
        }
        
        return this._createResult(
          blocked ? 'blocked' : 'clean',
          blocked ? `Regex detected: ${regexResult.violations.map(v => v.type).join(', ')}` : 'No violations',
          {
            sttResult,
            regexResult,
            aiResult: { blocked, confidence: regexResult.confidence },
            scanTime: Date.now() - startTime
          }
        );
      }
      
      // ═══════════════════════════════════════════════════════
      // STEP 6: AI Validation
      // ═══════════════════════════════════════════════════════
      
      console.log('   🤖 Step 4: AI validation...');
      this.stats.aiChecks++;
      
      const aiResult = await this.validationService.validateWithGroq(
        sttResult.transcript,
        regexResult
      );
      
      const blocked = aiResult.decision === 'BLOCK';
      
      console.log(`   📊 Decision: ${aiResult.decision}`);
      console.log(`   📊 Confidence: ${aiResult.confidence}%`);
      
      if (blocked) {
        console.log(`   🚫 Reason: ${aiResult.reasoning}\n`);
      } else {
        console.log();
      }
      
      console.log(`🎙️  ${blocked ? '❌ BLOCKED' : '✅ PASSED'} (${Date.now() - startTime}ms)`);
      console.log('🎙️  ═══════════════════════════════════════════════════════\n');
      
      const scanTime = Date.now() - startTime;
      this._updateStats(scanTime);
      
      return this._createResult(
        blocked ? 'blocked' : 'clean',
        blocked ? aiResult.reasoning : 'No violations',
        {
          sttResult,
          regexResult,
          aiResult: { blocked, confidence: aiResult.confidence, decision: aiResult.decision },
          scanTime
        }
      );
      
    } catch (error) {
      console.error('   ❌ Audio scan error:', error.message);
      console.error('   Stack:', error.stack);
      console.log('🎙️  ═══════════════════════════════════════════════════════\n');
      
      return this._createResult('error', error.message, {
        scanTime: Date.now() - startTime
      });
    }
  }
  
  // ═══════════════════════════════════════════════════════════════════════════
  // TRANSCRIBE AUDIO (Groq Whisper)
  // ═══════════════════════════════════════════════════════════════════════════
  
  async _transcribeAudio(audioBuffer, metadata) {
    try {
      
      // Save to temp file
      const tempPath = path.join(tmpdir(), `audio-${crypto.randomBytes(8).toString('hex')}.mp3`);
      fs.writeFileSync(tempPath, audioBuffer);
      
      console.log('      🔊 Calling Groq Whisper API...');
      
      // Transcribe with Groq
      const transcription = await groq.audio.transcriptions.create({
        file: fs.createReadStream(tempPath),
        model: 'whisper-large-v3-turbo',
        response_format: 'verbose_json',
        language: metadata.language || 'en',
        temperature: 0.0
      });
      
      // Cleanup
      try {
        fs.unlinkSync(tempPath);
      } catch (e) {}
      
      return {
        transcript: transcription.text || '',
        confidence: 100, // Groq doesn't provide confidence
        language: transcription.language || 'en',
        duration: transcription.duration || 0
      };
      
    } catch (error) {
      console.error('      ⚠️  Transcription failed:', error.message);
      
      return {
        transcript: null,  // ✅ FIXED: Use null instead of empty string
        confidence: 0,
        error: error.message
      };
    }
  }
  
  // ═══════════════════════════════════════════════════════════════════════════
  // AI DECISION LOGIC
  // ═══════════════════════════════════════════════════════════════════════════
  
  _needsAICheck(regexResult) {
    // High confidence - no AI needed
    if (regexResult.confidence >= 95) {
      return false;
    }
    
    // Very low confidence - clean
    if (regexResult.confidence < 40) {
      return false;
    }
    
    // Medium confidence - needs AI
    return true;
  }
  
  // ═══════════════════════════════════════════════════════════════════════════
  // RESULT CREATION (FIXED)
  // ═══════════════════════════════════════════════════════════════════════════
  
  _createResult(type, reason, data = {}) {
    // ✅ FIXED: Properly handle null vs empty string for transcript
    const baseResult = {
      sttResult: data.sttResult || { transcript: null, confidence: 0 },  // ← Use null
      regexResult: data.regexResult || { violations: [], confidence: 0 },
      aiResult: data.aiResult || { blocked: false, confidence: 0 },
      checkedBy: [],
      scanTime: data.scanTime || 0,
      error: data.error || null
    };
    
    // Determine checkedBy
    if (type === 'error') {
      baseResult.checkedBy = ['audio-error'];
    } else if (type === 'clean' && !data.sttResult?.transcript) {
      baseResult.checkedBy = ['audio-no-speech'];
    } else if (data.aiResult?.decision) {
      baseResult.checkedBy = ['audio-stt', 'audio-regex', 'audio-ai'];
    } else {
      baseResult.checkedBy = ['audio-stt', 'audio-regex'];
    }
    
    return baseResult;
  }
  
  // ═══════════════════════════════════════════════════════════════════════════
  // STATISTICS
  // ═══════════════════════════════════════════════════════════════════════════
  
  _updateStats(scanTime) {
    const prevAvg = this.stats.avgScanTime;
    const count = this.stats.totalScans;
    this.stats.avgScanTime = (prevAvg * (count - 1) + scanTime) / count;
  }
  
  _updateSTTTime(sttTime) {
    const prevAvg = this.stats.avgSTTTime;
    const count = this.stats.totalScans;
    this.stats.avgSTTTime = (prevAvg * (count - 1) + sttTime) / count;
  }
  
  // ═══════════════════════════════════════════════════════════════════════════
  // PUBLIC API
  // ═══════════════════════════════════════════════════════════════════════════
  
  getStats() {
    return {
      totalScans: this.stats.totalScans,
      withTranscript: this.stats.withTranscript,
      withoutTranscript: this.stats.withoutTranscript,
      transcriptRate: this.stats.totalScans > 0 
        ? ((this.stats.withTranscript / this.stats.totalScans) * 100).toFixed(2) + '%' 
        : '0%',
      regexBlocks: this.stats.regexBlocks,
      aiChecks: this.stats.aiChecks,
      avgScanTime: Math.round(this.stats.avgScanTime) + 'ms',
      avgSTTTime: Math.round(this.stats.avgSTTTime) + 'ms'
    };
  }
  
  getHealth() {
    return {
      status: 'healthy',
      scanner: 'AudioScanner',
      ready: true,
      groqConnected: process.env.GROQ_API_KEY ? true : false
    };
  }
  
  async shutdown() {
    console.log('🎙️  [AudioScanner] Shutting down...');
  }
}

export default AudioScanner;