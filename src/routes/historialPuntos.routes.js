const router = require('express').Router();
const historialCtrl = require('../controllers/historialPuntos.controller');
const auth = require('../middleware/auth.middleware');
const permiso = require('../middleware/permisos.middleware');

// Listar historial de puntos de un usuario (filtrado, sin eventos de chat)
router.get('/:usuarioId', auth, permiso('ver_historial_puntos'), historialCtrl.listar);

// Listar historial completo (incluyendo eventos de chat) - Solo administradores
router.get('/:usuarioId/completo', auth, permiso('editar_puntos'), historialCtrl.listarCompleto);

module.exports = router;
