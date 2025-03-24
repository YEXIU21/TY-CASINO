const dbConnect = require('./db/connect');
const Media = require('./models/Media');

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

  // Get media type filter from query parameters
  const mediaType = req.query.type; // 'image' or 'audio'
  
  try {
    // Connect to database
    await dbConnect();
    console.log('Connected to MongoDB in get-media handler');
    
    // Build query
    const query = {};
    if (mediaType) {
      query.type = mediaType;
    }
    
    // Get media records
    const mediaRecords = await Media.find(query).sort({ timestamp: -1 }).limit(100);
    
    return res.status(200).json({
      success: true,
      media: mediaRecords
    });
  } catch (error) {
    console.error('Get media API error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to retrieve media records'
    });
  }
}; 