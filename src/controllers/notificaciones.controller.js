const NotificacionService = require('../services/notificacion.service');
const logger = require('../utils/logger');

exports.listar = async (req, res) => {
    try {
        const { page = 1, limit = 20, tipo = null, estado = null } = req.query;
        const usuarioId = req.user.id;

        const resultado = await NotificacionService.listar(
            usuarioId,
            parseInt(page),
            parseInt(limit),
            tipo,
            estado
        );

        res.json(resultado);
    } catch (error) {
        logger.error(`[Notificaciones] Error listing: ${error.message}`);
        res.status(500).json({ error: error.message });
    }
};

exports.obtenerDetalle = async (req, res) => {
    try {
        const { id } = req.params;
        const usuarioId = req.user.id;

        const notificacion = await NotificacionService.obtenerDetalle(id, usuarioId);

        // Mark as read automatically when viewing details
        if (notificacion.estado === 'no_leida') {
            await NotificacionService.marcarComoLeida(id, usuarioId);
            notificacion.estado = 'leida';
            notificacion.fecha_lectura = new Date();
        }

        res.json(notificacion);
    } catch (error) {
        logger.error(`[Notificaciones] Error fetching detail: ${error.message}`);
        res.status(404).json({ error: error.message });
    }
};

exports.marcarComoLeida = async (req, res) => {
    try {
        const { id } = req.params;
        const usuarioId = req.user.id;

        const notificacion = await NotificacionService.marcarComoLeida(id, usuarioId);

        res.json({
            mensaje: 'Notification marked as read',
            notificacion
        });
    } catch (error) {
        logger.error(`[Notificaciones] Error marking as read: ${error.message}`);
        res.status(404).json({ error: error.message });
    }
};

exports.marcarTodasComoLeidas = async (req, res) => {
    try {
        const usuarioId = req.user.id;

        const resultado = await NotificacionService.marcarTodasComoLeidas(usuarioId);

        res.json({
            mensaje: 'All notifications marked as read',
            ...resultado
        });
    } catch (error) {
        logger.error(`[Notificaciones] Error marking all as read: ${error.message}`);
        res.status(500).json({ error: error.message });
    }
};

exports.eliminar = async (req, res) => {
    try {
        const { id } = req.params;
        const usuarioId = req.user.id;

        const resultado = await NotificacionService.eliminar(id, usuarioId);

        res.json(resultado);
    } catch (error) {
        logger.error(`[Notificaciones] Error deleting: ${error.message}`);
        res.status(404).json({ error: error.message });
    }
};

exports.contarNoLeidas = async (req, res) => {
    try {
        const usuarioId = req.user.id;

        const resultado = await NotificacionService.contarNoLeidas(usuarioId);

        res.json(resultado);
    } catch (error) {
        logger.error(`[Notificaciones] Error counting unread: ${error.message}`);
        res.status(500).json({ error: error.message });
    }
};

