// routes/TestImageRoute.js

import express from 'express';
import { 
  uploadTestImages,  // ✅ NEW: Supports both single & multiple
  handleUploadError 
} from '../Middleware/uploadMiddleware.js';
import {
  testValidation,
  getAllTests,
  getTestById,
  deleteTest,
  deleteAllTests,
  getStats
} from '../Controller/testValidationController.js';

const Testrouter = express.Router();

// ✅ Test validation - supports both single & multiple images
Testrouter.post('/validate', uploadTestImages, handleUploadError, testValidation);

Testrouter.get('/tests', getAllTests);
Testrouter.get('/tests/:id', getTestById);
Testrouter.delete('/tests/:id', deleteTest);
Testrouter.delete('/tests', deleteAllTests);
Testrouter.get('/stats', getStats);

Testrouter.get('/health', (req, res) => {
  res.json({
    success: true,
    message: 'Test validation system is healthy',
    maxImages: 5
  });
});

export default Testrouter;