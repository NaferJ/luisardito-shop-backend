import { v2 as cloudinaryV2 } from "cloudinary";
import logger from "../utils/logger";

let cloudinary: typeof cloudinaryV2 | null;

try {
  cloudinaryV2.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
  });

  logger.info("[Cloudinary] Configured successfully");
  cloudinary = cloudinaryV2;
} catch (error) {
  const msg = error instanceof Error ? error.message : String(error);
  logger.warn("[Cloudinary] Not available:", msg);
  cloudinary = null;
}

export = cloudinary;
