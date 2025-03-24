// Test script for S3 upload functionality
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { uploadToS3, getPublicUrl, listS3Files } = require('./api/utils/s3-upload');

async function testS3Upload() {
  console.log('Testing S3 connection and upload...');
  
  // Check if environment variables are set
  if (!process.env.AWS_ACCESS_KEY_ID || process.env.AWS_ACCESS_KEY_ID.includes('YOUR_AWS')) {
    console.error('❌ AWS_ACCESS_KEY_ID not configured. Please update your .env file with actual credentials.');
    return;
  }
  
  if (!process.env.AWS_SECRET_ACCESS_KEY || process.env.AWS_SECRET_ACCESS_KEY.includes('YOUR_AWS')) {
    console.error('❌ AWS_SECRET_ACCESS_KEY not configured. Please update your .env file with actual credentials.');
    return;
  }
  
  console.log('Using bucket:', process.env.AWS_S3_BUCKET);
  console.log('Using region:', process.env.AWS_REGION);
  
  try {
    // Create a test file
    const testFilePath = path.join(__dirname, 'test-upload.txt');
    fs.writeFileSync(testFilePath, 'This is a test file for S3 upload at ' + new Date().toISOString());
    
    // Upload the file to S3
    console.log('Uploading test file to S3...');
    const fileContent = fs.readFileSync(testFilePath);
    const fileName = 'test-' + Date.now() + '.txt';
    
    const fileUrl = await uploadToS3(fileContent, fileName, 'text/plain', 'test');
    console.log('✅ File uploaded successfully!');
    console.log('File URL:', fileUrl);
    
    // Get the public URL
    const publicUrl = getPublicUrl(fileName, 'test');
    console.log('Public URL:', publicUrl);
    
    // List files in the test folder
    console.log('Listing files in test folder:');
    const files = await listS3Files('test');
    files.forEach((file, index) => {
      console.log(`${index + 1}. ${file.Key} (${file.Size} bytes)`);
    });
    
    // Clean up the test file
    fs.unlinkSync(testFilePath);
    console.log('Test file cleaned up locally');
    
    console.log('✅ S3 test completed successfully!');
  } catch (error) {
    console.error('❌ S3 test failed:', error.message);
    console.error(error);
  }
}

testS3Upload(); 