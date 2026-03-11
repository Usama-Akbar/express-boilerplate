'use strict';

const AWS = require('aws-sdk');
const sharp = require('sharp');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const logger = require('../config/logger');
const AppError = require('../helpers/app-error.helper');
const { formatBytes } = require('../utils/helpers.util');

const s3 = new AWS.S3({
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  region: process.env.AWS_REGION || 'us-east-1',
});

const BUCKET = process.env.AWS_S3_BUCKET;
const CDN_URL = process.env.CDN_URL || process.env.AWS_S3_URL;

const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
const ALLOWED_DOC_TYPES = ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];

class StorageService {
  /**
   * Upload a file buffer to S3
   */
  async uploadBuffer(buffer, options = {}) {
    const {
      mimetype,
      folder = 'uploads',
      filename,
      isPublic = true,
      metadata = {},
    } = options;

    const ext = this.getExtension(mimetype);
    const key = `${folder}/${filename || `${uuidv4()}${ext}`}`;

    const params = {
      Bucket: BUCKET,
      Key: key,
      Body: buffer,
      ContentType: mimetype,
      ACL: isPublic ? 'public-read' : 'private',
      Metadata: {
        ...metadata,
        uploadedAt: new Date().toISOString(),
      },
    };

    try {
      const result = await s3.upload(params).promise();
      const url = CDN_URL ? `${CDN_URL}/${key}` : result.Location;

      logger.info(`File uploaded: ${key} (${formatBytes(buffer.length)})`);

      return {
        key,
        url,
        bucket: BUCKET,
        size: buffer.length,
        mimetype,
        location: result.Location,
      };
    } catch (error) {
      logger.error('S3 upload failed:', error.message);
      throw new AppError('File upload failed', 500, 'UPLOAD_ERROR');
    }
  }

  /**
   * Upload and process an image (resize, optimize)
   */
  async uploadImage(buffer, options = {}) {
    const {
      folder = 'images',
      filename,
      width,
      height,
      quality = 85,
      format = 'webp',
    } = options;

    // Process image with sharp
    let sharpInstance = sharp(buffer);

    if (width || height) {
      sharpInstance = sharpInstance.resize(width, height, {
        fit: 'cover',
        withoutEnlargement: true,
      });
    }

    let processedBuffer;
    let mimetype;

    switch (format) {
      case 'webp':
        processedBuffer = await sharpInstance.webp({ quality }).toBuffer();
        mimetype = 'image/webp';
        break;
      case 'jpeg':
        processedBuffer = await sharpInstance.jpeg({ quality }).toBuffer();
        mimetype = 'image/jpeg';
        break;
      case 'png':
        processedBuffer = await sharpInstance.png({ quality }).toBuffer();
        mimetype = 'image/png';
        break;
      default:
        processedBuffer = await sharpInstance.toBuffer();
        mimetype = 'image/webp';
    }

    return this.uploadBuffer(processedBuffer, {
      mimetype,
      folder,
      filename: filename ? `${filename}.${format}` : undefined,
    });
  }

  /**
   * Upload avatar with thumbnail generation
   */
  async uploadAvatar(buffer, userId) {
    const [original, thumbnail] = await Promise.all([
      this.uploadImage(buffer, {
        folder: `avatars/${userId}`,
        filename: 'original',
        width: 400,
        height: 400,
      }),
      this.uploadImage(buffer, {
        folder: `avatars/${userId}`,
        filename: 'thumbnail',
        width: 80,
        height: 80,
      }),
    ]);

    return { original: original.url, thumbnail: thumbnail.url };
  }

  /**
   * Delete a file from S3
   */
  async deleteFile(key) {
    try {
      await s3.deleteObject({ Bucket: BUCKET, Key: key }).promise();
      logger.info(`File deleted: ${key}`);
      return true;
    } catch (error) {
      logger.error(`S3 delete failed for ${key}:`, error.message);
      return false;
    }
  }

  /**
   * Generate a pre-signed URL for private file access
   */
  async getSignedUrl(key, expiresInSeconds = 3600) {
    return s3.getSignedUrlPromise('getObject', {
      Bucket: BUCKET,
      Key: key,
      Expires: expiresInSeconds,
    });
  }

  /**
   * Get a pre-signed URL for direct browser upload
   */
  async getUploadUrl(key, mimetype, expiresInSeconds = 300) {
    return s3.getSignedUrlPromise('putObject', {
      Bucket: BUCKET,
      Key: key,
      ContentType: mimetype,
      ACL: 'public-read',
      Expires: expiresInSeconds,
    });
  }

  /**
   * Check if a file exists in S3
   */
  async fileExists(key) {
    try {
      await s3.headObject({ Bucket: BUCKET, Key: key }).promise();
      return true;
    } catch {
      return false;
    }
  }

  getExtension(mimetype) {
    const extMap = {
      'image/jpeg': '.jpg',
      'image/png': '.png',
      'image/gif': '.gif',
      'image/webp': '.webp',
      'application/pdf': '.pdf',
    };
    return extMap[mimetype] || '';
  }
}

module.exports = new StorageService();
