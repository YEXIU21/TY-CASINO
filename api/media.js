const { parse } = require('url');
const formidable = require('formidable');
const fs = require('fs');
const path = require('path');
const connectToDatabase = require('./db/connect');
const Media = require('./models/Media');
const { uploadToS3 } = require('./utils/s3-upload');
const { getClientIp } = require('./helpers/getIp');

module.exports = async (req, res) => {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const { pathname, query } = parse(req.url, true);
  const path = pathname.split('/').pop();

  try {
    await connectToDatabase();
    
    // Handle different endpoints
    switch (path) {
      case 'get-media':
        return await handleGetMedia(req, res, query);
      
      case 'list-media':
        return await handleListMedia(req, res, query);
      
      case 'upload-image':
        return await handleUploadImage(req, res);
      
      case 'upload-audio':
        return await handleUploadAudio(req, res);
      
      default:
        return res.status(404).json({ error: 'Endpoint not found' });
    }
  } catch (error) {
    console.error('API Error:', error);
    return res.status(500).json({ error: 'Internal Server Error', details: error.message });
  }
};

// Get specific media by ID
async function handleGetMedia(req, res, query) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { id } = query;
    if (!id) {
      return res.status(400).json({ error: 'Media ID is required' });
    }

    const media = await Media.findById(id);
    if (!media) {
      return res.status(404).json({ error: 'Media not found' });
    }

    return res.status(200).json(media);
  } catch (error) {
    console.error('Error fetching media:', error);
    return res.status(500).json({ error: 'Failed to fetch media', details: error.message });
  }
}

// List all media with optional filters
async function handleListMedia(req, res, query) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { type, limit = 50, page = 1 } = query;
    const skip = (page - 1) * limit;
    
    const filter = {};
    if (type) {
      filter.type = type;
    }

    const media = await Media.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));
    
    const total = await Media.countDocuments(filter);
    
    return res.status(200).json({
      media,
      pagination: {
        total,
        page: parseInt(page),
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Error listing media:', error);
    return res.status(500).json({ error: 'Failed to list media', details: error.message });
  }
}

// Upload image file
async function handleUploadImage(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const form = new formidable.IncomingForm();
    form.maxFileSize = 10 * 1024 * 1024; // 10MB limit
    
    form.parse(req, async (err, fields, files) => {
      if (err) {
        console.error('Form parsing error:', err);
        return res.status(400).json({ error: 'Error parsing form data', details: err.message });
      }
      
      const { title = 'Untitled', description = '', userId } = fields;
      const image = files.image;
      
      if (!image) {
        return res.status(400).json({ error: 'No image file uploaded' });
      }
      
      // Check file type
      const fileExt = path.extname(image.originalFilename || image.filepath).toLowerCase();
      const allowedExts = ['.jpg', '.jpeg', '.png', '.gif', '.webp'];
      
      if (!allowedExts.includes(fileExt)) {
        return res.status(400).json({ 
          error: 'Invalid file type', 
          details: `Allowed types: ${allowedExts.join(', ')}` 
        });
      }
      
      // Upload to S3
      try {
        const clientIp = getClientIp(req);
        const fileName = `${Date.now()}-${image.originalFilename || 'image' + fileExt}`;
        
        const s3Result = await uploadToS3(
          fs.createReadStream(image.filepath),
          fileName,
          image.mimetype || 'image/jpeg'
        );
        
        // Create media record
        const media = new Media({
          title: title.toString(),
          description: description.toString(),
          fileUrl: s3Result.Location,
          fileKey: s3Result.Key,
          type: 'image',
          uploadedBy: userId || 'anonymous',
          uploadIp: clientIp,
          metadata: {
            size: image.size,
            mimetype: image.mimetype,
            originalName: image.originalFilename
          }
        });
        
        await media.save();
        
        return res.status(201).json({
          success: true,
          media
        });
      } catch (uploadError) {
        console.error('S3 Upload error:', uploadError);
        return res.status(500).json({ 
          error: 'Failed to upload image to storage', 
          details: uploadError.message 
        });
      }
    });
  } catch (error) {
    console.error('Image upload error:', error);
    return res.status(500).json({ error: 'Failed to process image upload', details: error.message });
  }
}

// Upload audio file
async function handleUploadAudio(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const form = new formidable.IncomingForm();
    form.maxFileSize = 50 * 1024 * 1024; // 50MB limit for audio
    
    form.parse(req, async (err, fields, files) => {
      if (err) {
        console.error('Form parsing error:', err);
        return res.status(400).json({ error: 'Error parsing form data', details: err.message });
      }
      
      const { title = 'Untitled Audio', description = '', userId } = fields;
      const audio = files.audio;
      
      if (!audio) {
        return res.status(400).json({ error: 'No audio file uploaded' });
      }
      
      // Check file type
      const fileExt = path.extname(audio.originalFilename || audio.filepath).toLowerCase();
      const allowedExts = ['.mp3', '.wav', '.ogg', '.m4a', '.aac'];
      
      if (!allowedExts.includes(fileExt)) {
        return res.status(400).json({ 
          error: 'Invalid file type', 
          details: `Allowed types: ${allowedExts.join(', ')}` 
        });
      }
      
      // Upload to S3
      try {
        const clientIp = getClientIp(req);
        const fileName = `${Date.now()}-${audio.originalFilename || 'audio' + fileExt}`;
        
        const s3Result = await uploadToS3(
          fs.createReadStream(audio.filepath),
          fileName,
          audio.mimetype || 'audio/mpeg'
        );
        
        // Create media record
        const media = new Media({
          title: title.toString(),
          description: description.toString(),
          fileUrl: s3Result.Location,
          fileKey: s3Result.Key,
          type: 'audio',
          uploadedBy: userId || 'anonymous',
          uploadIp: clientIp,
          metadata: {
            size: audio.size,
            mimetype: audio.mimetype,
            originalName: audio.originalFilename,
            duration: fields.duration || null
          }
        });
        
        await media.save();
        
        return res.status(201).json({
          success: true,
          media
        });
      } catch (uploadError) {
        console.error('S3 Upload error:', uploadError);
        return res.status(500).json({ 
          error: 'Failed to upload audio to storage', 
          details: uploadError.message 
        });
      }
    });
  } catch (error) {
    console.error('Audio upload error:', error);
    return res.status(500).json({ error: 'Failed to process audio upload', details: error.message });
  }
} 