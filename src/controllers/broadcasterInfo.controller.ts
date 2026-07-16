/* eslint-disable @typescript-eslint/no-explicit-any */
// TEMPORARY eslint override — to be removed in the typing pass
import broadcasterInfoService from "../services/broadcasterInfo.service";
import asyncHandler from "../utils/asyncHandler";
import AppError from "../utils/AppError";

/**
 * Controller for public broadcaster info endpoints
 * These endpoints do NOT require authentication and are used by the frontend
 */

/**
 * GET /api/broadcaster/info
 * Gets full info for the main broadcaster
 * Public endpoint - no authentication required
 */
const getBroadcasterInfo = asyncHandler(async (req: any, res: any) => {
  try {
    const broadcasterInfo = await broadcasterInfoService.getBroadcasterInfo();

    res.json({
      success: true,
      data: broadcasterInfo,
    });
  } catch (error: any) {
    throw new AppError("Error fetching broadcaster info", 500, error.message);
  }
});

/**
 * GET /api/broadcaster/status
 * Gets only the stream status (online/offline)
 * Public endpoint - lighter and faster
 */
const getStreamStatus = asyncHandler(async (req: any, res: any) => {
  try {
    const status = await broadcasterInfoService.getStreamStatus();

    res.json({
      success: true,
      data: status,
    });
  } catch (error: any) {
    throw new AppError("Error fetching stream status", 500, error.message);
  }
});

export = { getBroadcasterInfo, getStreamStatus };
