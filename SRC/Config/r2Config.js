// Config/r2Config.js

import { 
  S3Client, 
  PutObjectCommand, 
  DeleteObjectCommand,
  GetObjectCommand 
} from '@aws-sdk/client-s3';

// ═══════════════════════════════════════════════════════════════
// R2 CLIENT SETUP
// ═══════════════════════════════════════════════════════════════

const r2Client = new S3Client({
  region: 'auto',
  endpoint: process.env.CLOUDFLARE_R2_ENDPOINT,
  credentials: {
    accessKeyId: process.env.CLOUDFLARE_R2_ACCESS_KEY_ID,
    secretAccessKey: process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY,
  },
});

// ═══════════════════════════════════════════════════════════════
// ENVIRONMENT VARIABLES
// ═══════════════════════════════════════════════════════════════

const BUCKET_NAME = process.env.CLOUDFLARE_R2_BUCKET_NAME;
const PUBLIC_URL = process.env.CLOUDFLARE_R2_PUBLIC_URL; // e.g., https://your-bucket.r2.dev

// ═══════════════════════════════════════════════════════════════
// ✅ UPLOAD TO R2
// ═══════════════════════════════════════════════════════════════

export const uploadToR2 = async (buffer, key, contentType = 'application/octet-stream') => {
  try {
    
    if (!BUCKET_NAME) {
      throw new Error('R2 Bucket name not configured');
    }
    
    if (!PUBLIC_URL) {
      throw new Error('R2 Public URL not configured');
    }
    
    console.log(`📤 Uploading to R2: ${key}`);
    
    const command = new PutObjectCommand({
      Bucket: BUCKET_NAME,
      Key: key,
      Body: buffer,
      ContentType: contentType,
      // Optional: Add cache control
      CacheControl: 'public, max-age=31536000', // Cache for 1 year
    });

    await r2Client.send(command);
    
    // Construct public URL
    const publicUrl = `${PUBLIC_URL}/${key}`;
    
    console.log(`✅ Uploaded successfully: ${publicUrl}`);
    
    return publicUrl;
    
  } catch (error) {
    console.error('❌ R2 Upload Error:', error.message);
    throw new Error(`Failed to upload to R2: ${error.message}`);
  }
};

// ═══════════════════════════════════════════════════════════════
// ✅ DELETE FROM R2
// ═══════════════════════════════════════════════════════════════

export const deleteFromR2 = async (key) => {
  try {
    
    if (!BUCKET_NAME) {
      throw new Error('R2 Bucket name not configured');
    }
    
    console.log(`🗑️  Deleting from R2: ${key}`);
    
    const command = new DeleteObjectCommand({
      Bucket: BUCKET_NAME,
      Key: key,
    });

    await r2Client.send(command);
    
    console.log(`✅ Deleted successfully: ${key}`);
    
    return true;
    
  } catch (error) {
    console.error('❌ R2 Delete Error:', error.message);
    throw new Error(`Failed to delete from R2: ${error.message}`);
  }
};

// ═══════════════════════════════════════════════════════════════
// ✅ DELETE MULTIPLE FILES FROM R2
// ═══════════════════════════════════════════════════════════════

export const deleteMultipleFromR2 = async (keys) => {
  try {
    const deletePromises = keys.map(key => deleteFromR2(key));
    await Promise.all(deletePromises);
    console.log(`✅ Deleted ${keys.length} files from R2`);
    return true;
  } catch (error) {
    console.error('❌ R2 Multiple Delete Error:', error.message);
    throw new Error(`Failed to delete multiple files: ${error.message}`);
  }
};

// ═══════════════════════════════════════════════════════════════
// ✅ GET FILE FROM R2 (Optional - if you need to download)
// ═══════════════════════════════════════════════════════════════

export const getFromR2 = async (key) => {
  try {
    const command = new GetObjectCommand({
      Bucket: BUCKET_NAME,
      Key: key,
    });

    const response = await r2Client.send(command);
    
    // Convert stream to buffer
    const chunks = [];
    for await (const chunk of response.Body) {
      chunks.push(chunk);
    }
    const buffer = Buffer.concat(chunks);
    
    return buffer;
    
  } catch (error) {
    console.error('❌ R2 Get Error:', error.message);
    throw new Error(`Failed to get from R2: ${error.message}`);
  }
};

// ═══════════════════════════════════════════════════════════════
// ✅ EXTRACT KEY FROM URL (Helper)
// ═══════════════════════════════════════════════════════════════

export const extractKeyFromUrl = (url) => {
  try {
    if (!url || !PUBLIC_URL) return null;
    
    // Remove public URL prefix to get the key
    const key = url.replace(`${PUBLIC_URL}/`, '');
    return key;
    
  } catch (error) {
    console.error('❌ Extract Key Error:', error.message);
    return null;
  }
};

// ═══════════════════════════════════════════════════════════════
// ✅ DELETE BY URL (Helper)
// ═══════════════════════════════════════════════════════════════

export const deleteByUrl = async (url) => {
  const key = extractKeyFromUrl(url);
  if (!key) {
    throw new Error('Invalid R2 URL');
  }
  return await deleteFromR2(key);
};

// ═══════════════════════════════════════════════════════════════
// EXPORT CLIENT (for advanced usage)
// ═══════════════════════════════════════════════════════════════

export default r2Client;