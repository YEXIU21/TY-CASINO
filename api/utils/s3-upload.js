const AWS = require('aws-sdk');
const fs = require('fs');
const path = require('path');

// Configure AWS SDK with your credentials
AWS.config.update({
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  region: process.env.AWS_REGION || 'us-east-1'
});

// Create an S3 instance
const s3 = new AWS.S3();
const bucketName = process.env.AWS_S3_BUCKET || 'tycasino-media';

/**
 * Upload a file to AWS S3
 * @param {Buffer|Stream} fileContent - The file content to upload
 * @param {string} fileName - The name to give the file in S3
 * @param {string} contentType - The MIME type of the file
 * @param {string} folder - The folder within the bucket to store the file
 * @returns {Promise<string>} - The URL of the uploaded file
 */
async function uploadToS3(fileContent, fileName, contentType, folder = '') {
  // If folder is provided, add trailing slash if not present
  if (folder && !folder.endsWith('/')) {
    folder = `${folder}/`;
  }

  // Full S3 key (path and filename)
  const key = `${folder}${fileName}`;

  const params = {
    Bucket: bucketName,
    Key: key,
    Body: fileContent,
    ContentType: contentType,
    ACL: 'public-read' // Make file publicly accessible
  };

  try {
    const uploadResult = await s3.upload(params).promise();
    console.log(`File uploaded successfully to ${uploadResult.Location}`);
    return uploadResult.Location;
  } catch (error) {
    console.error('Error uploading file to S3:', error);
    throw error;
  }
}

/**
 * Upload a local file to AWS S3
 * @param {string} filePath - Path to the local file
 * @param {string} fileName - The name to give the file in S3
 * @param {string} contentType - The MIME type of the file
 * @param {string} folder - The folder within the bucket to store the file
 * @returns {Promise<string>} - The URL of the uploaded file
 */
async function uploadLocalFileToS3(filePath, fileName, contentType, folder = '') {
  const fileContent = fs.readFileSync(filePath);
  return uploadToS3(fileContent, fileName, contentType, folder);
}

/**
 * Get a presigned URL for a file in S3
 * @param {string} key - The S3 key (path and filename)
 * @param {number} expirySeconds - How long the URL should be valid for (in seconds)
 * @returns {string} - The presigned URL
 */
function getPresignedUrl(key, expirySeconds = 3600) {
  const params = {
    Bucket: bucketName,
    Key: key,
    Expires: expirySeconds
  };

  return s3.getSignedUrl('getObject', params);
}

/**
 * Get a public URL for a file in S3
 * @param {string} fileName - The filename
 * @param {string} folder - The folder within the bucket
 * @returns {string} - The public URL
 */
function getPublicUrl(fileName, folder = '') {
  // If folder is provided, add trailing slash if not present
  if (folder && !folder.endsWith('/')) {
    folder = `${folder}/`;
  }

  // Full S3 key (path and filename)
  const key = `${folder}${fileName}`;
  
  // AWS S3 URL pattern: https://[bucket-name].s3.[region].amazonaws.com/[key]
  const region = process.env.AWS_REGION || 'us-east-1';
  return `https://${bucketName}.s3.${region}.amazonaws.com/${key}`;
}

/**
 * List files in a folder in S3
 * @param {string} folder - The folder path to list
 * @returns {Promise<Array>} - Array of objects containing file keys
 */
async function listS3Files(folder = '') {
  // If folder is provided, add trailing slash if not present
  if (folder && !folder.endsWith('/')) {
    folder = `${folder}/`;
  }

  const params = {
    Bucket: bucketName,
    Prefix: folder
  };

  try {
    const result = await s3.listObjectsV2(params).promise();
    return result.Contents;
  } catch (error) {
    console.error('Error listing files from S3:', error);
    throw error;
  }
}

module.exports = {
  uploadToS3,
  uploadLocalFileToS3,
  getPresignedUrl,
  getPublicUrl,
  listS3Files,
  s3,
  bucketName
}; 