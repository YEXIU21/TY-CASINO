const mongoose = require('mongoose');

// MongoDB connection string
// Expected format: mongodb+srv://username:password@cluster.example.mongodb.net/database
let MONGODB_URI = process.env.MONGODB_URI;

// Fallback connection string if environment variable isn't set
const MONGODB_URI_FALLBACK = "mongodb+srv://Tycasino:Tycasino123@cluster0.px4v3.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0";

if (!MONGODB_URI) {
  console.warn('MONGODB_URI environment variable is not defined, using fallback');
  MONGODB_URI = MONGODB_URI_FALLBACK;
}

console.log(`MongoDB URI ${MONGODB_URI ? 'is' : 'is NOT'} defined (length: ${MONGODB_URI?.length || 0})`);

let cached = global.mongoose;

if (!cached) {
  cached = global.mongoose = { conn: null, promise: null };
}

async function dbConnect() {
  if (cached.conn) {
    console.log('Using existing MongoDB connection');
    return cached.conn;
  }

  if (!cached.promise) {
    const opts = {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      serverSelectionTimeoutMS: 10000, // Timeout after 10s
      connectTimeoutMS: 15000, // Timeout after 15s
      heartbeatFrequencyMS: 30000, // Check server every 30s
      retryWrites: true,
      w: 'majority', // Write to primary and at least one secondary
    };

    console.log('Initiating new MongoDB connection...');

    cached.promise = mongoose.connect(MONGODB_URI, opts)
      .then(mongoose => {
        console.log('✅ Connected to MongoDB successfully');
        return mongoose;
      })
      .catch(err => {
        console.error('❌ MongoDB connection error:', err);
        
        // Try connecting with the fallback URL if the primary one fails
        if (MONGODB_URI !== MONGODB_URI_FALLBACK) {
          console.log('Attempting connection with fallback URL...');
          return mongoose.connect(MONGODB_URI_FALLBACK, opts)
            .then(mongoose => {
              console.log('✅ Connected to MongoDB using fallback URL');
              return mongoose;
            })
            .catch(fallbackErr => {
              console.error('❌ Fallback MongoDB connection also failed:', fallbackErr);
              throw fallbackErr;
            });
        }
        
        throw err;
      });
  } else {
    console.log('Using existing MongoDB connection promise');
  }
  
  try {
    console.log('Awaiting MongoDB connection...');
    cached.conn = await cached.promise;
    console.log('MongoDB connection established');
    // Set global db for use in other files
    global.db = mongoose.connection;
    return cached.conn;
  } catch (error) {
    console.error('Failed to establish MongoDB connection:', error);
    throw error;
  }
}

module.exports = dbConnect; 