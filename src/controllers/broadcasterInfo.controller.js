const broadcasterInfoService = require("../services/broadcasterInfo.service");
const asyncHandler = require("../utils/asyncHandler");
const AppError = require("../utils/AppError");

/**
 * Controller for public broadcaster info endpoints
 * These endpoints do NOT require authentication and are used by the frontend
 */

/**
 * GET /api/broadcaster/info
 * Gets full info for the main broadcaster
 * Public endpoint - no authentication required
 */
exports.getBroadcasterInfo = asyncHandler(async (req, res) => {
  try {
    const broadcasterInfo = await broadcasterInfoService.getBroadcasterInfo();

    res.json({
      success: true,
      data: broadcasterInfo,
    });
  } catch (_error) {
    throw new AppError("Error fetching broadcaster info", 500);
  }
});

/**
 * GET /api/broadcaster/status
 * Gets only the stream status (online/offline)
 * Public endpoint - lighter and faster
 */
exports.getStreamStatus = asyncHandler(async (req, res) => {
  try {
    const status = await broadcasterInfoService.getStreamStatus();

    res.json({
      success: true,
      data: status,
    });
  } catch (_error) {
    throw new AppError("Error fetching stream status", 500);
  }
});
