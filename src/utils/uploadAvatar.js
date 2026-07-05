const cloudinary = require('../config/cloudinary');
const axios = require('axios');
const logger = require('./logger');

/**
 * Downloads Kick avatar and uploads it to Cloudinary
 * @param {string} kickAvatarUrl - Kick avatar URL
 * @param {string} userId - User ID for the file name
 * @returns {Promise<string>} - Cloudinary avatar URL
 */
async function uploadKickAvatarToCloudinary(kickAvatarUrl, userId) {
    try {
        // Check if Cloudinary is available
        if (!cloudinary) {
            logger.warn(`[Upload Avatar] Cloudinary not available, using original Kick URL`);
            return kickAvatarUrl; // Fallback to original URL
        }

        // Check if it is a Kick default image (cannot be downloaded)
        if (kickAvatarUrl.includes('/img/default-profile-pictures/')) {
            logger.info(`[Upload Avatar] Kick default avatar detected, using original URL`);
            return kickAvatarUrl; // Use original URL for default avatars
        }

        logger.info(`[Upload Avatar] Downloading Kick avatar for user ${userId}:`, kickAvatarUrl);

        // 1. Download the image from Kick with improved headers
        const response = await axios.get(kickAvatarUrl, {
            responseType: 'arraybuffer',
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
                'Accept': 'image/webp,image/apng,image/*,*/*;q=0.8',
                'Accept-Language': 'en-US,en;q=0.9',
                'Accept-Encoding': 'gzip, deflate, br',
                'Cache-Control': 'no-cache',
                'Pragma': 'no-cache',
                'Sec-Fetch-Dest': 'image',
                'Sec-Fetch-Mode': 'no-cors',
                'Sec-Fetch-Site': 'cross-site'
            },
            timeout: 10000,
            maxRedirects: 5
        });

        // 2. Convert to base64
        const base64Image = Buffer.from(response.data).toString('base64');
        const dataUri = `data:image/jpeg;base64,${base64Image}`;

        logger.info(`[Upload Avatar] Uploading to Cloudinary for user ${userId}...`);

        // 3. Upload to Cloudinary
        const result = await cloudinary.uploader.upload(dataUri, {
            folder: 'user-avatars',
            public_id: `avatar-user-${userId}`,
            overwrite: true,
            transformation: [
                { width: 300, height: 300, crop: 'fill' },
                { quality: 'auto' },
                { format: 'webp' }
            ]
        });

        logger.info(`[Upload Avatar] Avatar uploaded successfully`);
        return result.secure_url;

    } catch (error) {
        logger.error('[Upload Avatar] Error processing avatar:', error.message);

        // If it is specifically a 403 error from Kick, it is likely a protected image
        if (error.response && error.response.status === 403 && error.config?.url?.includes('kick.com')) {
            logger.warn('[Upload Avatar] Kick.com blocked download (protected image), using original URL');
            return kickAvatarUrl; // Use original URL when Kick blocks download
        }

        // For other errors, also use fallback
        logger.error('[Upload Avatar] Full error:', error);
        if (error.http_code) {
        logger.error('[Upload Avatar] HTTP Code:', error.http_code);
        }
        if (error.error && error.error.message) {
        logger.error('[Upload Avatar] Cloudinary Error:', error.error.message);
        }
        logger.warn('[Upload Avatar] Using original Kick URL as fallback');
        return kickAvatarUrl; // Fallback to original URL on error
    }
}

module.exports = { uploadKickAvatarToCloudinary };
