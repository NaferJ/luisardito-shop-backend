const leaderboardService = require('../services/leaderboard.service');
const logger = require('../utils/logger');

/**
 * Obtiene el leaderboard actual con indicadores de cambios de posición
 * GET /api/leaderboard
 * Query params:
 *   - limit: número de usuarios a retornar (default: 100)
 *   - offset: offset para paginación (default: 0)
 *   - userId: ID del usuario para incluir su posición específica
 */
exports.getLeaderboard = async (req, res) => {
    try {
        const limit = parseInt(req.query.limit) || 100;
        const offset = parseInt(req.query.offset) || 0;
        const userId = req.query.userId ? parseInt(req.query.userId) : null;

        // Validaciones
        if (limit < 1 || limit > 500) {
            return res.status(400).json({
                success: false,
                message: 'El límite debe estar entre 1 y 500'
            });
        }

        if (offset < 0) {
            return res.status(400).json({
                success: false,
                message: 'El offset no puede ser negativo'
            });
        }

        const result = await leaderboardService.getLeaderboard({
            limit,
            offset,
            userId
        });

        res.json(result);
    } catch (error) {
        logger.error('❌ Error en getLeaderboard:', error);
        res.status(500).json({
            success: false,
            message: 'Error al obtener el leaderboard',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

/**
 * Obtiene el historial de posiciones de un usuario específico
 * GET /api/leaderboard/user/:userId/history
 * Query params:
 *   - days: días de histórico (default: 7)
 */
exports.getUserHistory = async (req, res) => {
    try {
        const userId = parseInt(req.params.userId);
        const days = parseInt(req.query.days) || 7;

        if (!userId || isNaN(userId)) {
            return res.status(400).json({
                success: false,
                message: 'ID de usuario inválido'
            });
        }

        if (days < 1 || days > 90) {
            return res.status(400).json({
                success: false,
                message: 'Los días deben estar entre 1 y 90'
            });
        }

        const result = await leaderboardService.getUserPositionHistory(userId, days);

        res.json(result);
    } catch (error) {
        logger.error(`❌ Error en getUserHistory para usuario ${req.params.userId}:`, error);
        res.status(500).json({
            success: false,
            message: 'Error al obtener el historial del usuario',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

/**
 * Obtiene estadísticas generales del leaderboard
 * GET /api/leaderboard/stats
 */
exports.getStats = async (req, res) => {
    try {
        const result = await leaderboardService.getLeaderboardStats();

        res.json(result);
    } catch (error) {
        logger.error('❌ Error en getStats:', error);
        res.status(500).json({
            success: false,
            message: 'Error al obtener las estadísticas',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

/**
 * Obtiene la posición de un usuario autenticado
 * GET /api/leaderboard/me
 * Requiere autenticación
 */
exports.getMyPosition = async (req, res) => {
    try {
        const userId = req.user.id; // Viene del middleware de autenticación

        const result = await leaderboardService.getLeaderboard({
            limit: 1,
            offset: 0,
            userId
        });

        if (!result.user_position) {
            return res.json({
                success: true,
                data: null,
                message: 'No tienes puntos aún'
            });
        }

        res.json({
            success: true,
            data: result.user_position
        });
    } catch (error) {
        logger.error('❌ Error en getMyPosition:', error);
        res.status(500).json({
            success: false,
            message: 'Error al obtener tu posición',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

/**
 * Crea un snapshot manual del leaderboard
 * POST /api/leaderboard/snapshot
 * Requiere permisos de administrador
 */
exports.createSnapshot = async (req, res) => {
    try {
        const result = await leaderboardService.createSnapshot();

        res.json(result);
    } catch (error) {
        logger.error('❌ Error en createSnapshot:', error);
        res.status(500).json({
            success: false,
            message: 'Error al crear el snapshot',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

/**
 * Limpia snapshots antiguos
 * DELETE /api/leaderboard/snapshots/old
 * Query params:
 *   - days: días de histórico a mantener (default: 30)
 * Requiere permisos de administrador
 */
exports.cleanOldSnapshots = async (req, res) => {
    try {
        const daysToKeep = parseInt(req.query.days) || 30;

        if (daysToKeep < 7) {
            return res.status(400).json({
                success: false,
                message: 'Debes mantener al menos 7 días de histórico'
            });
        }

        const result = await leaderboardService.cleanOldSnapshots(daysToKeep);

        res.json(result);
    } catch (error) {
        logger.error('❌ Error en cleanOldSnapshots:', error);
        res.status(500).json({
            success: false,
            message: 'Error al limpiar los snapshots antiguos',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

/**
 * Obtiene el top 10 del leaderboard (endpoint rápido y simple)
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
        logger.error('❌ Error en getTop10:', error);
        res.status(500).json({
            success: false,
            message: 'Error al obtener el top 10',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};
