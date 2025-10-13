const router = require('express').Router();
const kickPointsConfigCtrl = require('../controllers/kickPointsConfig.controller');

// Endpoints para gestionar configuración de puntos
router.get('/points-config', kickPointsConfigCtrl.getConfig);
router.put('/points-config', kickPointsConfigCtrl.updateConfig);
router.put('/points-config/bulk', kickPointsConfigCtrl.updateMultipleConfigs);
router.post('/points-config/initialize', kickPointsConfigCtrl.initializeConfig);

module.exports = router;
