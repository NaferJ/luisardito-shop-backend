const router = require('express').Router();
const kickBroadcasterCtrl = require('../controllers/kickBroadcaster.controller');

// Endpoints para gestionar conexión del broadcaster
router.get('/broadcaster/status', kickBroadcasterCtrl.getConnectionStatus);
router.post('/broadcaster/disconnect', kickBroadcasterCtrl.disconnect);
router.get('/broadcaster/token', kickBroadcasterCtrl.getActiveToken);

module.exports = router;
