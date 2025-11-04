const { Permiso, RolPermiso } = require('../models');

module.exports = function(verboPermiso) {
    return async (req, res, next) => {
        // ✅ FIX: Validar que req.user exista antes de acceder a rol_id
        if (!req.user) {
            return res.status(401).json({
                error: 'Autenticación requerida',
                message: 'Debes iniciar sesión para acceder a este recurso'
            });
        }

        const permisos = await Permiso.findAll({
            include: { model: RolPermiso, where: { rol_id: req.user.rol_id } }
        });
        const nombres = permisos.map(p => p.nombre);
        if (nombres.includes(verboPermiso)) return next();

        res.status(403).json({
            error: 'Sin permiso',
            message: `No tienes el permiso necesario: ${verboPermiso}`
        });
    };
};
