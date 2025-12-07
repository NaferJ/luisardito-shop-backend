const broadcasterInfoService = require('../services/broadcasterInfo.service');
const logger = require('../utils/logger');

/**
 * Controlador para endpoints públicos de información del broadcaster
 * Estos endpoints NO requieren autenticación y son usados por el frontend
 */

/**
 * GET /api/broadcaster/info
 * Obtiene información completa del broadcaster principal
 * Endpoint público - sin autenticación requerida
 */
exports.getBroadcasterInfo = async (req, res) => {
    try {
        const broadcasterInfo = await broadcasterInfoService.getBroadcasterInfo();
        
        res.json({
            success: true,
            data: broadcasterInfo
        });
        
    } catch (error) {
        logger.error('[BroadcasterInfoCtrl] Error en getBroadcasterInfo:', error.message);
        
        res.status(500).json({
            success: false,
            error: 'Error obteniendo información del broadcaster',
            message: error.message
        });
    }
};

/**
 * GET /api/broadcaster/status
 * Obtiene solo el estado del stream (online/offline)
 * Endpoint público - más ligero y rápido
 */
exports.getStreamStatus = async (req, res) => {
    try {
        const status = await broadcasterInfoService.getStreamStatus();
        
        res.json({
            success: true,
            data: status
        });
        
    } catch (error) {
        logger.error('[BroadcasterInfoCtrl] Error en getStreamStatus:', error.message);
        
        res.status(500).json({
            success: false,
            error: 'Error obteniendo estado del stream',
            message: error.message
        });
    }
};
