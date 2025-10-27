const cors = require('cors');

// 🚨 MODO DEBUG: PERMITIR TODO SIN RESTRICCIONES
// Temporalmente para probar si el CORS es el problema con los webhooks

const corsHandler = (req, res, next) => {
    console.log('🚨 [CORS DEBUG] Permitiendo TODO sin restricciones');

    // Permitir cualquier origen
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', '*');
    res.header('Access-Control-Allow-Headers', '*');
    res.header('Access-Control-Allow-Credentials', 'true');
    res.header('Access-Control-Expose-Headers', '*');

    // Manejar preflight
    if (req.method === 'OPTIONS') {
        console.log('🚨 [CORS DEBUG] Manejando OPTIONS - permitiendo TODO');
        return res.sendStatus(200);
    }

    console.log('🚨 [CORS DEBUG] Petición permitida:', req.method, req.originalUrl);
    next();
};

module.exports = corsHandler;


