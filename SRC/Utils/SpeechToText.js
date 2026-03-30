/**
 * ═══════════════════════════════════════════════════════════════════════════
 *                          🎙️ SPEECH-TO-TEXT SERVICE
 *                    Audio Transcription with Whisper AI
 * ═══════════════════════════════════════════════════════════════════════════
 * 
 * Converts audio files to text using OpenAI Whisper or compatible APIs.
 * Supports multiple languages and audio formats.
 * 
 * Performance:
 * - Small audio (< 1 min): ~10-30 seconds
 * - Medium audio (1-5 min): ~30-90 seconds
 * - Large audio (> 5 min): ~2-5 minutes
 * 
 * Supported Formats: MP3, WAV, OGG, M4A
 * 
 * Usage:
 *   const stt = new SpeechToText();
 *   const result = await stt.transcribe(audioBuffer);
 *   console.log(result.transcript);
 * 
 * ═══════════════════════════════════════════════════════════════════════════
 */

import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import { promisify } from 'util';
import crypto from 'crypto';

const writeFile = promisify(fs.writeFile);
const unlink = promisify(fs.unlink);

class SpeechToText {
  
  constructor(options = {}) {
    
    // Configuration
    this.config = {
      // STT provider: 'whisper' (local) | 'mock' (for testing)
      provider: options.provider || process.env.STT_PROVIDER || 'mock',
      
      // Whisper model path (if using local Whisper)
      whisperModelPath: options.whisperModelPath || process.env.WHISPER_MODEL_PATH || './models/whisper-base',
      
      // Supported languages
      languages: options.languages || ['en', 'hi'],
      
      // Skip short clips (seconds)
      skipShortClips: parseInt(options.skipShortClips || process.env.SKIP_SHORT_CLIPS_THRESHOLD || '3'),
      
      // Temporary file directory
      tempDir: options.tempDir || '/tmp/audio-transcripts'
    };
    
    // Create temp directory if not exists
    this._ensureTempDir();
    
    // Statistics
    this.stats = {
      totalTranscriptions: 0,
      successfulTranscriptions: 0,
      failedTranscriptions: 0,
      avgTranscriptionTime: 0,
      totalAudioDuration: 0,
      totalTextExtracted: 0
    };
    
    console.log('🎙️ SpeechToText initialized', {
      provider: this.config.provider,
      languages: this.config.languages
    });
  }
  
  // ═══════════════════════════════════════════════════════════════════════════
  // MAIN TRANSCRIPTION METHOD
  // ═══════════════════════════════════════════════════════════════════════════
  
  /**
   * Transcribe audio buffer to text
   * @param {Buffer} audioBuffer - Audio file data
   * @param {object} options - Transcription options
   * @returns {Promise<object>} - Transcription result
   */
  async transcribe(audioBuffer, options = {}) {
    const startTime = Date.now();
    this.stats.totalTranscriptions++;
    
    try {
      
      // ═══════════════════════════════════════════════════════════════════
      // STEP 1: Validate input
      // ═══════════════════════════════════════════════════════════════════
      
      const validation = this._validateInput(audioBuffer);
      if (!validation.valid) {
        throw new Error(validation.error);
      }
      
      // ═══════════════════════════════════════════════════════════════════
      // STEP 2: Detect audio metadata (duration, format)
      // ═══════════════════════════════════════════════════════════════════
      
      const metadata = await this._detectAudioMetadata(audioBuffer, options);
      
      console.log(
        `[STT] Audio detected: ${metadata.duration}s, ` +
        `format: ${metadata.format}, size: ${(audioBuffer.length / 1024).toFixed(1)}KB`
      );
      
      // ═══════════════════════════════════════════════════════════════════
      // STEP 3: Check if audio is too short
      // ═══════════════════════════════════════════════════════════════════
      
      if (metadata.duration < this.config.skipShortClips) {
        console.log(`[STT] Skipping short audio (${metadata.duration}s < ${this.config.skipShortClips}s)`);
        
        return {
          transcript: '',
          confidence: 0,
          duration: metadata.duration,
          skipped: true,
          reason: 'Audio too short for transcription',
          transcriptionTime: Date.now() - startTime
        };
      }
      
      // ═══════════════════════════════════════════════════════════════════
      // STEP 4: Perform transcription (provider-specific)
      // ═══════════════════════════════════════════════════════════════════
      
      console.log('[STT] Starting transcription...');
      
      let result;
      
      switch (this.config.provider) {
        case 'whisper':
          result = await this._transcribeWithWhisper(audioBuffer, options);
          break;
          
        case 'mock':
          result = await this._transcribeWithMock(audioBuffer, options);
          break;
          
        default:
          throw new Error(`Unknown STT provider: ${this.config.provider}`);
      }
      
      // ═══════════════════════════════════════════════════════════════════
      // STEP 5: Post-process transcript
      // ═══════════════════════════════════════════════════════════════════
      
      const cleanedTranscript = this._cleanTranscript(result.transcript);
      
      // ═══════════════════════════════════════════════════════════════════
      // STEP 6: Update statistics
      // ═══════════════════════════════════════════════════════════════════
      
      const transcriptionTime = Date.now() - startTime;
      this._updateStats(transcriptionTime, metadata.duration, cleanedTranscript.length, true);
      
      console.log(
        `[STT] Transcription complete: ${cleanedTranscript.length} chars, ` +
        `${transcriptionTime}ms (${(transcriptionTime / 1000 / metadata.duration).toFixed(1)}x realtime)`
      );
      
      return {
        transcript: cleanedTranscript,
        confidence: result.confidence || 85,
        duration: metadata.duration,
        language: result.language || options.language || 'unknown',
        wordCount: cleanedTranscript.split(/\s+/).filter(w => w.length > 0).length,
        transcriptionTime,
        skipped: false
      };
      
    } catch (error) {
      console.error('[STT] Transcription failed:', error.message);
      
      this.stats.failedTranscriptions++;
      
      return {
        transcript: '',
        confidence: 0,
        duration: 0,
        error: error.message,
        transcriptionTime: Date.now() - startTime,
        skipped: false
      };
    }
  }
  
