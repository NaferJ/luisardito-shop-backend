const router = require('express').Router();
const kickPointsConfigCtrl = require('../controllers/kickPointsConfig.controller');
const authRequired = require('../middleware/authRequired.middleware');
const permiso = require('../middleware/permisos.middleware');

// ✅ Rutas protegidas - Todas requieren autenticación estricta + permisos

// Endpoints para gestionar configuración de puntos (protegidos para admins)
router.put('/points-config', authRequired, permiso('editar_puntos'), kickPointsConfigCtrl.updateConfig);
router.put('/points-config/bulk', authRequired, permiso('editar_puntos'), kickPointsConfigCtrl.updateMultipleConfigs);
router.post('/points-config/initialize', authRequired, permiso('editar_puntos'), kickPointsConfigCtrl.initializeConfig);

// 📊 ENDPOINT PÚBLICO: Obtener configuración de puntos (sin auth)
router.get('/points-config', kickPointsConfigCtrl.getConfig);

module.exports = router;
