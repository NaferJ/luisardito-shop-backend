const router = require('express').Router();
const canjesCtrl = require('../controllers/canjes.controller');
const auth = require('../middleware/auth.middleware');
const permiso = require('../middleware/permisos.middleware');

router.post('/', auth, permiso('canjear_productos'), canjesCtrl.crear);
// Ruta para Mis Canjes: siempre retorna solo los del usuario autenticado
router.get('/mios', auth, permiso('ver_canjes'), canjesCtrl.listarMios);
// Ruta global (admin/gestión): comportamiento existente
router.get('/',  auth, permiso('ver_canjes'), canjesCtrl.listar);
router.put('/:id', auth, permiso('gestionar_canjes'), canjesCtrl.actualizarEstado);
// Nueva ruta: devolver canje (refunda puntos y marca como devuelto)
router.put('/:id/devolver', auth, permiso('gestionar_canjes'), canjesCtrl.devolverCanje);

module.exports = router;