const logger = require("../utils/logger");
let cloudinary;

try {
  cloudinary = require("cloudinary").v2;

  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
  });

  logger.info("[Cloudinary] Configured successfully");
} catch (error) {
  logger.warn("[Cloudinary] Not available:", error.message);
  cloudinary = null;
}

module.exports = cloudinary;
