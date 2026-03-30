// Service/Certificate/CertificateService.js
import fsSync            from 'fs';
import path              from 'path';
import { fileURLToPath } from 'url';
import puppeteer         from 'puppeteer';
import QRCode            from 'qrcode';

import Certificate    from '../../Models/Certificate/Certificate.Model.js';
import { uploadToR2 } from '../../Config/r2Config.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);

const VERIFY_BASE = process.env.VERIFY_BASE_URL || 'https://editcraft.co.in/verify';

const FONTS = `https://fonts.googleapis.com/css2?family=Pinyon+Script&family=Cinzel:wght@400;600;700&family=Cormorant+Garamond:wght@300;400;500;600;700&family=Montserrat:wght@300;400;500;600;700&family=Dancing+Script:wght@400;500;600;700&display=swap`;

// ═══════════════════════════════════════════════════════════════
// PNG background → base64
// ═══════════════════════════════════════════════════════════════

const getBase64Image = (tier) => {
  const p = tier === 'pro'
    ? path.resolve(__dirname, '../../assets/Pro-Cetrificate.png')
    : path.resolve(__dirname, '../../assets/Basic-Certificate.png');
  if (!fsSync.existsSync(p)) return '';
  return `data:image/png;base64,${fsSync.readFileSync(p).toString('base64')}`;
};

// ═══════════════════════════════════════════════════════════════
// QR CODE
// ═══════════════════════════════════════════════════════════════

const generateQRDataURL = (url) =>
  QRCode.toDataURL(url, {
    type: 'image/png', width: 300, margin: 2,
    color: { dark: '#000000', light: '#ffffff' },
    errorCorrectionLevel: 'H',
  });

const generateQRBuffer = (url) =>
  QRCode.toBuffer(url, {
    type: 'png', width: 300, margin: 2,
    color: { dark: '#000000', light: '#ffffff' },
    errorCorrectionLevel: 'H',
  });

// ═══════════════════════════════════════════════════════════════
// BASIC CERTIFICATE HTML
// ═══════════════════════════════════════════════════════════════

