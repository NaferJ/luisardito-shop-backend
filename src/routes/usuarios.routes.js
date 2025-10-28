const router = require('express').Router();
const usuariosCtrl = require('../controllers/usuarios.controller');
const canjesCtrl = require('../controllers/canjes.controller');
const auth = require('../middleware/auth.middleware');
const permiso = require('../middleware/permisos.middleware');

// Obtener perfil del usuario logueado
router.get('/me', auth, usuariosCtrl.me);

// (Opcional) Actualizar perfil
router.put('/me', auth, usuariosCtrl.updateMe);

// Sincronizar información de Kick (avatar, username, etc.)
router.post('/sync-kick-info', auth, usuariosCtrl.syncKickInfo);

// Listar todos los usuarios (admin por permiso)
router.get('/', auth, permiso('ver_usuarios'), usuariosCtrl.listarUsuarios);

// Canjes de un usuario específico (admin/gestión)
router.get('/:usuarioId/canjes', auth, permiso('gestionar_canjes'), canjesCtrl.listarPorUsuario);

// Actualizar puntos de un usuario específico (admin por permiso)
router.put('/:id/puntos', auth, permiso('editar_puntos'), usuariosCtrl.actualizarPuntos);

// 🔍 DEBUG: Verificar estructura de roles y permisos
router.get('/debug/roles-permisos', usuariosCtrl.debugRolesPermisos);

// 🔍 DEBUG: Verificar usuario específico por ID
router.get('/debug/:usuarioId', usuariosCtrl.debugUsuario);

// 🔧 HOTFIX: Actualizar rol de usuario específico (temporal)
router.put('/hotfix/:usuarioId/rol/:nuevoRolId', usuariosCtrl.hotfixActualizarRol);

module.exports = router;
