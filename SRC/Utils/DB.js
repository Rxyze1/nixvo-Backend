import mongoose from "mongoose"
import dotenv from "dotenv"
import dns from 'dns'

dns.setServers(['8.8.8.8', '8.8.4.4']);

dotenv.config()

const MONGO_URL = process.env.MONGO_URL

if (!MONGO_URL) {
  console.error("❌ MONGO_URL is not provided in .env file")
  process.exit(1)
}

/**
 * Connect to MongoDB
 */
export const connectDb = async () => {
  try {
    // Mongoose settings
    mongoose.set("strictQuery", true)
    
    // Connection options
    const options = {
      autoIndex: true,              // ✅ CHANGED: Enable auto-indexing (important for development)
      maxPoolSize: 10,               // Connection pool size
      serverSelectionTimeoutMS: 5000, // Timeout after 5s
      socketTimeoutMS: 45000,        // Close sockets after 45s of inactivity
      family: 4                      // Use IPv4, skip trying IPv6
    }
    
    // Connect
    await mongoose.connect(MONGO_URL, options)
    
    console.log("✅ MongoDB connected successfully")
    console.log(`📊 Database: ${mongoose.connection.name}`)
    console.log(`🌐 Host: ${mongoose.connection.host}`)
    
    // Log connection events
    mongoose.connection.on('connected', () => {
      console.log('🟢 Mongoose connected to DB')
    })
    
    mongoose.connection.on('error', (err) => {
      console.error('🔴 Mongoose connection error:', err)
    })
    
    mongoose.connection.on('disconnected', () => {
      console.log('🟠 Mongoose disconnected')
    })
    
  } catch (error) {
    console.error("❌ MongoDB connection failed:", error.message)
    process.exit(1)
  }
}

/**
 * Graceful shutdown
 */
const shutdown = async (signal) => {
  console.log(`\n🛑 Received ${signal}. Closing MongoDB connection...`)
  
  try {
    await mongoose.connection.close()
    console.log("🔒 MongoDB connection closed gracefully")
    process.exit(0)
  } catch (error) {
    console.error("❌ Error during MongoDB shutdown:", error.message)
    process.exit(1)
  }
}

// Handle OS signals
process.on("SIGINT", () => shutdown("SIGINT"))
process.on("SIGTERM", () => shutdown("SIGTERM"))

// Handle uncaught errors
process.on("unhandledRejection", (err) => {
  console.error("❌ Unhandled Promise Rejection:", err)
  shutdown("UNHANDLED_REJECTION")
})

export default connectDb