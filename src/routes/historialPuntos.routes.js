const router = require('express').Router();
const historialCtrl = require('../controllers/historialPuntos.controller');
const authRequired = require('../middleware/authRequired.middleware');
const permiso = require('../middleware/permisos.middleware');

// ✅ Rutas protegidas - Todas requieren autenticación estricta + permisos

// Listar historial de puntos de un usuario (filtrado, sin eventos de chat)
router.get('/:usuarioId', authRequired, permiso('ver_historial_puntos'), historialCtrl.listar);

// Listar historial completo (incluyendo eventos de chat) - Solo administradores
router.get('/:usuarioId/completo', authRequired, permiso('editar_puntos'), historialCtrl.listarCompleto);

module.exports = router;
