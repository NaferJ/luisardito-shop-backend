const router = require('express').Router();
const kickBroadcasterCtrl = require('../controllers/kickBroadcaster.controller');
const auth = require('../middleware/auth.middleware');
const permiso = require('../middleware/permisos.middleware');

// Endpoints para gestionar conexión del broadcaster (protegidos para admins)
router.get('/broadcaster/status', auth, permiso('ver_usuarios'), kickBroadcasterCtrl.getConnectionStatus);
router.post('/broadcaster/disconnect', auth, permiso('gestionar_usuarios'), kickBroadcasterCtrl.disconnect);
router.get('/broadcaster/token', auth, permiso('gestionar_usuarios'), kickBroadcasterCtrl.getActiveToken);

// Endpoints para refresh de tokens (protegidos para admins)
router.post('/broadcaster/refresh-token', auth, permiso('gestionar_usuarios'), kickBroadcasterCtrl.refreshToken);
router.get('/broadcaster/refresh-service/status', auth, permiso('ver_usuarios'), kickBroadcasterCtrl.getRefreshServiceStatus);

// Debug endpoint (solo para desarrolladores/admins con permisos completos)
router.get('/broadcaster/debug', auth, permiso('editar_puntos'), kickBroadcasterCtrl.debugConfig);

module.exports = router;
