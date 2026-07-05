const router = require('express').Router();
const leaderboardCtrl = require('../controllers/leaderboard.controller');
const authRequired = require('../middleware/authRequired.middleware');
const permiso = require('../middleware/permisos.middleware');

// Public routes - No authentication required

/**
 * GET /api/leaderboard
 * Gets the complete leaderboard with position change indicators
 * Query params: limit, offset, userId
 */
router.get('/', leaderboardCtrl.getLeaderboard);

/**
 * GET /api/leaderboard/top10
 * Gets the top 10 leaderboard (optimized endpoint)
 */
router.get('/top10', leaderboardCtrl.getTop10);

/**
 * GET /api/leaderboard/stats
 * Gets general leaderboard statistics
 */
router.get('/stats', leaderboardCtrl.getStats);

/**
 * GET /api/leaderboard/user/:userId/history
 * Gets position history for a specific user
 * Query params: days (default: 7)
 */
router.get('/user/:userId/history', leaderboardCtrl.getUserHistory);

// Protected routes - Require authentication

/**
 * GET /api/leaderboard/me
 * Gets the authenticated user's position
 */
router.get('/me', authRequired, leaderboardCtrl.getMyPosition);

// Admin routes - Require specific permissions

/**
 * POST /api/leaderboard/snapshot
 * Creates a manual snapshot of the current leaderboard
 * Requires admin permissions
 */
router.post('/snapshot', authRequired, permiso('gestionar_usuarios'), leaderboardCtrl.createSnapshot);

/**
 * DELETE /api/leaderboard/snapshots/old
 * Cleans old leaderboard snapshots
 * Query params: days (default: 30)
 * Requires admin permissions
 */
router.delete('/snapshots/old', authRequired, permiso('gestionar_usuarios'), leaderboardCtrl.cleanOldSnapshots);

module.exports = router;
