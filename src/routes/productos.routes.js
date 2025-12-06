const router = require('express').Router();
const productosCtrl = require('../controllers/productos.controller');
const auth = require('../middleware/auth.middleware');
const authRequired = require('../middleware/authRequired.middleware');
const permiso = require('../middleware/permisos.middleware');

// ✅ Rutas públicas - Sin autenticación requerida
router.get('/', productosCtrl.listar);

// ⚠️ IMPORTANTE: Rutas específicas DEBEN ir ANTES de rutas con parámetros (/:id)
// Si no, Express confunde "admin" o "debug" como un ID

// Rutas específicas primero
router.get('/debug/all', productosCtrl.debugListar); // Debug endpoint
router.get('/admin', authRequired, permiso('gestionar_canjes'), productosCtrl.listarAdmin); // Admin

// ✅ Rutas con autenticación opcional (rutas específicas)
router.get('/slug/:slug', auth, productosCtrl.obtenerPorSlug);

// ✅ Rutas con parámetros dinámicos (DEBEN IR AL FINAL)
router.get('/:id', productosCtrl.obtener); // ← Esta debe ir al final

// ✅ Rutas protegidas con modificación
router.post('/', authRequired, permiso('crear_producto'), productosCtrl.crear);
router.put('/:id', authRequired, permiso('editar_producto'), productosCtrl.editar);
router.put('/:id/promociones', authRequired, permiso('editar_producto'), productosCtrl.actualizarPromociones);
router.delete('/:id', authRequired, permiso('eliminar_producto'), productosCtrl.eliminar);

module.exports = router;
