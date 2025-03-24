// Endpoint to test MongoDB connectivity
const dbConnect = require('./db/connect');

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  // Handle preflight request
  if (req.method === 'OPTIONS') {
    return res.status(200).json({ success: true });
  }

  try {
    // Print the MongoDB URI (with sensitive parts masked)
    const mongoUri = process.env.MONGODB_URI || 'Not defined';
    const maskedUri = mongoUri.replace(/(mongodb\+srv:\/\/)([^:]+):([^@]+)@/, '$1$2:****@');
    console.log('Attempting to connect to MongoDB with URI:', maskedUri);

    // Try to connect to the database
    const connection = await dbConnect();
    
    // If we get here, connection was successful
    return res.status(200).json({
      success: true,
      message: 'Successfully connected to MongoDB!',
      mongoConnected: true,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('MongoDB connection failed:', error);
    
    return res.status(200).json({
      success: false,
      message: 'Failed to connect to MongoDB',
      error: error.message,
      mongoUri: process.env.MONGODB_URI ? 'Defined' : 'Not defined',
      timestamp: new Date().toISOString()
    });
  }
}; 