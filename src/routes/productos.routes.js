const router = require('express').Router();
const productosCtrl = require('../controllers/productos.controller');
const auth = require('../middleware/auth.middleware');
const permiso = require('../middleware/permisos.middleware');

router.get('/', productosCtrl.listar);
router.get('/debug/all', productosCtrl.debugListar); // Endpoint debug sin filtros - debe ir antes de /:id
router.get('/:id', productosCtrl.obtener);

router.post('/', auth, permiso('crear_producto'), productosCtrl.crear);
router.put('/:id', auth, permiso('editar_producto'), productosCtrl.editar);
router.delete('/:id', auth, permiso('eliminar_producto'), productosCtrl.eliminar);

module.exports = router;
