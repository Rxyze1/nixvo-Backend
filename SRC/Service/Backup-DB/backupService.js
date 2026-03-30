// Service/Backup-DB/backupService.js
import backupConnection from '../../Config/backupDb.js';
import mongoose         from 'mongoose';

// ─── Model Cache (avoids re-registering same model) ───────────
const modelCache = {};

const getBackupModel = (collectionName) => {
  if (modelCache[collectionName]) return modelCache[collectionName];

  const schema = new mongoose.Schema(
    {
      _originalId: { type: mongoose.Schema.Types.ObjectId, index: true },
      _operation:  { type: String, enum: ['create', 'update', 'delete'] },
      _backedUpAt: { type: Date, default: Date.now, index: true },
    },
    {
      strict:     false, // ✅ captures ALL fields from original document
      timestamps: true,
    }
  );

  // Third argument forces exact collection name in backup DB
  const model = backupConnection.model(collectionName, schema, collectionName);
  modelCache[collectionName] = model;
  return model;
};

// ─── Main Backup Function ─────────────────────────────────────
export const backupDocument = async (collection, operation, doc) => {
  try {
    const BackupModel = getBackupModel(collection);

    // Get plain object (handles both mongoose doc and lean object)
    const plainDoc = doc.toObject ? doc.toObject() : { ...doc };

    // Destructure _id out so backup gets its own fresh _id
    const { _id, ...rest } = plainDoc;

    await BackupModel.create({
      ...rest,            // ✅ ALL original fields stored flat — visible directly in Compass
      _originalId: _id,   // original document's _id stored separately
      _operation:  operation,
      _backedUpAt: new Date(),
    });

  } catch (error) {
    // NEVER block main operation
    console.error(`⚠️ Backup failed [${collection}/${operation}]:`, error.message);
  }
};

export default getBackupModel;