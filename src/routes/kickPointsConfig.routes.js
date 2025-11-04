const router = require('express').Router();
const kickPointsConfigCtrl = require('../controllers/kickPointsConfig.controller');
const authRequired = require('../middleware/authRequired.middleware');
const permiso = require('../middleware/permisos.middleware');

// ✅ Rutas protegidas - Todas requieren autenticación estricta + permisos

// Endpoints para gestionar configuración de puntos (protegidos para admins)
router.get('/points-config', authRequired, permiso('ver_usuarios'), kickPointsConfigCtrl.getConfig);
router.put('/points-config', authRequired, permiso('editar_puntos'), kickPointsConfigCtrl.updateConfig);
router.put('/points-config/bulk', authRequired, permiso('editar_puntos'), kickPointsConfigCtrl.updateMultipleConfigs);
router.post('/points-config/initialize', authRequired, permiso('editar_puntos'), kickPointsConfigCtrl.initializeConfig);

module.exports = router;
