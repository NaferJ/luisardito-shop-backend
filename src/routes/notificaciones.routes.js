const router = require('express').Router();
const notificacionesCtrl = require('../controllers/notificaciones.controller');
const authRequired = require('../middleware/authRequired.middleware');

// ✅ Todas las rutas requieren autenticación

// Listar notificaciones del usuario autenticado (paginadas)
// Parámetros query: page (default 1), limit (default 20, máximo 100), tipo (filtro), estado (filtro)
router.get('/', authRequired, notificacionesCtrl.listar);

// Contar notificaciones no leídas (sin contar la de obtener detalle)
router.get('/no-leidas/contar', authRequired, notificacionesCtrl.contarNoLeidas);

// Obtener detalle de una notificación específica (y marca como leída automáticamente)
router.get('/:id', authRequired, notificacionesCtrl.obtenerDetalle);

// Marcar una notificación como leída
router.patch('/:id/leido', authRequired, notificacionesCtrl.marcarComoLeida);

// Marcar todas las notificaciones como leídas
router.patch('/leer-todas', authRequired, notificacionesCtrl.marcarTodasComoLeidas);

// Eliminar una notificación (soft delete)
router.delete('/:id', authRequired, notificacionesCtrl.eliminar);

module.exports = router;

