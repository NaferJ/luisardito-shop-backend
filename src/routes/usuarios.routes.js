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

// 🔍 DEBUG: Verificar permisos del usuario actual
router.get('/me/debug-permisos', auth, usuariosCtrl.debugPermisos);

// 🔍 DEBUG: Verificar estructura de roles y permisos (sin auth)
router.get('/debug/roles-permisos', usuariosCtrl.debugRolesPermisos);

// 🔍 DEBUG: Verificar usuario específico por ID (sin auth)
router.get('/debug/:usuarioId', usuariosCtrl.debugUsuarioEspecifico);

module.exports = router;
