const broadcasterInfoService = require("../services/broadcasterInfo.service");
const logger = require("../utils/logger");

/**
 * Controller for public broadcaster info endpoints
 * These endpoints do NOT require authentication and are used by the frontend
 */

/**
 * GET /api/broadcaster/info
 * Gets full info for the main broadcaster
 * Public endpoint - no authentication required
 */
exports.getBroadcasterInfo = async (req, res) => {
  try {
    const broadcasterInfo = await broadcasterInfoService.getBroadcasterInfo();

    res.json({
      success: true,
      data: broadcasterInfo,
    });
  } catch (error) {
    logger.error(
      "[BroadcasterInfoCtrl] Error in getBroadcasterInfo:",
      error.message
    );

    res.status(500).json({
      success: false,
      error: "Error fetching broadcaster info",
      message: error.message,
    });
  }
};

/**
 * GET /api/broadcaster/status
 * Gets only the stream status (online/offline)
 * Public endpoint - lighter and faster
 */
exports.getStreamStatus = async (req, res) => {
  try {
    const status = await broadcasterInfoService.getStreamStatus();

    res.json({
      success: true,
      data: status,
    });
  } catch (error) {
    logger.error(
      "[BroadcasterInfoCtrl] Error in getStreamStatus:",
      error.message
    );

    res.status(500).json({
      success: false,
      error: "Error fetching stream status",
      message: error.message,
    });
  }
};