  // ═══════════════════════════════════════════════════════════════════════════
  // PRIVATE METHODS - VALIDATION
  // ═══════════════════════════════════════════════════════════════════════════
  
  _validateInput(audioBuffer) {
    // Empty buffer
    if (!audioBuffer || !Buffer.isBuffer(audioBuffer)) {
      return { valid: false, error: 'Invalid audio buffer' };
    }
    
    // Too small (< 1KB - likely corrupt)
    if (audioBuffer.length < 1024) {
      return { valid: false, error: 'Audio file too small (likely corrupt)' };
    }
    
    // Too large (> 50MB - prevent DOS)
    if (audioBuffer.length > 50 * 1024 * 1024) {
      return { valid: false, error: 'Audio file too large (max 50MB)' };
    }
    
    return { valid: true };
  }
  
  // ═══════════════════════════════════════════════════════════════════════════
  // PRIVATE METHODS - METADATA DETECTION
  // ═══════════════════════════════════════════════════════════════════════════
  
  async _detectAudioMetadata(audioBuffer, options) {
    // Detect format from magic numbers
    const format = this._detectAudioFormat(audioBuffer);
    
    // Estimate duration (rough approximation based on file size)
    // For production, use ffprobe or similar tool
    const estimatedDuration = options.duration || this._estimateDuration(audioBuffer, format);
    
    return {
      format,
      duration: estimatedDuration,
      size: audioBuffer.length
    };
  }
  
  _detectAudioFormat(buffer) {
    // Check magic numbers (file signatures)
    const signatures = {
      'fff3': 'mp3',    // MP3
      'fff2': 'mp3',    // MP3
      'fffb': 'mp3',    // MP3
      '4944': 'mp3',    // ID3 tag
      '5249': 'wav',    // RIFF (WAV)
      '4f67': 'ogg',    // OggS
      '6674': 'm4a',    // ftyp (M4A/MP4)
      '0000': 'm4a'     // M4A variant
    };
    
    const header = buffer.toString('hex', 0, 4);
    
    for (const [sig, format] of Object.entries(signatures)) {
      if (header.startsWith(sig)) {
        return format;
      }
    }
    
    return 'unknown';
  }
  
  _estimateDuration(buffer, format) {
    // Rough estimation based on file size and typical bitrates
    const bitrates = {
      mp3: 128000,  // 128 kbps
      wav: 1411200, // 1411 kbps (CD quality)
      ogg: 112000,  // 112 kbps
      m4a: 128000   // 128 kbps
    };
    
    const bitrate = bitrates[format] || 128000;
    const durationSeconds = (buffer.length * 8) / bitrate;
    
    return Math.round(durationSeconds);
  }
  
  // ═══════════════════════════════════════════════════════════════════════════
  // PRIVATE METHODS - WHISPER TRANSCRIPTION (Local)
  // ═══════════════════════════════════════════════════════════════════════════
  
  async _transcribeWithWhisper(audioBuffer, options) {
    // Save audio to temporary file
    const tempFilePath = path.join(
      this.config.tempDir,
      `audio-${crypto.randomBytes(8).toString('hex')}.mp3`
    );
    
    try {
      
      await writeFile(tempFilePath, audioBuffer);
      
      // Run Whisper CLI (assuming whisper is installed)
      const result = await this._runWhisperCLI(tempFilePath, options);
      
      // Cleanup
      await unlink(tempFilePath);
      
      return result;
      
    } catch (error) {
      // Cleanup on error
      try {
        await unlink(tempFilePath);
      } catch (e) {
        // Ignore cleanup errors
      }
      
      throw error;
    }
  }
  
