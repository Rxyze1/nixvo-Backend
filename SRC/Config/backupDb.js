import mongoose from 'mongoose';

const backupConnection = mongoose.createConnection(
  process.env.MONGO_BACKUP_URL,
  { maxPoolSize: 5 }
);

backupConnection.on('connected', () => console.log('✅ Backup DB connected'));
backupConnection.on('error', (err) => console.error('❌ Backup DB error:', err.message));

export default backupConnection;