const buildBasicHTML = ({ certificateId, employeeName, skill, bio, formattedDate, bgSrc }) => {
  const desc = bio ||
    `Awarded in recognition of demonstrated expertise and verified competency in ${skill}. Issued by Nixvo upon successful completion of the professional skill assessment program.`;

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<link href="${FONTS}" rel="stylesheet">
<style>
* { margin:0; padding:0; box-sizing:border-box; }
html, body { width:960px; height:679px; overflow:hidden; }
.cert { position:relative; width:960px; height:679px; overflow:hidden; }
.cert img.bg { position:absolute; inset:0; width:100%; height:100%; object-fit:fill; display:block; }

.serial { position:absolute; top:18px; right:24px; z-index:1; font-family:'Montserrat',sans-serif; font-size:7.5px; font-weight:600; color:rgba(212,175,55,0.42); letter-spacing:2.5px; text-transform:uppercase; }

.title-block { position:absolute; top:48px; right:30px; text-align:right; z-index:1; }
.cert-title { display:block; font-family:'Cinzel',serif; font-size:36px; font-weight:700; color:#ffffff; letter-spacing:8px; line-height:1; }
.cert-sub { display:block; font-family:'Cinzel',serif; font-size:12px; font-weight:400; color:rgba(195,190,180,0.7); letter-spacing:10px; margin-top:4px; }
.title-underline { margin-top:8px; height:1px; background:linear-gradient(90deg, transparent, rgba(212,175,55,0.5)); }

.content { position:absolute; left:260px; width:590px; top:150px; height:350px; z-index:1; display:flex; flex-direction:column; align-items:center; justify-content:center; text-align:center; }
.flourish-top { margin-bottom:10px; display:flex; align-items:center; gap:12px; opacity:0.35; }
.fl-line { width:60px; height:1px; background:linear-gradient(90deg, transparent, rgba(212,175,55,0.6), transparent); }
.fl-diamond { font-size:6px; color:rgba(212,175,55,0.7); }
.presented { font-family:'Montserrat',sans-serif; font-size:14.5px; font-weight:700; color:rgb(236,236,236); letter-spacing:6px; text-transform:uppercase; margin-bottom:13px; }
.name { font-family:'Pinyon Script',cursive; font-size:70px; line-height:1; white-space:nowrap; margin-bottom:10px; letter-spacing:1px; background:linear-gradient(180deg,#e8d07a 0%,#d4af37 35%,#c49a2f 60%,#d4af37 100%); -webkit-background-clip:text; -webkit-text-fill-color:transparent; background-clip:text; }
.flourish-bottom { margin-bottom:14px; display:flex; align-items:center; gap:10px; opacity:0.3; }
.fl-line-m { width:80px; height:1px; background:linear-gradient(90deg, transparent, rgba(212,175,55,0.6), transparent); }
.fl-ornament { font-size:10px; color:rgba(212,175,55,0.65); letter-spacing:4px; }
.skill-tag { font-family:'Montserrat',sans-serif; font-size:9px; font-weight:700; color:rgba(190,185,172,0.68); letter-spacing:6px; text-transform:uppercase; margin-bottom:16px; }
.desc { font-family:'Cormorant Garamond',serif; font-size:16px; font-weight:700; color:rgba(233,230,226,0.88); line-height:1.4; max-width:560px; }

.bottom-row { position:absolute; top:510px; left:240px; width:490px; z-index:1; display:flex; justify-content:space-between; padding:0 10px; }
.bottom-item { display:flex; flex-direction:column; align-items:center; width:190px; }
.date-val { font-family:'Dancing Script',cursive; font-size:16px; font-weight:600; color:#b2aa94; line-height:1.1; white-space:nowrap; margin-bottom:5px; }
.sig-val { font-family:'Pinyon Script',cursive; font-size:26px; color:#b2aa94; line-height:1; white-space:nowrap; margin-bottom:5px; }
.b-line { width:130px; height:1px; background:linear-gradient(90deg, transparent, rgba(170,162,140,0.35), transparent); margin-bottom:5px; }
.b-lbl { font-family:'Montserrat',sans-serif; font-size:6.5px; font-weight:500; color:rgba(80,75,62,0.95); letter-spacing:3.5px; text-transform:uppercase; }

.tier-badge { position:absolute; top:650px; left:240px; width:490px; text-align:center; z-index:1; font-family:'Montserrat',sans-serif; font-size:7px; font-weight:700; color:rgba(212,175,55,0.22); letter-spacing:5px; text-transform:uppercase; }
</style>
</head>
<body>
<div class="cert">
  <img class="bg" src="${bgSrc}" alt="">
  <div class="serial">${certificateId}</div>
  <div class="title-block">
    <span class="cert-title">CERTIFICATE</span>
    <span class="cert-sub">OF SKILL</span>
    <div class="title-underline"></div>
  </div>
  <div class="content">
    <div class="flourish-top"><span class="fl-line"></span><span class="fl-diamond">◆</span><span class="fl-line"></span></div>
    <div class="presented">Proudly Presented To</div>
    <div class="name">${employeeName}</div>
    <div class="flourish-bottom"><span class="fl-line-m"></span><span class="fl-ornament">· · ·</span><span class="fl-line-m"></span></div>
    <div class="skill-tag">${skill}</div>
    <div class="desc">${desc}</div>
  </div>
  <div class="bottom-row">
    <div class="bottom-item"><div class="date-val">${formattedDate}</div><div class="b-line"></div><div class="b-lbl">Date</div></div>
    <div class="bottom-item"><div class="sig-val">Rudra Majumdar</div><div class="b-line"></div><div class="b-lbl">Founder, Nixvo</div></div>
  </div>
  <div class="tier-badge">✦ &nbsp; B A S I C &nbsp; C E R T I F I C A T E &nbsp; ✦</div>
</div>
</body></html>`;
};

// ═══════════════════════════════════════════════════════════════
// PRO CERTIFICATE HTML
// ═══════════════════════════════════════════════════════════════

const buildProHTML = ({ certificateId, employeeName, skill, bio, formattedDate, bgSrc }) => {
  const desc = bio
    ? bio.substring(0, 260)
    : `Awarded in recognition of demonstrated expertise and verified competency in ${skill}. Issued by Nixvo upon successful completion of the professional skill assessment program.`;

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<link href="${FONTS}" rel="stylesheet">
<style>
* { margin:0; padding:0; box-sizing:border-box; }
html, body { width:960px; height:679px; overflow:hidden; }
.cert { position:relative; width:960px; height:679px; overflow:hidden; }
.cert img.bg { position:absolute; inset:0; width:100%; height:100%; object-fit:fill; display:block; }

.serial { position:absolute; top:20px; right:22px; z-index:1; font-family:'Montserrat',sans-serif; font-size:8px; font-weight:600; color:rgba(212,175,55,0.45); letter-spacing:2px; text-transform:uppercase; }

.content { position:absolute; top:135px; height:244px; left:0; right:0; z-index:1; display:flex; flex-direction:column; align-items:center; justify-content:center; text-align:center; }
.nixvo-tag { font-family:'Montserrat',sans-serif; font-size:8px; font-weight:800; color:rgba(255,255,255,0.32); letter-spacing:6px; text-transform:uppercase; margin-bottom:7px; }
.cert-title { font-family:'Cinzel',serif; font-size:34px; font-weight:700; color:#ffffff; letter-spacing:8px; line-height:1; margin-bottom:2px; }
.cert-sub { font-family:'Cinzel',serif; font-size:11px; font-weight:400; color:rgba(195,190,178,0.72); letter-spacing:10px; margin-bottom:10px; }
.gold-line { width:180px; height:1px; margin:0 auto 10px; background:linear-gradient(90deg, transparent, #d4af37 30%, #f5e07a 50%, #d4af37 70%, transparent); }
.presented { font-family:'Montserrat',sans-serif; font-size:10px; font-weight:600; color:rgba(205,200,185,0.65); letter-spacing:6px; text-transform:uppercase; margin-bottom:8px; }
.name { font-family:'Pinyon Script',cursive; font-size:64px; line-height:1; white-space:nowrap; margin-bottom:4px; letter-spacing:1px; background:linear-gradient(105deg,#b8941e 0%,#d4af37 20%,#f5e99a 38%,#ffe566 42%,#f5e99a 46%,#d4af37 60%,#b8941e 78%,#d4af37 100%); background-size:250% 100%; -webkit-background-clip:text; -webkit-text-fill-color:transparent; background-clip:text; }
.name-line { width:260px; height:1px; background:linear-gradient(90deg, transparent, rgba(212,175,55,0.4), transparent); margin:0 auto 8px; }
.skill-label { font-family:'Montserrat',sans-serif; font-size:7.5px; font-weight:600; color:rgba(150,145,132,0.7); letter-spacing:5px; text-transform:uppercase; margin-bottom:3px; }
.skill-name { font-family:'Cinzel',serif; font-size:13px; font-weight:700; color:#ffffff; letter-spacing:4px; margin-bottom:10px; }
.desc { font-family:'Cormorant Garamond',serif; font-size:11.5px; font-weight:400; color:rgba(165,159,148,0.88); line-height:1.85; max-width:400px; text-align:center; }

.bottom-row { position:absolute; top:505px; left:0; right:0; z-index:1; display:flex; justify-content:center; gap:290px; }
.bottom-item { display:flex; flex-direction:column; align-items:center; width:150px; }
.date-val { font-family:'Dancing Script',cursive; font-size:17px; font-weight:600; line-height:1.1; white-space:nowrap; margin-bottom:5px; background:linear-gradient(180deg,#f5e07a 0%,#e2c154 40%,#c4a030 65%,#e2c154 100%); -webkit-background-clip:text; -webkit-text-fill-color:transparent; background-clip:text; }
.sig-val { font-family:'Pinyon Script',cursive; font-size:28px; line-height:1; white-space:nowrap; margin-bottom:5px; background:linear-gradient(180deg,#f5e07a 0%,#e2c154 40%,#c4a030 65%,#e2c154 100%); -webkit-background-clip:text; -webkit-text-fill-color:transparent; background-clip:text; }
.p-line { width:120px; height:1px; background:linear-gradient(90deg, transparent, rgba(165,158,138,0.38), transparent); margin-bottom:4px; }
.p-lbl { font-family:'Montserrat',sans-serif; font-size:6.5px; font-weight:500; color:rgba(80,75,62,0.9); letter-spacing:3.5px; text-transform:uppercase; }

.tier-badge { position:absolute; top:460px; left:0; right:0; text-align:center; z-index:1; font-family:'Montserrat',sans-serif; font-size:7.5px; font-weight:700; color:rgba(212,175,55,0.30); letter-spacing:5px; text-transform:uppercase; }
</style>
</head>
<body>
<div class="cert">
  <img class="bg" src="${bgSrc}" alt="">
  <div class="serial">${certificateId}</div>
  <div class="content">
    <div class="nixvo-tag">Nixvo · Verified Professional</div>
    <div class="cert-title">CERTIFICATE</div>
    <div class="cert-sub">O F &nbsp;&nbsp; S K I L L</div>
    <div class="gold-line"></div>
    <div class="presented">Proudly Presented To</div>
    <div class="name">${employeeName}</div>
    <div class="name-line"></div>
    <div class="skill-label">Certified Skill</div>
    <div class="skill-name">${skill}</div>
    <div class="desc">${desc}</div>
  </div>
  <div class="bottom-row">
    <div class="bottom-item"><div class="date-val">${formattedDate}</div><div class="p-line"></div><div class="p-lbl">Date</div></div>
    <div class="bottom-item"><div class="sig-val">Rudra Majumdar</div><div class="p-line"></div><div class="p-lbl">Founder, Nixvo</div></div>
  </div>
  <div class="tier-badge">★ &nbsp; P R O &nbsp; C E R T I F I C A T E &nbsp; ★</div>
</div>
</body></html>`;
};

// ═══════════════════════════════════════════════════════════════
// VERIFICATION PAGE HTML (dark page — PNG screenshot)
// ═══════════════════════════════════════════════════════════════

const buildVerificationHTML = ({ certificateId, tier, skill, employeeName, formattedDate, verificationUrl, assessment, qrDataURL }) => {
  const tierLabel = tier === 'pro' ? '★  Pro Certificate' : '✦  Basic Certificate';
  const qaRows = (assessment?.answers || []).slice(0, 3).map(qa => `
    <div class="qa-block">
      <div class="qa-q">Q: ${qa.question}</div>
      <div class="qa-a">A: ${qa.answer}</div>
    </div>`).join('');

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<link href="${FONTS}" rel="stylesheet">
<style>
* { margin:0; padding:0; box-sizing:border-box; }
html, body { width:960px; height:679px; overflow:hidden; background:#0d0d0d; font-family:'Montserrat',sans-serif; }
.page { width:960px; height:679px; background:#0d0d0d; display:flex; overflow:hidden; position:relative; }
.red-bar { width:6px; flex-shrink:0; background:linear-gradient(180deg,#c0392b,#7b0000); }
.inner { flex:1; padding:48px 56px; display:flex; gap:52px; }
.qr-side { display:flex; flex-direction:column; align-items:center; gap:10px; flex-shrink:0; width:172px; }
.qr-box { width:152px; height:152px; background:#fff; padding:7px; }
.qr-box img { width:138px; height:138px; display:block; }
.qr-scan { font-size:7px; color:#444; letter-spacing:3px; text-transform:uppercase; text-align:center; }
.qr-url { font-size:7px; color:rgba(212,175,55,0.5); text-align:center; word-break:break-all; line-height:1.6; }
.qa-section { margin-top:8px; width:100%; }
.qa-title { font-size:7px; font-weight:700; color:#333; letter-spacing:2px; text-transform:uppercase; margin-bottom:8px; }
.qa-block { margin-bottom:10px; }
.qa-q { font-size:6.5px; color:#444; line-height:1.4; }
.qa-a { font-size:6.5px; font-weight:700; color:#606060; line-height:1.4; margin-top:2px; }
.detail-side { flex:1; }
.v-title { font-family:'Cinzel',serif; font-size:26px; color:#fff; letter-spacing:4px; margin-bottom:3px; }
.v-sub { font-size:8.5px; color:#d4af37; letter-spacing:6px; text-transform:uppercase; opacity:0.7; }
.v-div { width:54px; height:2px; background:linear-gradient(90deg,#d4af37,transparent); margin:16px 0 20px; }
.v-row { display:flex; gap:16px; padding:10px 0; border-bottom:1px solid #161616; align-items:center; }
.v-lbl { font-size:7.5px; font-weight:600; color:#3a3a3a; letter-spacing:3px; text-transform:uppercase; width:100px; flex-shrink:0; }
.v-val { font-size:13px; font-weight:500; color:#ddd; }
.v-val.gold { color:#d4af37; font-family:'Cinzel',serif; font-size:15px; }
.v-val.serial { color:#d4af37; font-weight:700; font-size:12px; letter-spacing:2px; }
.v-val.green { color:#27ae60; }
.v-stamp { margin-top:18px; display:flex; align-items:center; gap:14px; border:1px solid rgba(212,175,55,0.12); background:rgba(212,175,55,0.03); padding:14px 18px; }
.stamp-icon { width:36px; height:36px; border-radius:50%; background:linear-gradient(145deg,#d4af37,#a07d10); display:flex; align-items:center; justify-content:center; font-size:18px; color:#fff; font-weight:bold; flex-shrink:0; }
.stamp-main { font-family:'Cinzel',serif; font-size:12px; color:#d4af37; font-weight:600; margin-bottom:3px; }
.stamp-sub { font-size:7.5px; color:#555; letter-spacing:2px; text-transform:uppercase; }
.v-footer { position:absolute; bottom:18px; right:24px; font-family:'Cinzel',serif; font-size:8px; color:rgba(212,175,55,0.12); letter-spacing:4px; text-transform:uppercase; }
</style>
</head>
<body>
<div class="page">
  <div class="red-bar"></div>
  <div class="inner">
    <div class="qr-side">
      <div class="qr-box"><img src="${qrDataURL}" alt="QR"></div>
      <div class="qr-scan">Scan to Verify</div>
      <div class="qr-url">${verificationUrl}</div>
      ${qaRows ? `<div class="qa-section"><div class="qa-title">Assessment</div>${qaRows}</div>` : ''}
    </div>
    <div class="detail-side">
      <div class="v-title">Verification</div>
      <div class="v-sub">Official Certificate Document</div>
      <div class="v-div"></div>
      <div class="v-row"><div class="v-lbl">Serial No</div><div class="v-val serial">${certificateId}</div></div>
      <div class="v-row"><div class="v-lbl">Name</div><div class="v-val gold">${employeeName}</div></div>
      <div class="v-row"><div class="v-lbl">Skill</div><div class="v-val">${skill}</div></div>
      <div class="v-row"><div class="v-lbl">Tier</div><div class="v-val" style="color:#d4af37">${tierLabel}</div></div>
      <div class="v-row"><div class="v-lbl">Issued On</div><div class="v-val">${formattedDate}</div></div>
      <div class="v-row"><div class="v-lbl">Issued By</div><div class="v-val">Nixvo · Powered by Editcraft</div></div>
      <div class="v-row"><div class="v-lbl">Status</div><div class="v-val green">✅  Valid &amp; Active</div></div>
      <div class="v-stamp">
        <div class="stamp-icon">✓</div>
        <div><div class="stamp-main">Verified by Nixvo</div><div class="stamp-sub">Skill Assessment Completed · Certificate Authentic</div></div>
      </div>
    </div>
  </div>
  <div class="v-footer">Nixvo · editcraft.co.in</div>
</div>
</body></html>`;
};

// ═══════════════════════════════════════════════════════════════
// PUPPETEER — screenshot HTML → PNG buffer
// ═══════════════════════════════════════════════════════════════

const screenshotPage = async (browser, html) => {
  const page = await browser.newPage();
  try {
    await page.setViewport({ width: 960, height: 679, deviceScaleFactor: 2 });
    await page.setContent(html, { waitUntil: 'networkidle0', timeout: 30000 });
    return await page.screenshot({ type: 'png', clip: { x: 0, y: 0, width: 960, height: 679 } });
  } finally {
    await page.close();
  }
};

// ═══════════════════════════════════════════════════════════════
// GENERATE CERTIFICATE + VERIFICATION PNGs
// ═══════════════════════════════════════════════════════════════

const generateCertificatePNGs = async (cert, qrDataURL) => {
  const {
    certificateId, tier, skill,
    metadata: { employeeName, bio, issuedAt },
    assessment, verificationUrl,
  } = cert;

  const formattedDate = new Date(issuedAt || Date.now())
    .toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' });

  const bgSrc  = getBase64Image(tier);
  const shared = { certificateId, tier, skill, employeeName, bio, formattedDate, verificationUrl, assessment, qrDataURL, bgSrc };

  const certHTML   = tier === 'pro' ? buildProHTML(shared) : buildBasicHTML(shared);
  const verifyHTML = buildVerificationHTML(shared);

  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
  });

  let certPNG, verifyPNG;
  try {
    console.log('   📸 Screenshotting certificate...');
    certPNG = await screenshotPage(browser, certHTML);
    console.log('   📸 Screenshotting verification...');
    verifyPNG = await screenshotPage(browser, verifyHTML);
  } finally {
    await browser.close();
  }

  return { certPNG, verifyPNG };
};

// ═══════════════════════════════════════════════════════════════
// UPLOAD TO R2
// ═══════════════════════════════════════════════════════════════

const uploadCertPNG   = (buf, id) => uploadToR2(buf, `certificates/png/${id}.png`,        'image/png');
const uploadVerifyPNG = (buf, id) => uploadToR2(buf, `certificates/verify/${id}.png`,     'image/png');
const uploadQR        = (buf, id) => uploadToR2(buf, `certificates/qr/${id}.png`,         'image/png');

// ═══════════════════════════════════════════════════════════════
// ISSUE CERTIFICATE
// ═══════════════════════════════════════════════════════════════

export const issueCertificate = async (certificateDoc) => {
  try {
    console.log(`\n🎓 Issuing: ${certificateDoc.certificateId} [${certificateDoc.tier.toUpperCase()}]`);
    const verificationUrl = `${VERIFY_BASE}/${certificateDoc.certificateId}`;

    console.log('   📱 Generating QR...');
    const [qrDataURL, qrBuffer] = await Promise.all([
      generateQRDataURL(verificationUrl),
      generateQRBuffer(verificationUrl),
    ]);

    console.log('   🖼️  Generating PNGs...');
    const certObj = { ...certificateDoc.toObject(), verificationUrl };
    const { certPNG, verifyPNG } = await generateCertificatePNGs(certObj, qrDataURL);

    console.log('   📤 Uploading to R2...');
    const [pngUrl, verifyPngUrl, qrCodeUrl] = await Promise.all([
      uploadCertPNG(certPNG,   certificateDoc.certificateId),
      uploadVerifyPNG(verifyPNG, certificateDoc.certificateId),
      uploadQR(qrBuffer,       certificateDoc.certificateId),
    ]);

    // Store certificate PNG as pdfUrl so existing controller/model fields stay intact
    certificateDoc.verificationUrl   = verificationUrl;
    certificateDoc.qrCodeUrl         = qrCodeUrl;
    certificateDoc.pdfUrl            = pngUrl;        // certificate PNG
    certificateDoc.verifyPngUrl      = verifyPngUrl;   // ← ADD THIS
    certificateDoc.status            = 'issued';
    certificateDoc.issuedAt          = new Date();
    certificateDoc.metadata.issuedAt = new Date();
    await certificateDoc.save();

    console.log(`   🎉 Done: ${certificateDoc.certificateId}\n`);
    return {
      success: true,
      certificateId:   certificateDoc.certificateId,
      verificationUrl,
      qrCodeUrl,
      pdfUrl:          pngUrl,       // certificate PNG (kept as pdfUrl for compat)
      verifyPngUrl,                  // verification PNG
    };

  } catch (err) {
    console.error('❌ issueCertificate error:', err.message);
    throw err;
  }
};

// ═══════════════════════════════════════════════════════════════
// CREATE + ISSUE (Editcraft premium — free)
// ═══════════════════════════════════════════════════════════════

export const createAndIssueCertificate = async ({
  userId, employeeId, tier, skill, metadata, assessment,
  proofImages = [], proofVideos = [],
}) => {
  const certificateId = await Certificate.generateSerialNumber(tier);
  const cert = new Certificate({
    certificateId, tier, userId, employeeId, skill,
    metadata, assessment, proofImages, proofVideos,
    payment: { paymentRequired: false, paid: true, amount: 0, paidAt: new Date() },
    status: 'draft',
  });
  await cert.save();
  return await issueCertificate(cert);
};

// ═══════════════════════════════════════════════════════════════
// CREATE DRAFT (payment required)
// ═══════════════════════════════════════════════════════════════

export const createDraftCertificate = async ({
  userId, employeeId, tier, skill, metadata, assessment,
  proofImages = [], proofVideos = [],
}) => {
  const certificateId = await Certificate.generateSerialNumber(tier);
  const amount        = Certificate.getPrice(tier);
  const cert = new Certificate({
    certificateId, tier, userId, employeeId, skill,
    metadata, assessment, proofImages, proofVideos,
    payment: { paymentRequired: true, paid: false, amount, currency: 'INR' },
    status: 'draft',
  });
  await cert.save();
  console.log(`📝 Draft: ${certificateId} ₹${amount}`);
  return cert;
};

// ═══════════════════════════════════════════════════════════════
// PAYMENT SUCCESS
// ═══════════════════════════════════════════════════════════════

export const handleCertificatePaymentSuccess = async ({
  certificateId, razorpayOrderId, razorpayPaymentId,
}) => {
  const cert = await Certificate.findOne({ certificateId });
  if (!cert)                    throw new Error(`Certificate not found: ${certificateId}`);
  if (cert.status === 'issued') return { success: true, alreadyIssued: true };

  cert.payment.paid              = true;
  cert.payment.razorpayOrderId   = razorpayOrderId;
  cert.payment.razorpayPaymentId = razorpayPaymentId;
  cert.payment.paidAt            = new Date();
  cert.status                    = 'payment_pending';
  await cert.save();

  return await issueCertificate(cert);
};