  _runWhisperCLI(audioPath, options) {
    return new Promise((resolve, reject) => {
      
      const args = [
        audioPath,
        '--model', 'base',
        '--language', options.language || 'en',
        '--output_format', 'txt'
      ];
      
      const whisper = spawn('whisper', args);
      
      let stdout = '';
      let stderr = '';
      
      whisper.stdout.on('data', (data) => {
        stdout += data.toString();
      });
      
      whisper.stderr.on('data', (data) => {
        stderr += data.toString();
      });
      
      whisper.on('close', (code) => {
        if (code === 0) {
          resolve({
            transcript: stdout.trim(),
            confidence: 85,
            language: options.language || 'en'
          });
        } else {
          reject(new Error(`Whisper failed with code ${code}: ${stderr}`));
        }
      });
      
      whisper.on('error', (error) => {
        reject(new Error(`Whisper execution failed: ${error.message}`));
      });
    });
  }
  
  // ═══════════════════════════════════════════════════════════════════════════
  // PRIVATE METHODS - MOCK TRANSCRIPTION (For Testing)
  // ═══════════════════════════════════════════════════════════════════════════
  
  async _transcribeWithMock(audioBuffer, options) {
    // Simulate transcription delay
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Return mock transcript based on audio size
    const mockTranscripts = [
      'Hello, my number is 9876543210',
      'DM me on WhatsApp at 9876543210',
      'Email me at john@gmail.com',
      'Visit my website at example.com',
      'This is a clean message with no violations',
      'Let me know your contact details',
      'Share your phone number with me'
    ];
    
    const randomIndex = Math.floor(audioBuffer.length / 10000) % mockTranscripts.length;
    
    return {
      transcript: mockTranscripts[randomIndex],
      confidence: 87.5,
      language: options.language || 'en'
    };
  }
  
  // ═══════════════════════════════════════════════════════════════════════════
  // PRIVATE METHODS - TEXT CLEANING
  // ═══════════════════════════════════════════════════════════════════════════
  
  _cleanTranscript(text) {
    if (!text) return '';
    
    return text
      // Remove excessive whitespace
      .replace(/\s+/g, ' ')
      // Remove timestamps (common in transcripts)
      .replace(/\[\d{2}:\d{2}:\d{2}\]/g, '')
      // Remove speaker labels (e.g., "Speaker 1:")
      .replace(/Speaker \d+:/gi, '')
      // Trim
      .trim();
  }
  
  // ═══════════════════════════════════════════════════════════════════════════
  // PRIVATE METHODS - UTILITIES
  // ═══════════════════════════════════════════════════════════════════════════
  
  _ensureTempDir() {
    if (!fs.existsSync(this.config.tempDir)) {
      fs.mkdirSync(this.config.tempDir, { recursive: true });
      console.log(`[STT] Created temp directory: ${this.config.tempDir}`);
    }
  }
  
  // ═══════════════════════════════════════════════════════════════════════════
  // PRIVATE METHODS - STATISTICS
  // ═══════════════════════════════════════════════════════════════════════════
  
  _updateStats(transcriptionTime, audioDuration, textLength, success) {
    if (success) {
      this.stats.successfulTranscriptions++;
      this.stats.totalAudioDuration += audioDuration;
      this.stats.totalTextExtracted += textLength;
    }
    
    // Update average transcription time
    const prevAvg = this.stats.avgTranscriptionTime;
    const count = this.stats.totalTranscriptions;
    this.stats.avgTranscriptionTime = (prevAvg * (count - 1) + transcriptionTime) / count;
  }
  
  // ═══════════════════════════════════════════════════════════════════════════
  // PUBLIC API - STATISTICS & HEALTH
  // ═══════════════════════════════════════════════════════════════════════════
  
  /**
   * Get transcription statistics
   */
  getStats() {
    const successRate = this.stats.totalTranscriptions > 0
      ? ((this.stats.successfulTranscriptions / this.stats.totalTranscriptions) * 100).toFixed(2)
      : 0;
    
    const avgRealtimeRatio = this.stats.totalAudioDuration > 0
      ? (this.stats.avgTranscriptionTime / 1000 / this.stats.totalAudioDuration).toFixed(2)
      : 0;
    
    return {
      totalTranscriptions: this.stats.totalTranscriptions,
      successfulTranscriptions: this.stats.successfulTranscriptions,
      failedTranscriptions: this.stats.failedTranscriptions,
      successRate: successRate + '%',
      avgTranscriptionTime: Math.round(this.stats.avgTranscriptionTime) + 'ms',
      avgRealtimeRatio: avgRealtimeRatio + 'x',
      totalAudioProcessed: Math.round(this.stats.totalAudioDuration) + 's',
      totalTextExtracted: this.stats.totalTextExtracted + ' chars'
    };
  }
  
  /**
   * Get health status
   */
  getHealth() {
    return {
      status: 'healthy',
      provider: this.config.provider,
      languages: this.config.languages,
      ready: true
    };
  }
  
  /**
   * Cleanup temporary files
   */
  async cleanup() {
    try {
      const files = fs.readdirSync(this.config.tempDir);
      
      for (const file of files) {
        const filePath = path.join(this.config.tempDir, file);
        await unlink(filePath);
      }
      
      console.log(`[STT] Cleaned up ${files.length} temporary files`);
    } catch (error) {
      console.warn('[STT] Cleanup failed:', error.message);
    }
  }
}

export default SpeechToText;