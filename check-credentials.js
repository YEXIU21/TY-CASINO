// Debugging script to check AWS credentials
require('dotenv').config();

console.log('--- AWS Credentials Check ---');
console.log('AWS_ACCESS_KEY_ID:');
const accessKey = process.env.AWS_ACCESS_KEY_ID || '';
const secretKey = process.env.AWS_SECRET_ACCESS_KEY || '';

// Display the access key character by character
for (let i = 0; i < accessKey.length; i++) {
  console.log(`Position ${i + 1}: ${accessKey[i]}`);
}

console.log('\nTotal length of access key:', accessKey.length);
console.log('Expected length: 20 characters');

// Display the first and last few characters of the secret key
console.log('\nAWS_SECRET_ACCESS_KEY:');
if (secretKey.length > 0) {
  console.log(`First 4 characters: ${secretKey.substring(0, 4)}`);
  console.log(`Last 4 characters: ${secretKey.substring(secretKey.length - 4)}`);
  console.log(`Total length: ${secretKey.length}`);
  console.log('Expected length: 40 characters');
} else {
  console.log('Not set');
}

console.log('\nAWS_REGION:', process.env.AWS_REGION || 'Not set');
console.log('AWS_S3_BUCKET:', process.env.AWS_S3_BUCKET || 'Not set');

console.log('\n--- End of Check ---'); 