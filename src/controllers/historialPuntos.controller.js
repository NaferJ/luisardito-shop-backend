const { HistorialPunto } = require('../models');
const { Op } = require('sequelize');

exports.listar = async (req, res) => {
    try {
        const { usuarioId } = req.params;

        // Usuario normal sólo ve su propio historial
        // Roles 1-2 (usuario, suscriptor) solo pueden ver su propio historial
        // Roles 3+ (streamer, developer, moderador) pueden ver cualquier historial
        if (req.user.rol_id <= 2 && req.user.id !== +usuarioId) {
            return res.status(403).json({ error: 'Sin permiso para ver este historial' });
        }

        const registros = await HistorialPunto.findAll({
            where: {
                usuario_id: usuarioId,
                [Op.or]: [
                    // Mostrar todos los eventos sin kick_event_data (canjes, ajustes manuales)
                    { kick_event_data: null },
                    // Mostrar eventos importantes específicos
                    {
                        kick_event_data: {
                            [Op.or]: [
                                // Migración de Botrix (importante para el usuario)
                                { event_type: 'botrix_migration' },
                                // Eventos VIP (importantes)
                                { event_type: 'vip_granted' },
                                { event_type: 'vip_removed' },
                                // Primer follow (evento único)
                                { event_type: 'channel.followed' },
                                // Suscripciones (eventos importantes)
                                { event_type: 'channel.subscription.new' },
                                { event_type: 'channel.subscription.renewal' },
                                { event_type: 'channel.subscription.gifts' }
                            ]
                        }
                    }
                ]
            },
            order: [['fecha', 'DESC']],
        });

        res.json(registros);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

/**
 * Listar historial completo (incluyendo eventos de chat) - Solo para administradores
 */
exports.listarCompleto = async (req, res) => {
    try {
        const { usuarioId } = req.params;

        // El middleware de permisos ya valida que tenga el permiso 'editar_puntos'
        // No necesitamos validación adicional aquí

        const registros = await HistorialPunto.findAll({
            where: { usuario_id: usuarioId },
            order: [['fecha', 'DESC']],
        });

        res.json(registros);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

