/**
 * 🚨 MODO DEBUG: Middleware ultra-simplificado para webhooks
 * Solo logging - SIN restricciones de CORS
 */

const logWebhookRequest = (req, res, next) => {
    console.log('🚨🚨🚨 [WEBHOOK DEBUG] ===================================');
    console.log('🚨 PETICIÓN RECIBIDA EN:', req.originalUrl);
    console.log('🚨 Método:', req.method);
    console.log('🚨 IP:', req.ip || req.connection.remoteAddress || 'DESCONOCIDA');
    console.log('🚨 User-Agent:', req.headers['user-agent'] || 'NO ESPECIFICADO');
    console.log('🚨 Origin:', req.headers.origin || 'SIN ORIGIN');
    console.log('🚨 Content-Type:', req.headers['content-type'] || 'NO ESPECIFICADO');

    // Mostrar TODOS los headers
    console.log('🚨 TODOS LOS HEADERS:', JSON.stringify(req.headers, null, 2));

    // Mostrar el body si existe
    if (req.body && Object.keys(req.body).length > 0) {
        console.log('🚨 BODY:', JSON.stringify(req.body, null, 2));
    } else {
        console.log('🚨 BODY: VACÍO O NO PARSEADO');
    }

    console.log('🚨🚨🚨 =============================================');
    next();
};

// CORS completamente permisivo - solo como backup
const webhookCors = (req, res, next) => {
    console.log('🚨 [Webhook CORS] Permitiendo TODO');
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', '*');
    res.header('Access-Control-Allow-Headers', '*');

    if (req.method === 'OPTIONS') {
        return res.sendStatus(200);
    }

    next();
};

module.exports = {
    webhookCors,
    logWebhookRequest
};
