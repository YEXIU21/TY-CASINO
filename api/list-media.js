const dbConnect = require('./db/connect');
const Media = require('./models/Media');
const { listS3Files, getPublicUrl } = require('./utils/s3-upload');

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
  const useS3Direct = req.query.s3 === 'true'; // Whether to get file list directly from S3
  
  try {
    if (useS3Direct) {
      // List files directly from S3
      const folder = mediaType === 'audio' ? 'audio' : mediaType === 'image' ? 'images' : '';
      const files = await listS3Files(folder);
      
      // Format the response
      const mediaFiles = files.map(file => {
        const key = file.Key;
        const filename = key.split('/').pop();
        const isImage = key.includes('/images/');
        const isAudio = key.includes('/audio/');
        
        return {
          filename,
          type: isImage ? 'image' : isAudio ? 'audio' : 'unknown',
          fileUrl: getPublicUrl(filename, isImage ? 'images' : isAudio ? 'audio' : ''),
          size: file.Size,
          lastModified: file.LastModified
        };
      });
      
      return res.status(200).json({
        success: true,
        source: 's3',
        media: mediaFiles
      });
    } else {
      // Get records from MongoDB
      // Connect to database
      await dbConnect();
      console.log('Connected to MongoDB in list-media handler');
      
      // Build query
      const query = {};
      if (mediaType) {
        query.type = mediaType;
      }
      
      // Get media records
      const mediaRecords = await Media.find(query).sort({ timestamp: -1 }).limit(100);
      
      return res.status(200).json({
        success: true,
        source: 'mongodb',
        media: mediaRecords
      });
    }
  } catch (error) {
    console.error('List media API error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to retrieve media records',
      details: error.message
    });
  }
}; 