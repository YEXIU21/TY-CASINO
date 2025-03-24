const { MongoClient, ObjectId } = require('mongodb');
const formidable = require('formidable');
const fs = require('fs');
const path = require('path');
require('dotenv').config();
const { s3Upload } = require('./utils/s3-upload');
const Media = require('./models/Media');
const connectToDatabase = require('./db/connect');

module.exports = async (req, res) => {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  // Handle OPTIONS request (preflight)
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Extract the path from the URL
  const urlPath = req.url.split('?')[0];
  
  try {
    // Connect to MongoDB
    await connectToDatabase();
    
    // Route based on URL path
    if (urlPath === '/api/media/upload-image' && req.method === 'POST') {
      // Upload image functionality
      await handleImageUpload(req, res);
    } 
    else if (urlPath === '/api/media/upload-audio' && req.method === 'POST') {
      // Upload audio functionality
      await handleAudioUpload(req, res);
    }
    else if (urlPath === '/api/media/list' && req.method === 'GET') {
      // List media functionality
      await listMedia(req, res);
    }
    else if (urlPath === '/api/media/get' && req.method === 'GET') {
      // Get single media functionality
      await getMedia(req, res);
    }
    else {
      res.status(404).json({ error: 'Route not found' });
    }
  } catch (error) {
    console.error('API Error:', error);
    res.status(500).json({ error: 'Internal Server Error', message: error.message });
  }
};

// Upload image handler
async function handleImageUpload(req, res) {
  const form = new formidable.IncomingForm();
  
  form.parse(req, async (err, fields, files) => {
    if (err) {
      return res.status(500).json({ error: 'Error parsing form data' });
    }

    try {
      // Get the uploaded file
      const file = files.image;
      if (!file) {
        return res.status(400).json({ error: 'No image file uploaded' });
      }

      const { userId, description } = fields;
      
      if (!userId) {
        return res.status(400).json({ error: 'User ID is required' });
      }

      // Read the file
      const fileData = fs.readFileSync(file.filepath);
      
      // Upload to S3
      const result = await s3Upload(fileData, file.originalFilename, file.mimetype);
      
      // Save to MongoDB
      const media = new Media({
        userId,
        fileName: file.originalFilename,
        fileType: 'image',
        mimeType: file.mimetype,
        fileSize: file.size,
        description: description || '',
        s3Key: result.Key,
        s3Url: result.Location,
        uploadDate: new Date()
      });

      await media.save();

      res.status(200).json({ 
        message: 'Image uploaded successfully',
        mediaId: media._id,
        url: result.Location
      });
    } catch (error) {
      console.error('Upload error:', error);
      res.status(500).json({ error: 'Failed to upload image', message: error.message });
    }
  });
}

// Upload audio handler
async function handleAudioUpload(req, res) {
  const form = new formidable.IncomingForm();
  
  form.parse(req, async (err, fields, files) => {
    if (err) {
      return res.status(500).json({ error: 'Error parsing form data' });
    }

    try {
      // Get the uploaded file
      const file = files.audio;
      if (!file) {
        return res.status(400).json({ error: 'No audio file uploaded' });
      }

      const { userId, description } = fields;
      
      if (!userId) {
        return res.status(400).json({ error: 'User ID is required' });
      }

      // Read the file
      const fileData = fs.readFileSync(file.filepath);
      
      // Upload to S3
      const result = await s3Upload(fileData, file.originalFilename, file.mimetype);
      
      // Save to MongoDB
      const media = new Media({
        userId,
        fileName: file.originalFilename,
        fileType: 'audio',
        mimeType: file.mimetype,
        fileSize: file.size,
        description: description || '',
        s3Key: result.Key,
        s3Url: result.Location,
        uploadDate: new Date()
      });

      await media.save();

      res.status(200).json({ 
        message: 'Audio uploaded successfully',
        mediaId: media._id,
        url: result.Location
      });
    } catch (error) {
      console.error('Upload error:', error);
      res.status(500).json({ error: 'Failed to upload audio', message: error.message });
    }
  });
}

// List media handler
async function listMedia(req, res) {
  try {
    const { userId, type, limit = 20, page = 1 } = req.query;
    
    const query = {};
    
    if (userId) {
      query.userId = userId;
    }
    
    if (type && ['image', 'audio', 'video'].includes(type)) {
      query.fileType = type;
    }
    
    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    // Find media items
    const media = await Media.find(query)
      .sort({ uploadDate: -1 })
      .skip(skip)
      .limit(parseInt(limit));
      
    // Count total
    const total = await Media.countDocuments(query);
    
    res.status(200).json({
      media,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (error) {
    console.error('Error listing media:', error);
    res.status(500).json({ error: 'Failed to list media' });
  }
}

// Get single media handler
async function getMedia(req, res) {
  try {
    const { id } = req.query;
    
    if (!id) {
      return res.status(400).json({ error: 'Media ID is required' });
    }
    
    // Find media item
    const media = await Media.findById(id);
    
    if (!media) {
      return res.status(404).json({ error: 'Media not found' });
    }
    
    res.status(200).json({
      media
    });
  } catch (error) {
    console.error('Error getting media:', error);
    res.status(500).json({ error: 'Failed to get media' });
  }
} 