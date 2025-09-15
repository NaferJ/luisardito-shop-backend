const router = require('express').Router();
const usuariosCtrl = require('../controllers/usuarios.controller');
const auth = require('../middleware/auth.middleware');
const permiso = require('../middleware/permisos.middleware');

// Obtener perfil del usuario logueado
router.get('/me', auth, usuariosCtrl.me);

// (Opcional) Actualizar perfil
router.put('/me', auth, usuariosCtrl.updateMe);

// Listar todos los usuarios (admin por permiso)
router.get('/', auth, permiso('ver_usuarios'), usuariosCtrl.listarUsuarios);

// Actualizar puntos de un usuario específico (admin por permiso)
router.put('/:id/puntos', auth, permiso('editar_puntos'), usuariosCtrl.actualizarPuntos);

module.exports = router;
