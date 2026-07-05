const { HistorialPunto } = require("../models");
const { Op } = require("sequelize");
const { sequelize } = require("../models/database");

exports.listar = async (req, res) => {
  try {
    const { usuarioId } = req.params;

    // Regular users only see their own history
    // Roles 1-2 (user, subscriber) can only see their own history
    // Roles 3+ (streamer, developer, moderator) can see any history
    if (req.user.rol_id <= 2 && req.user.id !== +usuarioId) {
      return res
        .status(403)
        .json({ error: "No permission to view this history" });
    }

    const { include_all = "false" } = req.query;
    const isAdmin = req.user.rol_id >= 3;
    const showAllEvents = include_all === "true" && isAdmin;

    let whereClause = { usuario_id: usuarioId };

    // If not admin or not requesting all, filter events
    if (!showAllEvents) {
      // Simplified filter: show everything except automatic chat messages
      whereClause = {
        usuario_id: usuarioId,
        [Op.or]: [
          // Show all events without kick_event_data (redemptions, manual adjustments, etc.)
          { kick_event_data: null },
          // Show important events, exclude automatic chat
          {
            [Op.and]: [
              { kick_event_data: { [Op.ne]: null } },
              {
                [Op.or]: [
                  // MySQL JSON syntax to exclude chat messages
                  sequelize.literal(
                    `JSON_EXTRACT(kick_event_data, '$.event_type') != 'chat.message.sent'`
                  ),
                  // If it has no event_type, show it
                  sequelize.literal(
                    `JSON_EXTRACT(kick_event_data, '$.event_type') IS NULL`
                  ),
                ],
              },
            ],
          },
        ],
      };
    }

    const registros = await HistorialPunto.findAll({
      where: whereClause,
      order: [["fecha", "DESC"]],
    });

    res.json(registros);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

/**
 * List full history (including chat events) - Admins only
 */
exports.listarCompleto = async (req, res) => {
  try {
    const { usuarioId } = req.params;

    // The permission middleware already validates the 'editar_puntos' permission
    // No additional validation needed here

    const registros = await HistorialPunto.findAll({
      where: { usuario_id: usuarioId },
      order: [["fecha", "DESC"]],
    });

    res.json(registros);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
