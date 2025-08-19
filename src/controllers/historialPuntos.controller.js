const { HistorialPunto } = require('../models');

exports.listar = async (req, res) => {
    try {
        const { usuarioId } = req.params;

        // Usuario normal sólo ve su propio historial
        if (req.user.rol_id > 2 && req.user.id !== +usuarioId) {
            return res.status(403).json({ error: 'Sin permiso para ver este historial' });
        }

        const registros = await HistorialPunto.findAll({
            where: { usuario_id: usuarioId },
            order: [['fecha', 'DESC']],
        });

        res.json(registros);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};
