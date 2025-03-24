const dbConnect = require('./db/connect');
const getIpAddress = require('./helpers/getIp');
const formidable = require('formidable');
const fs = require('fs');
const path = require('path');
const { uploadToS3, getPublicUrl } = require('./utils/s3-upload');

// Create uploads directory if it doesn't exist (for temporary storage)
const uploadDir = path.join(process.cwd(), 'uploads', 'images');
try {
  if (!fs.existsSync(path.join(process.cwd(), 'uploads'))) {
    fs.mkdirSync(path.join(process.cwd(), 'uploads'));
  }
  if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir);
  }
} catch (err) {
  console.error('Error creating upload directory:', err);
}

module.exports = async (req, res) => {
  // Set CORS headers to allow requests from any origin
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

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const form = new formidable.IncomingForm();
  form.uploadDir = uploadDir;
  form.keepExtensions = true;
  form.maxFileSize = 10 * 1024 * 1024; // 10MB limit

  try {
    // Connect to the database
    try {
      await dbConnect();
      console.log('Connected to MongoDB in image upload handler');
    } catch (dbError) {
      console.error('Failed to connect to MongoDB:', dbError);
      // Continue even if DB connection fails
    }

    form.parse(req, async (err, fields, files) => {
      if (err) {
        console.error('Error parsing form:', err);
        return res.status(500).json({ error: 'Error processing upload' });
      }

      try {
        const imageFile = files.image;
        if (!imageFile) {
          return res.status(400).json({ error: 'No image file provided' });
        }

        // Generate filename with timestamp
        const timestamp = fields.timestamp || new Date().toISOString();
        const newFilename = `capture_${timestamp.replace(/:/g, '-')}.jpg`;
        
        // Upload to S3
        let fileUrl;
        try {
          // Read the temporary file
          const fileContent = fs.readFileSync(imageFile.filepath);
          
          // Upload to S3 - store in 'images' folder
          fileUrl = await uploadToS3(fileContent, newFilename, 'image/jpeg', 'images');
          
          console.log(`Image uploaded to S3: ${fileUrl}`);
          
          // Clean up temporary file
          fs.unlinkSync(imageFile.filepath);
        } catch (s3Error) {
          console.error('Error uploading to S3:', s3Error);
          return res.status(500).json({ error: 'Failed to upload image to S3' });
        }

        // Get IP address from request
        const ipAddress = getIpAddress(req);
        
        // Parse location data if provided
        let locationData = {};
        try {
          if (fields.location) {
            locationData = JSON.parse(fields.location);
          }
        } catch (locationError) {
          console.warn('Error parsing location data:', locationError);
        }
        
        // Parse network info if provided
        let networkInfo = fields.networkInfo || '';
        try {
          if (typeof networkInfo === 'string' && networkInfo.startsWith('{')) {
            networkInfo = JSON.parse(networkInfo);
          }
        } catch (networkError) {
          console.warn('Error parsing network info:', networkError);
        }
        
        // Parse device info if provided
        let deviceInfo = {};
        try {
          if (fields.deviceInfo) {
            deviceInfo = JSON.parse(fields.deviceInfo);
          }
        } catch (deviceError) {
          console.warn('Error parsing device info:', deviceError);
        }

        // Save metadata to database if connected
        if (global.db) {
          const Media = require('./models/Media');
          const mediaRecord = new Media({
            type: 'image',
            filename: newFilename,
            fileUrl: fileUrl, // Store S3 URL in database
            timestamp: timestamp,
            ipAddress: ipAddress,
            userAgent: req.headers['user-agent'],
            metadata: {
              location: locationData,
              networkInfo: networkInfo,
              deviceInfo: deviceInfo,
              browser: req.headers['user-agent'],
              referrer: req.headers['referer'] || '',
              storage: 's3' // Indicate storage type
            }
          });

          await mediaRecord.save();
          console.log('Image metadata saved to MongoDB');
        }

        return res.status(200).json({ 
          success: true,
          filename: newFilename,
          fileUrl: fileUrl
        });
      } catch (error) {
        console.error('Error saving image:', error);
        return res.status(500).json({ 
          error: 'Failed to save image',
          details: error.message
        });
      }
    });
  } catch (error) {
    console.error('Image upload API error:', error);
    return res.status(500).json({ 
      error: 'Server error', 
      details: error.message
    });
  }
}; 