function getIpAddress(req) {
  let ip = req.headers['x-forwarded-for'] || 
           req.headers['x-real-ip'] ||
           req.connection.remoteAddress ||
           '';
  
  // Handle comma-separated IPs (when passing through proxies)
  if (ip.includes(',')) {
    ip = ip.split(',')[0].trim();
  }
  
  // Handle IPv6 localhost
  if (ip === '::1') {
    ip = '127.0.0.1';
  }
  
  return ip;
}

module.exports = getIpAddress; 