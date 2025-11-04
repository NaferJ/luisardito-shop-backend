const router = require('express').Router();
const usuariosCtrl = require('../controllers/usuarios.controller');
const canjesCtrl = require('../controllers/canjes.controller');
const auth = require('../middleware/auth.middleware');
const authRequired = require('../middleware/authRequired.middleware');
const permiso = require('../middleware/permisos.middleware');

// ✅ Rutas protegidas - Requieren autenticación estricta

// Obtener perfil del usuario logueado
router.get('/me', authRequired, usuariosCtrl.me);

// Actualizar perfil del usuario logueado
router.put('/me', authRequired, usuariosCtrl.updateMe);

// Sincronizar información de Kick (avatar, username, etc.)
router.post('/sync-kick-info', authRequired, usuariosCtrl.syncKickInfo);

// ✅ Rutas protegidas con permisos específicos

// Listar todos los usuarios (admin)
router.get('/', authRequired, permiso('ver_usuarios'), usuariosCtrl.listarUsuarios);

// Canjes de un usuario específico (admin/gestión)
router.get('/:usuarioId/canjes', authRequired, permiso('gestionar_canjes'), canjesCtrl.listarPorUsuario);

// Actualizar puntos de un usuario específico (admin)
router.put('/:id/puntos', authRequired, permiso('editar_puntos'), usuariosCtrl.actualizarPuntos);

// ✅ Rutas públicas (debug/testing - considerar proteger en producción)

// Debug: Verificar estructura de roles y permisos
router.get('/debug/roles-permisos', usuariosCtrl.debugRolesPermisos);

// Debug: Verificar usuario específico por ID
router.get('/debug/:usuarioId', usuariosCtrl.debugUsuario);

// Hotfix: Actualizar rol de usuario específico (temporal - considerar proteger)
router.put('/hotfix/:usuarioId/rol/:nuevoRolId', usuariosCtrl.hotfixActualizarRol);

module.exports = router;
