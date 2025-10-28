const { HistorialPunto } = require('../models');
const { Op } = require('sequelize');
const { sequelize } = require('../models/database');

exports.listar = async (req, res) => {
    try {
        const { usuarioId } = req.params;

        // Usuario normal sólo ve su propio historial
        // Roles 1-2 (usuario, suscriptor) solo pueden ver su propio historial
        // Roles 3+ (streamer, developer, moderador) pueden ver cualquier historial
        if (req.user.rol_id <= 2 && req.user.id !== +usuarioId) {
            return res.status(403).json({ error: 'Sin permiso para ver este historial' });
        }

        const { include_all = 'false' } = req.query;
        const isAdmin = req.user.rol_id >= 3;
        const showAllEvents = include_all === 'true' && isAdmin;

        let whereClause = { usuario_id: usuarioId };

        // Si no es admin o no solicita ver todo, filtrar eventos
        if (!showAllEvents) {
            // Filtro simplificado: mostrar todo excepto mensajes de chat automáticos
            whereClause = {
                usuario_id: usuarioId,
                [Op.or]: [
                    // Mostrar todos los eventos sin kick_event_data (canjes, ajustes manuales, etc.)
                    { kick_event_data: null },
                    // Mostrar eventos importantes, excluir chat automático
                    {
                        [Op.and]: [
                            { kick_event_data: { [Op.ne]: null } },
                            {
                                [Op.or]: [
                                    // MySQL JSON syntax para excluir chat messages
                                    sequelize.literal(`JSON_EXTRACT(kick_event_data, '$.event_type') != 'chat.message.sent'`),
                                    // Si no tiene event_type, mostrar
                                    sequelize.literal(`JSON_EXTRACT(kick_event_data, '$.event_type') IS NULL`)
                                ]
                            }
                        ]
                    }
                ]
            };
        }

        const registros = await HistorialPunto.findAll({
            where: whereClause,
            order: [['fecha', 'DESC']]
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

