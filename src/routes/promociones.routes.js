const router = require('express').Router();
const promocionesCtrl = require('../controllers/promociones.controller');
const authRequired = require('../middleware/authRequired.middleware');
const auth = require('../middleware/auth.middleware');
const permiso = require('../middleware/permisos.middleware');

// ========================================
// RUTAS PÚBLICAS
// ========================================

/**
 * GET /api/promociones/activas
 * Obtener todas las promociones activas (público)
 */
router.get('/activas', promocionesCtrl.obtenerPromocionesActivas);

/**
 * POST /api/promociones/validar-codigo
 * Validar un código de promoción
 * Requiere: { codigo: string, producto_id?: number }
 */
router.post('/validar-codigo', auth, promocionesCtrl.validarCodigo);

// ========================================
// RUTAS PROTEGIDAS - ADMIN
// ========================================

/**
 * GET /api/promociones
 * Listar todas las promociones con filtros
 * Query params: estado, tipo, activas_solo
 * Permiso: gestionar_promociones
 */
router.get('/', authRequired, permiso('gestionar_productos'), promocionesCtrl.listar);

/**
 * POST /api/promociones
 * Crear nueva promoción
 * Permiso: gestionar_promociones
 */
router.post('/', authRequired, permiso('gestionar_productos'), promocionesCtrl.crear);

/**
 * GET /api/promociones/exportar-pdf
 * Exportar promociones a PDF
 * Query params: estado, activas_solo
 * Permiso: gestionar_promociones
 */
router.get('/exportar-pdf', authRequired, permiso('gestionar_productos'), promocionesCtrl.exportarPDF);

/**
 * PUT /api/promociones/actualizar-estados
 * Actualizar estados de promociones (manual)
 * Permiso: gestionar_promociones
 */
router.put('/actualizar-estados', authRequired, permiso('gestionar_productos'), promocionesCtrl.actualizarEstados);

/**
 * GET /api/promociones/producto/:productoId
 * Obtener todas las promociones asignadas a un producto
 * Permiso: gestionar_productos
 */
router.get('/producto/:productoId', authRequired, permiso('gestionar_productos'), promocionesCtrl.obtenerPromocionesProducto);

/**
 * GET /api/promociones/:id
 * Obtener una promoción específica
 * Permiso: gestionar_promociones
 */
router.get('/:id', authRequired, permiso('gestionar_productos'), promocionesCtrl.obtener);

/**
 * PUT /api/promociones/:id
 * Actualizar promoción existente
 * Permiso: gestionar_promociones
 */
router.put('/:id', authRequired, permiso('gestionar_productos'), promocionesCtrl.actualizar);

/**
 * DELETE /api/promociones/:id
 * Eliminar promoción (soft delete - marca como inactivo)
 * Permiso: gestionar_promociones
 */
router.delete('/:id', authRequired, permiso('gestionar_productos'), promocionesCtrl.eliminar);

/**
 * DELETE /api/promociones/:id/permanente
 * Eliminar promoción permanentemente
 * Permiso: gestionar_promociones
 */
router.delete('/:id/permanente', authRequired, permiso('gestionar_productos'), promocionesCtrl.eliminarPermanente);

/**
 * GET /api/promociones/:id/estadisticas
 * Obtener estadísticas de una promoción
 * Permiso: gestionar_promociones
 */
router.get('/:id/estadisticas', authRequired, permiso('gestionar_productos'), promocionesCtrl.obtenerEstadisticas);

/**
 * POST /api/promociones/:promocionId/productos
 * Asignar productos a una promoción
 * Body: { producto_ids: number[] }
 * Permiso: gestionar_productos
 */
router.post('/:promocionId/productos', authRequired, permiso('gestionar_productos'), promocionesCtrl.asignarProductos);

/**
 * DELETE /api/promociones/:promocionId/productos/:productoId
 * Desasignar un producto de una promoción
 * Permiso: gestionar_productos
 */
router.delete('/:promocionId/productos/:productoId', authRequired, permiso('gestionar_productos'), promocionesCtrl.desasignarProducto);

module.exports = router;
