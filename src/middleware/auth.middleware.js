const jwt    = require('jsonwebtoken');
const config = require('../../config');
const { Usuario, Rol } = require('../models');

module.exports = async (req, res, next) => {
    const header = req.headers.authorization;
    if (!header?.startsWith('Bearer ')) return res.status(401).json({ error: 'Token faltante' });

    const token = header.split(' ')[1];
    try {
        const payload = jwt.verify(token, config.jwtSecret);
        const user = await Usuario.findByPk(payload.userId, { include: Rol });
        if (!user) return res.status(401).json({ error: 'Usuario no encontrado' });
        req.user = user;
        next();
    } catch {
        res.status(401).json({ error: 'Token inválido' });
    }
};
