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
        logger.error(`[Notificaciones] Error listando: ${error.message}`);
        res.status(500).json({ error: error.message });
    }
};

exports.obtenerDetalle = async (req, res) => {
    try {
        const { id } = req.params;
        const usuarioId = req.user.id;

        const notificacion = await NotificacionService.obtenerDetalle(id, usuarioId);

        // Marcar como leída automáticamente al ver el detalle
        if (notificacion.estado === 'no_leida') {
            await NotificacionService.marcarComoLeida(id, usuarioId);
            notificacion.estado = 'leida';
            notificacion.fecha_lectura = new Date();
        }

        res.json(notificacion);
    } catch (error) {
        logger.error(`[Notificaciones] Error obteniendo detalle: ${error.message}`);
        res.status(404).json({ error: error.message });
    }
};

exports.marcarComoLeida = async (req, res) => {
    try {
        const { id } = req.params;
        const usuarioId = req.user.id;

        const notificacion = await NotificacionService.marcarComoLeida(id, usuarioId);

        res.json({
            mensaje: 'Notificación marcada como leída',
            notificacion
        });
    } catch (error) {
        logger.error(`[Notificaciones] Error marcando como leída: ${error.message}`);
        res.status(404).json({ error: error.message });
    }
};

exports.marcarTodasComoLeidas = async (req, res) => {
    try {
        const usuarioId = req.user.id;

        const resultado = await NotificacionService.marcarTodasComoLeidas(usuarioId);

        res.json({
            mensaje: 'Todas las notificaciones marcadas como leídas',
            ...resultado
        });
    } catch (error) {
        logger.error(`[Notificaciones] Error marcando todas: ${error.message}`);
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
        logger.error(`[Notificaciones] Error eliminando: ${error.message}`);
        res.status(404).json({ error: error.message });
    }
};

exports.contarNoLeidas = async (req, res) => {
    try {
        const usuarioId = req.user.id;

        const resultado = await NotificacionService.contarNoLeidas(usuarioId);

        res.json(resultado);
    } catch (error) {
        logger.error(`[Notificaciones] Error contando no leídas: ${error.message}`);
        res.status(500).json({ error: error.message });
    }
};

