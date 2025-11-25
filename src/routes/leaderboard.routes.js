const router = require('express').Router();
const leaderboardCtrl = require('../controllers/leaderboard.controller');
const auth = require('../middleware/auth.middleware');
const authRequired = require('../middleware/authRequired.middleware');
const permiso = require('../middleware/permisos.middleware');

// ✅ Rutas públicas - No requieren autenticación

/**
 * GET /api/leaderboard
 * Obtiene el leaderboard completo con indicadores de cambio de posición
 * Query params: limit, offset, userId
 */
router.get('/', leaderboardCtrl.getLeaderboard);

/**
 * GET /api/leaderboard/top10
 * Obtiene el top 10 del leaderboard (endpoint optimizado)
 */
router.get('/top10', leaderboardCtrl.getTop10);

/**
 * GET /api/leaderboard/stats
 * Obtiene estadísticas generales del leaderboard
 */
router.get('/stats', leaderboardCtrl.getStats);

/**
 * GET /api/leaderboard/user/:userId/history
 * Obtiene el historial de posiciones de un usuario específico
 * Query params: days (default: 7)
 */
router.get('/user/:userId/history', leaderboardCtrl.getUserHistory);

// ✅ Rutas protegidas - Requieren autenticación

/**
 * GET /api/leaderboard/me
 * Obtiene la posición del usuario autenticado
 */
router.get('/me', authRequired, leaderboardCtrl.getMyPosition);

// ✅ Rutas de administración - Requieren permisos específicos

/**
 * POST /api/leaderboard/snapshot
 * Crea un snapshot manual del leaderboard actual
 * Requiere permisos de administrador
 */
router.post('/snapshot', authRequired, permiso('gestionar_usuarios'), leaderboardCtrl.createSnapshot);

/**
 * DELETE /api/leaderboard/snapshots/old
 * Limpia snapshots antiguos del leaderboard
 * Query params: days (default: 30)
 * Requiere permisos de administrador
 */
router.delete('/snapshots/old', authRequired, permiso('gestionar_usuarios'), leaderboardCtrl.cleanOldSnapshots);

module.exports = router;
