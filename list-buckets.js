// Simple script to verify AWS credentials by listing buckets
require('dotenv').config();
const AWS = require('aws-sdk');

console.log('Checking AWS credentials...');
console.log('Access Key ID:', process.env.AWS_ACCESS_KEY_ID ? `${process.env.AWS_ACCESS_KEY_ID.slice(0, 5)}...` : 'Not set');
console.log('Secret Access Key:', process.env.AWS_SECRET_ACCESS_KEY ? 'Is set (hidden)' : 'Not set');
console.log('Region:', process.env.AWS_REGION || 'Not set');

// Configure AWS SDK
AWS.config.update({
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  region: process.env.AWS_REGION || 'ap-southeast-2'
});

// Create S3 service object
const s3 = new AWS.S3();

// List all buckets
s3.listBuckets((err, data) => {
  if (err) {
    console.error('Error listing buckets:', err);
    console.error('Error details:', JSON.stringify(err, null, 2));
    console.log('Possible causes:');
    console.log('- AWS credentials are incorrect');
    console.log('- The IAM user does not have permission to list buckets');
    console.log('- The region is incorrect');
    return;
  }
  
  console.log('Success! You have access to S3');
  console.log('Available buckets:');
  data.Buckets.forEach((bucket) => {
    console.log(`- ${bucket.Name} (created: ${bucket.CreationDate})`);
  });
}); 