// Models/Call/CallMessage.js
import mongoose from 'mongoose';

const callMessageSchema = new mongoose.Schema(
  {
    callId: {
  type: String,       // UUID from Call.callId — not an ObjectId ref
  required: true,
  unique: true,
  index: true,
},

    caller: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    receiver: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    callType: {
      type: String,
      enum: ['audio', 'video'],
      default: 'audio',
    },
   status: {
  type: String,
  enum: ['initiated', 'ringing', 'active', 'ended', 'rejected', 'missed', 'busy', 'failed'],
  default: 'initiated', // ← match Call.js default
  index: true,
},
    startTime: Date,
    endTime: Date,
    duration: {
      type: Number,
      default: 0,
    },
    endedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    rejectedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    missedAt: Date,
    failureReason: String,
    messageText: {
      type: String,
      default: '',
    },
  },
  { timestamps: true }
);

callMessageSchema.index({ caller:   1, createdAt: -1 });
callMessageSchema.index({ receiver: 1, createdAt: -1 });

const CallMessage = mongoose.models.CallMessage || mongoose.model('CallMessage', callMessageSchema);
export default CallMessage;