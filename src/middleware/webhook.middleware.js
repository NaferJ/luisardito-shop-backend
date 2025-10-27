/**
 * 🧪 MODO TEST PRODUCCIÓN: Logging optimizado para webhooks
 */

const logWebhookRequest = (req, res, next) => {
    console.log('🎯🎯🎯 [WEBHOOK] ============================================');
    console.log('🎯 TIMESTAMP:', new Date().toISOString());
    console.log('🎯 MÉTODO:', req.method, '| URL:', req.originalUrl);
    console.log('🎯 IP ORIGEN:', req.ip || req.connection.remoteAddress || 'DESCONOCIDA');
    console.log('🎯 USER-AGENT:', req.headers['user-agent'] || 'NO ESPECIFICADO');
    console.log('🎯 ORIGIN:', req.headers.origin || 'SIN ORIGIN');
    console.log('🎯 CONTENT-TYPE:', req.headers['content-type'] || 'NO ESPECIFICADO');

    // Headers específicos de Kick
    const kickHeaders = Object.keys(req.headers)
        .filter(key => key.toLowerCase().startsWith('kick-event'))
        .reduce((obj, key) => {
            obj[key] = req.headers[key];
            return obj;
        }, {});

    if (Object.keys(kickHeaders).length > 0) {
        console.log('🎯 HEADERS DE KICK:', JSON.stringify(kickHeaders, null, 2));
    } else {
        console.log('🎯 HEADERS DE KICK: NINGUNO');
    }

    // Body (limitado para evitar spam)
    if (req.body && Object.keys(req.body).length > 0) {
        const bodyStr = JSON.stringify(req.body, null, 2);
        if (bodyStr.length > 500) {
            console.log('🎯 BODY: [GRANDE - ' + bodyStr.length + ' chars] ' + bodyStr.substring(0, 200) + '...');
        } else {
            console.log('🎯 BODY:', bodyStr);
        }
    } else {
        console.log('🎯 BODY: VACÍO');
    }

    console.log('🎯🎯🎯 ====================================================');
    next();
};

// CORS backup (aunque el principal ya maneja todo)
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
