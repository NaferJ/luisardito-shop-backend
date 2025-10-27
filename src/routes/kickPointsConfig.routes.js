const router = require('express').Router();
const kickPointsConfigCtrl = require('../controllers/kickPointsConfig.controller');
const auth = require('../middleware/auth.middleware');
const permiso = require('../middleware/permisos.middleware');

// Endpoints para gestionar configuración de puntos (protegidos para admins)
router.get('/points-config', auth, permiso('ver_usuarios'), kickPointsConfigCtrl.getConfig);
router.put('/points-config', auth, permiso('editar_puntos'), kickPointsConfigCtrl.updateConfig);
router.put('/points-config/bulk', auth, permiso('editar_puntos'), kickPointsConfigCtrl.updateMultipleConfigs);
router.post('/points-config/initialize', auth, permiso('editar_puntos'), kickPointsConfigCtrl.initializeConfig);

module.exports = router;
