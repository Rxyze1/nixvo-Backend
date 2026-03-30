import mongoose from 'mongoose'
import dotenv from 'dotenv'

dotenv.config()

async function dropMobileIndex() {
  try {
    console.log('🔧 Connecting to MongoDB...\n')
    
    await mongoose.connect(process.env.MONGO_URL)
    
    const db = mongoose.connection.db
    const collection = db.collection('users')
    
    console.log('📊 Current indexes:')
    const indexes = await collection.indexes()
    indexes.forEach(idx => console.log('   -', idx.name))
    console.log('')
    
    // Try to drop the index
    try {
      await collection.dropIndex('mobile_number_1')
      console.log('✅ Successfully dropped mobile_number_1 index\n')
    } catch (err) {
      if (err.code === 27) {
        console.log('ℹ️  Index does not exist\n')
      } else {
        console.log('⚠️  Could not drop index:', err.message, '\n')
      }
    }
    
    // Clean up documents
    console.log('🧹 Cleaning documents...')
    const result = await collection.updateMany(
      {},
      { $unset: { mobile_number: "" } }
    )
    console.log(`✅ Cleaned ${result.modifiedCount} documents\n`)
    
    // Verify
    console.log('📊 Final indexes:')
    const finalIndexes = await collection.indexes()
    finalIndexes.forEach(idx => console.log('   -', idx.name))
    
    console.log('\n✅ Done!')
    process.exit(0)
    
  } catch (error) {
    console.error('❌ Error:', error.message)
    process.exit(1)
  }
}

dropMobileIndex()