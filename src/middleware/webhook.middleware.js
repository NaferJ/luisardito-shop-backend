/**
 * Middleware específico para webhooks - Simplificado
 * El CORS ahora se maneja automáticamente en cors.middleware.js
 */

const logWebhookRequest = (req, res, next) => {
    console.log('🎯🎯🎯 [WEBHOOK DETALLADO] =================================');
    console.log('🎯 Método:', req.method);
    console.log('🎯 URL completa:', req.originalUrl);
    console.log('🎯 IP origen:', req.ip || req.connection.remoteAddress);
    console.log('🎯 User-Agent:', req.headers['user-agent'] || 'NO ESPECIFICADO');
    console.log('🎯 Content-Type:', req.headers['content-type'] || 'NO ESPECIFICADO');

    // Headers específicos de Kick
    const kickHeaders = {};
    Object.keys(req.headers).forEach(key => {
        if (key.toLowerCase().startsWith('kick-event') || key.toLowerCase().includes('signature')) {
            kickHeaders[key] = req.headers[key];
        }
    });

    if (Object.keys(kickHeaders).length > 0) {
        console.log('🎯 Headers de Kick:', JSON.stringify(kickHeaders, null, 2));
    }

    // Solo mostrar el body si no es muy grande
    if (req.body) {
        const bodyStr = JSON.stringify(req.body);
        if (bodyStr.length < 1000) {
            console.log('🎯 Body:', bodyStr);
        } else {
            console.log('🎯 Body: [DEMASIADO GRANDE - ' + bodyStr.length + ' caracteres]');
        }
    }

    console.log('🎯🎯🎯 ===================================================');
    next();
};

// CORS simplificado - solo como backup (el principal ya maneja todo)
const webhookCors = (req, res, next) => {
    // Este middleware ya no es necesario porque el CORS principal
    // detecta automáticamente las peticiones de webhook
    console.log('[Webhook CORS] ✅ Pasando al CORS principal');
    next();
};

module.exports = {
    webhookCors,
    logWebhookRequest
};
