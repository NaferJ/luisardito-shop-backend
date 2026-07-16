/* eslint-disable @typescript-eslint/no-explicit-any */
// TEMPORARY eslint override — to be removed in the typing pass

import logger from "../utils/logger";
let cloudinary: any;

try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  cloudinary = require("cloudinary").v2;

  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
  });

  logger.info("[Cloudinary] Configured successfully");
} catch (error: any) {
  logger.warn("[Cloudinary] Not available:", error.message);
  cloudinary = null;
}

export = cloudinary;
