// models/TestPost.js

import mongoose from 'mongoose';

const testPostSchema = new mongoose.Schema({
  
  // Test identifier (optional)
  testName: {
    type: String,
    default: 'Anonymous Test'
  },
  
  // Content
  title: {
    type: String,
    required: true,
    maxLength: 200
  },
  
  description: {
    type: String,
    required: true,
    maxLength: 5000
  },
  
  // Image
  imageUrl: {
    type: String,
    default: null
  },
  
  // Validation results
  validationResults: {
    
    // Title validation
    title: {
      action: String,
      confidence: Number,
      violations: [String],
      reason: String,
      checkedAt: Date
    },
    
    // Description validation
    description: {
      action: String,
      confidence: Number,
      violations: [String],
      reason: String,
      checkedAt: Date
    },
    
    // Image validation
    image: {
      action: String,
      confidence: Number,
      violations: [String],
      reason: String,
      extractedText: String,
      checkedBy: [String],
      scanTime: String,
      checkedAt: Date
    }
  },
  
  // Overall status
  status: {
    type: String,
    enum: ['approved', 'rejected', 'flagged'],
    default: 'approved'
  },
  
  // Client info (for tracking during tests)
  clientInfo: {
    ip: String,
    userAgent: String
  }
  
}, {
  timestamps: true
});

// Indexes
testPostSchema.index({ status: 1 });
testPostSchema.index({ createdAt: -1 });

const TestPost = mongoose.model('TestPost', testPostSchema);

export default TestPost;