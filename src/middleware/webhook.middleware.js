/**
 * Middleware para webhooks - Optimizado para producción
 */

const logWebhookRequest = (req, res, next) => {
    // Solo log para webhooks reales de Kick
    const hasKickHeaders = Object.keys(req.headers).some(key =>
        key.toLowerCase().startsWith('kick-event')
    );

    if (hasKickHeaders || req.body?.test) {
        console.log('🎯 [WEBHOOK]', new Date().toISOString(), req.method, req.originalUrl);

        const kickHeaders = {};
        Object.keys(req.headers).forEach(key => {
            if (key.toLowerCase().startsWith('kick-event')) {
                kickHeaders[key] = req.headers[key];
            }
        });

        if (Object.keys(kickHeaders).length > 0) {
            console.log('🎯 [KICK HEADERS]', kickHeaders);
        }

        if (req.body && Object.keys(req.body).length > 0) {
            console.log('🎯 [PAYLOAD]', JSON.stringify(req.body).substring(0, 200) + '...');
        }
    }

    next();
};

const webhookCors = (req, res, next) => {
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
