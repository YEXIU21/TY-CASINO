const dbConnect = require('./db/connect');
const User = require('./models/User');

module.exports = async (req, res) => {
  // Set CORS headers to allow requests from any origin
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  // Handle preflight request
  if (req.method === 'OPTIONS') {
    return res.status(200).json({ success: true });
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }

  try {
    // Connect to database
    await dbConnect();
    console.log('Connected to MongoDB in get-users handler');
    
    // Get user records (most recent first)
    const users = await User.find({}).sort({ createdAt: -1 }).limit(100);
    
    return res.status(200).json({
      success: true,
      users: users
    });
  } catch (error) {
    console.error('Get users API error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to retrieve user records'
    });
  }
}; 