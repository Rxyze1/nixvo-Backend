// Service/Security/TesseractManager.js

import { createWorker } from 'tesseract.js';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';
import https from 'https';
import { GetObjectCommand, HeadObjectCommand } from '@aws-sdk/client-s3';
import r2Client, { uploadToR2 } from '../../Config/r2Config.js';

const BUCKET      = process.env.CLOUDFLARE_R2_BUCKET_NAME;
const LANGS       = ['eng'];
const R2_PREFIX   = 'tesseract-data';
const LOCAL_CACHE = path.join(os.homedir(), '.editcraft', 'tesseract-cache');

// Tesseract.js v4/v5 CDN URL for traineddata files
const TRAINEDDATA_URLS = {
  eng: 'https://tessdata.projectnaptha.com/4.0.0/eng.traineddata.gz',
  // fallback mirror
  eng_fallback: 'https://github.com/naptha/tessdata/blob/gh-pages/4.0.0/eng.traineddata.gz?raw=true',
};

class TesseractManager {

  constructor() {
    this.worker      = null;
    this.initPromise = null;
    this.isReady     = false;
  }

  // ═══════════════════════════════════════════════════════════════
  // PUBLIC — get worker (lazy singleton)
  // ═══════════════════════════════════════════════════════════════

  async getWorker() {
    if (this.worker && this.isReady) return this.worker;
    if (!this.initPromise) {
      this.initPromise = this._initialize();
    }
    return this.initPromise;
  }

  // ═══════════════════════════════════════════════════════════════
  // INIT
  // ═══════════════════════════════════════════════════════════════

  async _initialize() {
    try {
      console.log('\n🔤 ══════════════════════════════════════════════════');
      console.log('🔤  TESSERACT MANAGER — INITIALIZING');
      console.log('🔤 ══════════════════════════════════════════════════\n');
      console.log(`   Bucket     : ${BUCKET}`);
      console.log(`   Local cache: ${LOCAL_CACHE}`);
      console.log(`   Languages  : ${LANGS.join(', ')}\n`);

      await fs.mkdir(LOCAL_CACHE, { recursive: true });

      for (const lang of LANGS) {
        await this._ensureTrainedData(lang);
      }

      console.log('   🔧 Starting Tesseract worker...');

      // ✅ Point worker directly at our controlled cache dir
      this.worker = await createWorker(LANGS[0], 1, {
        cachePath:   LOCAL_CACHE,
        cacheMethod: 'readWrite',
        // ❌ NO logger — DataCloneError in worker threads
      });

      this.isReady     = true;
      this.initPromise = null;

      console.log('   ✅ Tesseract worker ready\n');
      return this.worker;

    } catch (err) {
      console.error('   ❌ Tesseract init failed:', err.message);
      this.worker      = null;
      this.initPromise = null;
      this.isReady     = false;
      return null;
    }
  }

  // ═══════════════════════════════════════════════════════════════
  // ENSURE TRAINED DATA
  // Priority: local cache → R2 → direct CDN download
  // ═══════════════════════════════════════════════════════════════

  async _ensureTrainedData(lang) {
    const localPath = path.join(LOCAL_CACHE, `${lang}.traineddata`);
    const r2Key     = `${R2_PREFIX}/${lang}.traineddata`;

    console.log(`   🔍 Checking ${lang}.traineddata...`);

    // ── 1. Local cache ─────────────────────────────────────────
    const localExists = await fs.access(localPath).then(() => true).catch(() => false);
    if (localExists) {
      const stats = await fs.stat(localPath);
      // Sanity check — file must be > 1 MB to be a real traineddata file
      if (stats.size > 1024 * 1024) {
        console.log(`   ✅ Local cache hit — ${(stats.size / 1024 / 1024).toFixed(2)} MB\n`);
        return;
      }
      // Corrupt/empty file — delete and re-download
      console.log(`   ⚠️  Cached file too small (${stats.size} bytes) — re-downloading\n`);
      await fs.unlink(localPath).catch(() => {});
    }

    console.log(`   ℹ️  Not in local cache`);

    // ── 2. Try R2 ──────────────────────────────────────────────
    const inR2 = await this._existsInR2(r2Key);
    if (inR2) {
      console.log(`   📥 Downloading from R2: ${r2Key}`);
      await this._downloadFromR2(r2Key, localPath);
      const stats = await fs.stat(localPath);
      console.log(`   ✅ Downloaded from R2 — ${(stats.size / 1024 / 1024).toFixed(2)} MB\n`);
      return;
    }

    // ── 3. Direct CDN download (first time ever) ───────────────
    console.log(`   📥 Downloading directly from Tesseract CDN...`);
    console.log(`   ⏳ ~10 MB — this only happens once\n`);

    const downloaded = await this._downloadFromCDN(lang, localPath);
    if (!downloaded) {
      throw new Error(
        `Failed to download ${lang}.traineddata from all sources. ` +
        `Please manually download from https://github.com/naptha/tessdata and place in: ${LOCAL_CACHE}`
      );
    }

    // ── 4. Upload to R2 for all future cold starts ─────────────
    console.log(`   📤 Uploading to R2 for future use...`);
    try {
      await this._uploadToR2(localPath, r2Key);
      const stats = await fs.stat(localPath);
      console.log(`   ✅ Stored in R2 — ${(stats.size / 1024 / 1024).toFixed(2)} MB\n`);
    } catch (uploadErr) {
      // Non-fatal — file is already local, OCR will work
      console.warn(`   ⚠️  R2 upload failed (non-fatal): ${uploadErr.message}\n`);
    }
  }

