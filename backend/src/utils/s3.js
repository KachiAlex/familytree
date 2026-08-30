const AWS = require('aws-sdk');

const s3 = new AWS.S3({
  accessKeyId: process.env.R2_ACCESS_KEY_ID || process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.R2_SECRET_ACCESS_KEY || process.env.AWS_SECRET_ACCESS_KEY,
  endpoint: process.env.R2_ENDPOINT, // e.g., https://<account_id>.r2.cloudflarestorage.com
  region: 'auto', // R2 uses 'auto'
  signatureVersion: 'v4',
});

const uploadToR2 = async (file, key) => {
  const params = {
    Bucket: process.env.R2_BUCKET_NAME || process.env.AWS_S3_BUCKET,
    Key: key,
    Body: file.buffer,
    ContentType: file.mimetype,
  };

  const result = await s3.upload(params).promise();
  
  // If R2_PUBLIC_URL is provided, use it to construct the full URL
  // Otherwise fallback to the Location provided by the SDK (which might be an S3-style URL)
  if (process.env.R2_PUBLIC_URL) {
    return {
      ...result,
      Location: `${process.env.R2_PUBLIC_URL.replace(/\/$/, '')}/${key}`
    };
  }
  
  return result;
};

const deleteFromR2 = async (key) => {
  const params = {
    Bucket: process.env.R2_BUCKET_NAME || process.env.AWS_S3_BUCKET,
    Key: key,
  };

  return s3.deleteObject(params).promise();
};

module.exports = {
  s3,
  uploadToR2,
  deleteFromR2,
};
