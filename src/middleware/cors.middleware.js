const cors = require('cors');

// 🧪 MODO TEST PRODUCCIÓN: CORS ultra-permisivo para debugging de webhooks
const corsHandler = (req, res, next) => {
    // Solo log para webhooks y requests importantes
    const isWebhook = req.originalUrl && req.originalUrl.includes('/api/kick-webhook');
    const isImportant = isWebhook || req.originalUrl.includes('/health') === false;

    if (isImportant) {
        console.log(`🔍 [CORS] ${req.method} ${req.originalUrl} - Origin: ${req.headers.origin || 'SIN ORIGIN'}`);
    }

    // Permitir cualquier origen (TEMPORAL para debugging)
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', '*');
    res.header('Access-Control-Allow-Headers', '*');
    res.header('Access-Control-Allow-Credentials', 'true');
    res.header('Access-Control-Expose-Headers', '*');

    // Manejar preflight
    if (req.method === 'OPTIONS') {
        if (isWebhook) {
            console.log('🔍 [CORS] Manejando OPTIONS para webhook');
        }
        return res.sendStatus(200);
    }

    next();
};

module.exports = corsHandler;


