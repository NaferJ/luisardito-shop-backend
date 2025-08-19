const router = require('express').Router();
const usuariosCtrl = require('../controllers/usuarios.controller');
const auth = require('../middleware/auth.middleware');

// Obtener perfil del usuario logueado
router.get('/me', auth, usuariosCtrl.me);

// (Opcional) Actualizar perfil
router.put('/me', auth, usuariosCtrl.updateMe);

module.exports = router;
