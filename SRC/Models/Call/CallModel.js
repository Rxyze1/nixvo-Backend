import mongoose from 'mongoose';
import { v4 as uuidv4 } from 'uuid';
import { backupDocument } from '../../Service/Backup-DB/backupService.js';

const callSchema = new mongoose.Schema(
  {
    callId: {
      type:     String,
      required: true,
      unique:   true,
      default:  () => uuidv4(),
      index:    true,
    },
    caller: {
      type:     mongoose.Schema.Types.ObjectId,
      ref:      'User',
      required: true,
    },
    receiver: {
      type:     mongoose.Schema.Types.ObjectId,
      ref:      'User',
      required: true,
    },
    callType: {
      type:     String,
      enum:     ['audio', 'video'],
      required: true,
    },
    status: {
      type:    String,
      enum:    ['initiated', 'ringing', 'active', 'ended', 'missed', 'rejected', 'busy', 'failed'],
      default: 'initiated',
    },
    startTime: { type: Date, default: null },   // when receiver accepted
    endTime:   { type: Date, default: null },
    duration:  { type: Number, default: 0 },    // seconds
    endedBy: {
      type:    mongoose.Schema.Types.ObjectId,
      ref:     'User',
      default: null,
    },
    escrowId: {
      type:    mongoose.Schema.Types.ObjectId,
      ref:     'Escrow',
      default: null,
    },
  },
  { timestamps: true }
);

callSchema.index({ caller:   1, createdAt: -1 });
callSchema.index({ receiver: 1, createdAt: -1 });
callSchema.index({ escrowId: 1 });
callSchema.index({ status:   1 });
// ─────────────────────────────────────────────────────────────
// BACKUP HOOKS
// ─────────────────────────────────────────────────────────────

callSchema.pre('save', function () {
  this._wasNew = this.isNew;
});

callSchema.post('save', async function () {
  try {
    await backupDocument('calls', this._wasNew ? 'create' : 'update', this);
  } catch (err) {
    console.error('⚠️ [BACKUP] post.save failed (calls):', err.message);
  }
});

callSchema.post('findOneAndDelete', async function (doc) {
  if (!doc) return;
  try {
    await backupDocument('calls', 'delete', doc);
  } catch (err) {
    console.error('⚠️ [BACKUP] post.findOneAndDelete failed (calls):', err.message);
  }
});

callSchema.post('deleteOne', { document: true, query: false }, async function () {
  try {
    await backupDocument('calls', 'delete', this);
  } catch (err) {
    console.error('⚠️ [BACKUP] post.deleteOne failed (calls):', err.message);
  }
});

callSchema.post('findOneAndUpdate', async function (doc) {
  if (!doc) return;
  try {
    await backupDocument('calls', 'update', doc);
  } catch (err) {
    console.error('⚠️ [BACKUP] post.findOneAndUpdate failed (calls):', err.message);
  }
});


const Call = mongoose.models.Call || mongoose.model('Call', callSchema);
export default Call;