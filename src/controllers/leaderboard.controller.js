const leaderboardService = require('../services/leaderboard.service');
const logger = require('../utils/logger');

/**
 * Gets the current leaderboard with position change indicators
 * GET /api/leaderboard
 * Query params:
 *   - limit: number of users to return (default: 100)
 *   - offset: offset for pagination (default: 0)
 *   - userId: ID of the user to include their specific position
 */
exports.getLeaderboard = async (req, res) => {
    try {
        const limit = parseInt(req.query.limit) || 100;
        const offset = parseInt(req.query.offset) || 0;
        const userId = req.query.userId ? parseInt(req.query.userId) : null;

        // Validations
        if (limit < 1 || limit > 500) {
            return res.status(400).json({
                success: false,
                message: 'Limit must be between 1 and 500'
            });
        }

        if (offset < 0) {
            return res.status(400).json({
                success: false,
                message: 'Offset cannot be negative'
            });
        }

        const result = await leaderboardService.getLeaderboard({
            limit,
            offset,
            userId
        });

        res.json(result);
    } catch (error) {
        logger.error('Error in getLeaderboard:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching leaderboard',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

/**
 * Gets position history for a specific user
 * GET /api/leaderboard/user/:userId/history
 * Query params:
 *   - days: days of history (default: 7)
 */
exports.getUserHistory = async (req, res) => {
    try {
        const userId = parseInt(req.params.userId);
        const days = parseInt(req.query.days) || 7;

        if (!userId || isNaN(userId)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid user ID'
            });
        }

        if (days < 1 || days > 90) {
            return res.status(400).json({
                success: false,
                message: 'Days must be between 1 and 90'
            });
        }

        const result = await leaderboardService.getUserPositionHistory(userId, days);

        res.json(result);
    } catch (error) {
        logger.error(`Error in getUserHistory for user ${req.params.userId}:`, error);
        res.status(500).json({
            success: false,
            message: 'Error fetching user history',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

/**
 * Gets general leaderboard statistics
 * GET /api/leaderboard/stats
 */
exports.getStats = async (req, res) => {
    try {
        const result = await leaderboardService.getLeaderboardStats();

        res.json(result);
    } catch (error) {
        logger.error('Error in getStats:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching stats',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

/**
 * Gets the position of an authenticated user
 * GET /api/leaderboard/me
 * Requires authentication
 */
exports.getMyPosition = async (req, res) => {
    try {
        const userId = req.user.id; // Comes from the auth middleware

        const result = await leaderboardService.getLeaderboard({
            limit: 1,
            offset: 0,
            userId
        });

        if (!result.user_position) {
            return res.json({
                success: true,
                data: null,
                message: 'You have no points yet'
            });
        }

        res.json({
            success: true,
            data: result.user_position
        });
    } catch (error) {
        logger.error('Error in getMyPosition:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching your position',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

/**
 * Creates a manual leaderboard snapshot
 * POST /api/leaderboard/snapshot
 * Requires admin permissions
 */
exports.createSnapshot = async (req, res) => {
    try {
        const result = await leaderboardService.createSnapshot();

        res.json(result);
    } catch (error) {
        logger.error('Error in createSnapshot:', error);
        res.status(500).json({
            success: false,
            message: 'Error creating snapshot',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

/**
 * Cleans old snapshots
 * DELETE /api/leaderboard/snapshots/old
 * Query params:
 *   - days: days of history to keep (default: 30)
 * Requires admin permissions
 */
exports.cleanOldSnapshots = async (req, res) => {
    try {
        const daysToKeep = parseInt(req.query.days) || 30;

        if (daysToKeep < 7) {
            return res.status(400).json({
                success: false,
                message: 'You must keep at least 7 days of history'
            });
        }

        const result = await leaderboardService.cleanOldSnapshots(daysToKeep);

        res.json(result);
    } catch (error) {
        logger.error('Error in cleanOldSnapshots:', error);
        res.status(500).json({
            success: false,
            message: 'Error cleaning old snapshots',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

/**
 * Gets the top 10 leaderboard (fast and simple endpoint)
 * GET /api/leaderboard/top10
 */
exports.getTop10 = async (req, res) => {
    try {
        const result = await leaderboardService.getLeaderboard({
            limit: 10,
            offset: 0
        });

        res.json({
            success: true,
            data: result.data,
            meta: {
                last_update: result.meta.last_update
            }
        });
    } catch (error) {
        logger.error('Error in getTop10:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching top 10',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};
