const { Permiso, RolPermiso } = require('../models');

module.exports = function(verboPermiso) {
    return async (req, res, next) => {
        const permisos = await Permiso.findAll({
            include: { model: RolPermiso, where: { rol_id: req.user.rol_id } }
        });
        const nombres = permisos.map(p => p.nombre);
        if (nombres.includes(verboPermiso)) return next();
        res.status(403).json({ error: 'Sin permiso' });
    };
};
