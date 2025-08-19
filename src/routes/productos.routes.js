const router = require('express').Router();
const productosCtrl = require('../controllers/productos.controller');
const auth = require('../middleware/auth.middleware');
const permiso = require('../middleware/permisos.middleware');

router.get('/', productosCtrl.listar);
router.get('/:id', productosCtrl.obtener);

router.post('/', auth, permiso('crear_producto'), productosCtrl.crear);
router.put('/:id', auth, permiso('editar_producto'), productosCtrl.editar);
router.delete('/:id', auth, permiso('eliminar_producto'), productosCtrl.eliminar);

module.exports = router;
