const leaderboardService = require("../services/leaderboard.service");
const asyncHandler = require("../utils/asyncHandler");
const AppError = require("../utils/AppError");

/**
 * Gets the current leaderboard with position change indicators
 * GET /api/leaderboard
 * Query params:
 *   - limit: number of users to return (default: 100)
 *   - offset: offset for pagination (default: 0)
 *   - userId: ID of the user to include their specific position
 */
exports.getLeaderboard = asyncHandler(async (req, res) => {
  const limit = parseInt(req.query.limit) || 100;
  const offset = parseInt(req.query.offset) || 0;
  const userId = req.query.userId ? parseInt(req.query.userId) : null;

  // Validations
  if (limit < 1 || limit > 500) {
    throw new AppError("Limit must be between 1 and 500", 400);
  }

  if (offset < 0) {
    throw new AppError("Offset cannot be negative", 400);
  }

  const result = await leaderboardService.getLeaderboard({
    limit,
    offset,
    userId,
  });

  res.json(result);
});

/**
 * Gets position history for a specific user
 * GET /api/leaderboard/user/:userId/history
 * Query params:
 *   - days: days of history (default: 7)
 */
exports.getUserHistory = asyncHandler(async (req, res) => {
  const userId = parseInt(req.params.userId);
  const days = parseInt(req.query.days) || 7;

  if (!userId || isNaN(userId)) {
    throw new AppError("Invalid user ID", 400);
  }

  if (days < 1 || days > 90) {
    throw new AppError("Days must be between 1 and 90", 400);
  }

  const result = await leaderboardService.getUserPositionHistory(userId, days);

  res.json(result);
});

/**
 * Gets general leaderboard statistics
 * GET /api/leaderboard/stats
 */
exports.getStats = asyncHandler(async (req, res) => {
  const result = await leaderboardService.getLeaderboardStats();

  res.json(result);
});

/**
 * Gets the position of an authenticated user
 * GET /api/leaderboard/me
 * Requires authentication
 */
exports.getMyPosition = asyncHandler(async (req, res) => {
  const userId = req.user.id; // Comes from the auth middleware

  const result = await leaderboardService.getLeaderboard({
    limit: 1,
    offset: 0,
    userId,
  });

  if (!result.user_position) {
    return res.json({
      success: true,
      data: null,
      message: "You have no points yet",
    });
  }

  res.json({
    success: true,
    data: result.user_position,
  });
});

/**
 * Creates a manual leaderboard snapshot
 * POST /api/leaderboard/snapshot
 * Requires admin permissions
 */
exports.createSnapshot = asyncHandler(async (req, res) => {
  const result = await leaderboardService.createSnapshot();

  res.json(result);
});

/**
 * Cleans old snapshots
 * DELETE /api/leaderboard/snapshots/old
 * Query params:
 *   - days: days of history to keep (default: 30)
 * Requires admin permissions
 */
exports.cleanOldSnapshots = asyncHandler(async (req, res) => {
  const daysToKeep = parseInt(req.query.days) || 30;

  if (daysToKeep < 7) {
    throw new AppError("You must keep at least 7 days of history", 400);
  }

  const result = await leaderboardService.cleanOldSnapshots(daysToKeep);

  res.json(result);
});

/**
 * Gets the top 10 leaderboard (fast and simple endpoint)
 * GET /api/leaderboard/top10
 */
exports.getTop10 = asyncHandler(async (req, res) => {
  const result = await leaderboardService.getLeaderboard({
    limit: 10,
    offset: 0,
  });

  res.json({
    success: true,
    data: result.data,
    meta: {
      last_update: result.meta.last_update,
    },
  });
});
