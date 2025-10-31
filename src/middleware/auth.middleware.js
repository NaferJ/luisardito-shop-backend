const jwt = require('jsonwebtoken');
const config = require('../../config');
const { Usuario, Rol } = require('../models');

module.exports = async (req, res, next) => {
  try {
    // ✅ 1. Buscar en COOKIES primero
    let token = req.cookies?.auth_token;
    
    // ✅ 2. Fallback a Authorization header
    if (!token && req.headers?.authorization?.startsWith('Bearer ')) {
      token = req.headers.authorization.split(' ')[1];
    }
    
    // ✅ 3. Si no hay token, permitir pasar (no es error)
    if (!token) {
      req.user = null;
      return next();
    }
    
    // Verificar token y obtener usuario
    const payload = jwt.verify(token, config.jwtSecret);
    const user = await Usuario.findByPk(payload.userId, { include: Rol });
    
    if (!user) {
      req.user = null;
      return next();
    }
    
    // Usuario autenticado correctamente
    req.user = user;
    console.log('[Auth Middleware] ✅ Usuario autenticado:', user.nickname || user.id);
    next();
    
  } catch (error) {
    // ✅ 4. Si falla la verificación, permitir pasar (no es error)
    console.error('[Auth Middleware] Error:', error.message);
    req.user = null;
    next();
  }
};
