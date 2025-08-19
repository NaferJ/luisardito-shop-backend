const router = require('express').Router();
const historialCtrl = require('../controllers/historialPuntos.controller');
const auth = require('../middleware/auth.middleware');
const permiso = require('../middleware/permisos.middleware');

// Listar historial de puntos de un usuario
router.get('/:usuarioId', auth, permiso('ver_canjes'), historialCtrl.listar);

module.exports = router;