  // ═══════════════════════════════════════════════════════════════
  // DIRECT CDN DOWNLOAD
  // Tesseract.js v4 stores .gz files — we download & decompress
  // ═══════════════════════════════════════════════════════════════

  async _downloadFromCDN(lang, destPath) {
    // Try primary URL first, then fallback
    const urls = [
      `https://tessdata.projectnaptha.com/4.0.0/${lang}.traineddata.gz`,
      `https://github.com/naptha/tessdata/blob/gh-pages/4.0.0/${lang}.traineddata.gz?raw=true`,
    ];

    for (const url of urls) {
      try {
        console.log(`   🌐 Trying: ${url}`);
        await this._downloadGzippedFile(url, destPath);

        // Verify downloaded file is valid
        const stats = await fs.stat(destPath);
        if (stats.size > 1024 * 1024) {
          console.log(`   ✅ Downloaded — ${(stats.size / 1024 / 1024).toFixed(2)} MB`);
          return true;
        }

        console.warn(`   ⚠️  Downloaded file too small (${stats.size} bytes) — trying next URL`);
        await fs.unlink(destPath).catch(() => {});

      } catch (err) {
        console.warn(`   ⚠️  Failed from ${url}: ${err.message}`);
        await fs.unlink(destPath).catch(() => {});
      }
    }

    return false;
  }

  // ═══════════════════════════════════════════════════════════════
  // DOWNLOAD + DECOMPRESS .gz FILE
  // ═══════════════════════════════════════════════════════════════

  _downloadGzippedFile(url, destPath) {
    return new Promise((resolve, reject) => {
      // Dynamic import of zlib (built-in)
      import('zlib').then(({ createGunzip }) => {
        import('fs').then(({ createWriteStream }) => {

          const gunzip      = createGunzip();
          const fileStream  = createWriteStream(destPath);
          let   totalBytes  = 0;
          let   lastLog     = 0;

          const request = https.get(url, { timeout: 60000 }, (response) => {

            // Follow redirects
            if (response.statusCode === 301 || response.statusCode === 302) {
              fileStream.close();
              gunzip.destroy();
              this._downloadGzippedFile(response.headers.location, destPath)
                .then(resolve)
                .catch(reject);
              return;
            }

            if (response.statusCode !== 200) {
              reject(new Error(`HTTP ${response.statusCode} from ${url}`));
              return;
            }

            response.pipe(gunzip).pipe(fileStream);

            response.on('data', (chunk) => {
              totalBytes += chunk.length;
              const now   = Date.now();
              if (now - lastLog > 2000) {
                console.log(`   ⬇️  ${(totalBytes / 1024 / 1024).toFixed(2)} MB downloaded...`);
                lastLog = now;
              }
            });

            fileStream.on('finish', () => {
              fileStream.close();
              resolve();
            });

            fileStream.on('error', reject);
            gunzip.on('error',     reject);
            response.on('error',   reject);
          });

          request.on('error',   reject);
          request.on('timeout', () => {
            request.destroy();
            reject(new Error('Download timed out after 60s'));
          });

        }).catch(reject);
      }).catch(reject);
    });
  }

  // ═══════════════════════════════════════════════════════════════
  // R2 HELPERS
  // ═══════════════════════════════════════════════════════════════

  async _existsInR2(key) {
    try {
      await r2Client.send(new HeadObjectCommand({ Bucket: BUCKET, Key: key }));
      console.log(`   ☁️  Found in R2: ${key}`);
      return true;
    } catch {
      console.log(`   ☁️  Not in R2: ${key}`);
      return false;
    }
  }

  async _downloadFromR2(key, destPath) {
    const response = await r2Client.send(
      new GetObjectCommand({ Bucket: BUCKET, Key: key })
    );
    const chunks = [];
    for await (const chunk of response.Body) {
      chunks.push(chunk);
    }
    await fs.writeFile(destPath, Buffer.concat(chunks));
  }

  async _uploadToR2(filePath, r2Key) {
    const buf = await fs.readFile(filePath);
    await uploadToR2(buf, r2Key, 'application/octet-stream');
  }

  // ═══════════════════════════════════════════════════════════════
  // SHUTDOWN
  // ═══════════════════════════════════════════════════════════════

  async shutdown() {
    if (this.worker) {
      try {
        await this.worker.terminate();
        console.log('✅ Tesseract worker terminated');
      } catch (err) {
        console.warn('⚠️  Tesseract shutdown error:', err.message);
      }
      this.worker  = null;
      this.isReady = false;
    }
  }
}

export default new TesseractManager();