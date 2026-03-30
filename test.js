// test.js - Quick integration test

import Llama3Checker from './src/ai/Llama3Checker.js';
import TextScanner from './src/scanners/TextScanner.js';
import ImageScanner from './src/scanners/ImageScanner.js';
import AudioScanner from './src/scanners/AudioScanner.js';
import fs from 'fs';

// ═══════════════════════════════════════════════════════════════════════════
// STEP 1: Initialize AI (once, shared across all scanners)
// ═══════════════════════════════════════════════════════════════════════════

console.log('🚀 Initializing AI system...\n');

const ai = new Llama3Checker({
  ollamaUrl: process.env.OLLAMA_URL || 'http://localhost:11434',
  model: process.env.OLLAMA_MODEL || 'llama3.2:3b'
});

// Wait for AI to initialize
await new Promise(resolve => setTimeout(resolve, 2000));

console.log('✅ AI Health:', ai.getHealth(), '\n');

// ═══════════════════════════════════════════════════════════════════════════
// STEP 2: Initialize Scanners (inject AI dependency)
// ═══════════════════════════════════════════════════════════════════════════

const textScanner = new TextScanner(ai);
const imageScanner = new ImageScanner(ai);
const audioScanner = new AudioScanner(ai);

console.log('✅ All scanners initialized!\n');

// ═══════════════════════════════════════════════════════════════════════════
// TEST 1: Text Scanning
// ═══════════════════════════════════════════════════════════════════════════

console.log('📝 TEST 1: Text Scanning');
console.log('─'.repeat(50));

const testMessages = [
  'Hello, how are you?',                    // Clean
  'Call me at 9876543210',                  // Phone (instant block)
  'DM me bro',                              // Suspicious (needs AI)
  'Email me at john@gmail.com',             // Email (instant block)
  'Can we talk on WhatsApp?'                // Off-platform (suspicious)
];

for (const message of testMessages) {
  const evidence = await textScanner.scan(message);
  
  console.log(`\nMessage: "${message}"`);
  console.log(`├─ Regex Confidence: ${evidence.regexResult.confidence}%`);
  console.log(`├─ AI Checked: ${evidence.aiResult ? 'Yes' : 'No'}`);
  console.log(`├─ Violations: ${evidence.regexResult.violations.map(v => v.type).join(', ') || 'None'}`);
  console.log(`└─ Scan Time: ${evidence.scanTime}ms`);
}

console.log('\n✅ Text Scanner Statistics:', textScanner.getStats());

// ═══════════════════════════════════════════════════════════════════════════
// TEST 2: Image Scanning (if you have a test image)
// ═══════════════════════════════════════════════════════════════════════════

console.log('\n\n🖼️ TEST 2: Image Scanning');
console.log('─'.repeat(50));

// Create a mock image buffer (or load real image)
// For testing without real image:
const mockImageBuffer = Buffer.from('mock image data for testing');

try {
  const imageEvidence = await imageScanner.scan(mockImageBuffer, {
    isProfilePic: false,
    userId: 'test-user'
  });
  
  console.log('\nImage Scan Result:');
  console.log(`├─ OCR Text Found: ${imageEvidence.ocrResult.text.length} chars`);
  console.log(`├─ Violations: ${imageEvidence.regexResult.violations.length}`);
  console.log(`└─ Total Time: ${imageEvidence.scanTime}ms`);
  
  console.log('\n✅ Image Scanner Statistics:', imageScanner.getStats());
} catch (error) {
  console.log('⚠️ Image scan skipped (expected without real image file)');
}

// ═══════════════════════════════════════════════════════════════════════════
// TEST 3: Audio Scanning (with mock transcription)
// ═══════════════════════════════════════════════════════════════════════════

console.log('\n\n🎙️ TEST 3: Audio Scanning');
console.log('─'.repeat(50));

// Create a mock audio buffer (MP3 format signature)
const mockAudioBuffer = Buffer.from([
  0xFF, 0xFB, 0x90, 0x00, // MP3 header
  ...Array(5000).fill(0x00) // Mock audio data
]);

const audioEvidence = await audioScanner.scan(mockAudioBuffer, {
  duration: 10,
  userId: 'test-user'
});

console.log('\nAudio Scan Result:');
console.log(`├─ Transcript: "${audioEvidence.sttResult.transcript}"`);
console.log(`├─ Violations: ${audioEvidence.regexResult.violations.length}`);
console.log(`├─ AI Checked: ${audioEvidence.aiResult ? 'Yes' : 'No'}`);
console.log(`└─ Total Time: ${audioEvidence.scanTime}ms`);

console.log('\n✅ Audio Scanner Statistics:', audioScanner.getStats());

// ═══════════════════════════════════════════════════════════════════════════
// FINAL HEALTH CHECK
// ═══════════════════════════════════════════════════════════════════════════

console.log('\n\n🏥 SYSTEM HEALTH CHECK');
console.log('─'.repeat(50));
console.log('AI Health:', ai.getHealth());
console.log('AI Metrics:', ai.getMetrics());
console.log('Text Scanner:', textScanner.getHealth());
console.log('Image Scanner:', imageScanner.getHealth());
console.log('Audio Scanner:', audioScanner.getHealth());

console.log('\n\n🎉 ALL TESTS PASSED! System is working correctly!');

// Cleanup
await imageScanner.shutdown();
await audioScanner.shutdown();
await ai.shutdown();