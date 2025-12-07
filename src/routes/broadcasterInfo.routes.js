const router = require('express').Router();
const broadcasterInfoCtrl = require('../controllers/broadcasterInfo.controller');

// ✅ Rutas públicas - NO requieren autenticación
// Estas rutas son consumidas por el frontend para mostrar información del broadcaster

/**
 * GET /api/broadcaster/info
 * Obtiene información completa del broadcaster principal
 * Incluye: estado del stream, metadata, uptime, etc.
 */
router.get('/info', broadcasterInfoCtrl.getBroadcasterInfo);

/**
 * GET /api/broadcaster/status
 * Obtiene solo el estado del stream (online/offline)
 * Endpoint más ligero para polling frecuente
 */
router.get('/status', broadcasterInfoCtrl.getStreamStatus);

module.exports = router;
