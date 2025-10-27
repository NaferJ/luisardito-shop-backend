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
                // Filtrar eventos de chat - solo mostrar recompensas importantes
                [Op.or]: [
                    // Registros sin datos de Kick (canjes, ajustes manuales, etc.)
                    { kick_event_data: null },
                    // Solo eventos importantes de Kick (follows, subs, etc.) - excluir chat
                    {
                        kick_event_data: {
                            event_type: {
                                [Op.ne]: 'chat.message.sent'
                            }
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

