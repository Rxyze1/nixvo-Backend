// routes/updateRoutes.js (or add this to your main server file)
import express from 'express';
const router = express.Router();

router.get('/app/version', (req, res) => {
  // ✅ CHANGE THIS when you release your new update!
  const APP_CONFIG = {
    latestVersion: "1.0.0",       // The new version you just built
    minSupportedVersion: "1.0.0", // The absolute minimum allowed
    updateUrl: "https://yourwebsite.com/downloads/nixvo-latest.apk", // Your download link
    forceUpdate: false,           // Set to TRUE to lock the app
    updateMessage: "Minor bug fixes and performance improvements."
  };

  res.status(200).json({
    success: true,
    data: APP_CONFIG
  });
});

export default router;