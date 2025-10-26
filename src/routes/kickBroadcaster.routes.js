const router = require('express').Router();
const kickBroadcasterCtrl = require('../controllers/kickBroadcaster.controller');

// Endpoints para gestionar conexión del broadcaster
router.get('/broadcaster/status', kickBroadcasterCtrl.getConnectionStatus);
router.post('/broadcaster/disconnect', kickBroadcasterCtrl.disconnect);
router.get('/broadcaster/token', kickBroadcasterCtrl.getActiveToken);

// Endpoints para refresh de tokens
router.post('/broadcaster/refresh-token', kickBroadcasterCtrl.refreshToken);
router.get('/broadcaster/refresh-service/status', kickBroadcasterCtrl.getRefreshServiceStatus);

module.exports = router;
