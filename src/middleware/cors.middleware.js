const cors = require('cors');

// CORS optimizado para producción
const corsHandler = (req, res, next) => {
    // Detectar webhooks para permitir acceso completo
    const isWebhook = req.originalUrl && req.originalUrl.includes('/api/kick-webhook');

    if (isWebhook) {
        // Webhooks: permitir TODO
        res.header('Access-Control-Allow-Origin', '*');
        res.header('Access-Control-Allow-Methods', '*');
        res.header('Access-Control-Allow-Headers', '*');
        res.header('Access-Control-Allow-Credentials', 'true');
        res.header('Access-Control-Expose-Headers', '*');

        if (req.method === 'OPTIONS') {
            return res.sendStatus(200);
        }
        return next();
    }

    // Para todo lo demás: CORS específico
    return cors({
        origin: function (origin, callback) {
            const allowedOrigins = [
                'https://luisardito.com',
                'https://shop.luisardito.com',
                'https://www.luisardito.com',
                'http://localhost:3000',
                'http://localhost:3001',
                'http://localhost:3002',
                'http://localhost:5173',
                'http://127.0.0.1:3000',
                'http://127.0.0.1:3001',
                'http://127.0.0.1:3002',
                'http://127.0.0.1:5173'
            ];

            if (!origin || allowedOrigins.includes(origin) ||
                origin.endsWith('.luisardito.com') ||
                origin.includes('kick.com')) {
                callback(null, true);
            } else {
                callback(new Error('No permitido por CORS'));
            }
        },
        credentials: true,
        methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
        allowedHeaders: [
            'Content-Type', 'Authorization', 'X-Requested-With', 'Accept', 'Origin',
            'Access-Control-Request-Method', 'Access-Control-Request-Headers',
            'kick-event-message-id', 'kick-event-subscription-id', 'kick-event-signature',
            'kick-event-message-timestamp', 'kick-event-type', 'kick-event-version', 'User-Agent'
        ],
        exposedHeaders: ['Set-Cookie'],
        maxAge: 86400
    })(req, res, next);
};

module.exports = corsHandler;


