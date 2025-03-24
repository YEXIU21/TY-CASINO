const { parse } = require('url');
const connectToDatabase = require('./db/connect');

module.exports = async (req, res) => {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const { pathname } = parse(req.url, true);
  const path = pathname.split('/').pop();

  try {
    // Handle different endpoints
    switch (path) {
      case 'db-test':
        return await handleDbTest(req, res);
      
      case 'test':
        return await handleTest(req, res);
      
      default:
        return res.status(404).json({ error: 'Endpoint not found' });
    }
  } catch (error) {
    console.error('API Error:', error);
    return res.status(500).json({ error: 'Internal Server Error', details: error.message });
  }
};

// Test database connection
async function handleDbTest(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Test database connection
    const dbClient = await connectToDatabase();
    
    // Check if connection is successful
    if (dbClient.connection.readyState === 1) {
      return res.status(200).json({
        success: true,
        message: 'Database connection successful',
        databaseName: dbClient.connection.name,
        connectionState: 'Connected',
        models: Object.keys(dbClient.models),
        mongoVersion: dbClient.connection.version,
        host: dbClient.connection.host,
        timestamp: new Date().toISOString()
      });
    } else {
      const states = ['Disconnected', 'Connected', 'Connecting', 'Disconnecting'];
      return res.status(500).json({
        success: false,
        message: 'Database not connected',
        connectionState: states[dbClient.connection.readyState] || 'Unknown',
        timestamp: new Date().toISOString()
      });
    }
  } catch (error) {
    console.error('Database connection test error:', error);
    return res.status(500).json({
      success: false,
      message: 'Database connection failed',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
}

// Simple API test endpoint
async function handleTest(req, res) {
  return res.status(200).json({
    success: true,
    message: 'API is working',
    timestamp: new Date().toISOString(),
    version: '1.0.0',
    environment: process.env.NODE_ENV || 'development',
    headers: req.headers,
    method: req.method,
    url: req.url
  });
} 