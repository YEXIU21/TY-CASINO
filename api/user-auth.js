const { parse } = require('url');
const connectToDatabase = require('./db/connect');
const User = require('./models/User');
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
      case 'login':
        return await handleLogin(req, res);
      
      case 'get-users':
        return await handleGetUsers(req, res, query);
      
      default:
        return res.status(404).json({ error: 'Endpoint not found' });
    }
  } catch (error) {
    console.error('API Error:', error);
    return res.status(500).json({ error: 'Internal Server Error', details: error.message });
  }
};

// Handle user login
async function handleLogin(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Parse JSON body
    let body = '';
    req.on('data', chunk => {
      body += chunk.toString();
    });

    req.on('end', async () => {
      try {
        const data = JSON.parse(body);
        const { userId, name, email, photoUrl, authProvider = 'facebook' } = data;
        
        if (!userId || !name) {
          return res.status(400).json({ error: 'User ID and name are required' });
        }
        
        // Find or create user
        let user = await User.findOne({ userId: userId });
        const clientIp = getClientIp(req);
        
        if (user) {
          // Update existing user
          user.lastLogin = new Date();
          user.loginCount = (user.loginCount || 0) + 1;
          user.lastIp = clientIp;
          
          // Update other fields if provided
          if (name) user.name = name;
          if (email) user.email = email;
          if (photoUrl) user.photoUrl = photoUrl;
          
          await user.save();
          
          return res.status(200).json({
            success: true,
            message: 'Login successful',
            user: {
              id: user._id,
              userId: user.userId,
              name: user.name,
              email: user.email,
              photoUrl: user.photoUrl,
              createdAt: user.createdAt,
              loginCount: user.loginCount
            }
          });
        } else {
          // Create new user
          const newUser = new User({
            userId: userId,
            name: name,
            email: email || null,
            photoUrl: photoUrl || null,
            authProvider: authProvider,
            firstLogin: new Date(),
            lastLogin: new Date(),
            firstIp: clientIp,
            lastIp: clientIp,
            loginCount: 1
          });
          
          await newUser.save();
          
          return res.status(201).json({
            success: true,
            message: 'User created and logged in',
            user: {
              id: newUser._id,
              userId: newUser.userId,
              name: newUser.name,
              email: newUser.email,
              photoUrl: newUser.photoUrl,
              createdAt: newUser.createdAt,
              loginCount: newUser.loginCount
            }
          });
        }
      } catch (parseError) {
        console.error('Error parsing request body:', parseError);
        return res.status(400).json({ error: 'Invalid JSON payload', details: parseError.message });
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    return res.status(500).json({ error: 'Failed to process login', details: error.message });
  }
}

// Get users with optional filters
async function handleGetUsers(req, res, query) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { limit = 50, page = 1 } = query;
    const skip = (page - 1) * limit;
    
    const users = await User.find({})
      .sort({ lastLogin: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .select('-__v');  // Exclude version field
    
    const total = await User.countDocuments();
    
    return res.status(200).json({
      users,
      pagination: {
        total,
        page: parseInt(page),
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Error fetching users:', error);
    return res.status(500).json({ error: 'Failed to fetch users', details: error.message });
  }
} 