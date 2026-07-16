import type { Request, Response } from "express";
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
const getBroadcasterInfo = asyncHandler(
  async (_req: Request, res: Response) => {
    try {
      const broadcasterInfo = await broadcasterInfoService.getBroadcasterInfo();

      res.json({
        success: true,
        data: broadcasterInfo,
      });
    } catch (error) {
      throw new AppError(
        "Error fetching broadcaster info",
        500,
        error instanceof Error ? error.message : String(error)
      );
    }
  }
);

/**
 * GET /api/broadcaster/status
 * Gets only the stream status (online/offline)
 * Public endpoint - lighter and faster
 */
const getStreamStatus = asyncHandler(async (_req: Request, res: Response) => {
  try {
    const status = await broadcasterInfoService.getStreamStatus();

    res.json({
      success: true,
      data: status,
    });
  } catch (error) {
    throw new AppError(
      "Error fetching stream status",
      500,
      error instanceof Error ? error.message : String(error)
    );
  }
});

export = { getBroadcasterInfo, getStreamStatus };
