const cors = require('cors');

// Función personalizada para manejar CORS de manera dinámica
const corsHandler = (req, res, next) => {
    // 🔥 PRIORIDAD MÁXIMA: Si es webhook, permitir TODO automáticamente
    if (req.originalUrl && req.originalUrl.includes('/api/kick-webhook')) {
        console.log('🎯 [CORS] Detectada petición de webhook - PERMITIENDO TODO');
        res.header('Access-Control-Allow-Origin', '*');
        res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
        res.header('Access-Control-Allow-Headers',
            'Origin, X-Requested-With, Content-Type, Accept, Authorization, ' +
            'kick-event-message-id, kick-event-subscription-id, kick-event-signature, ' +
            'kick-event-message-timestamp, kick-event-type, kick-event-version, User-Agent'
        );

        if (req.method === 'OPTIONS') {
            console.log('🎯 [CORS] Manejando preflight para webhook');
            return res.sendStatus(200);
        }
        return next();
    }

    // Para todas las demás peticiones, usar la lógica normal de CORS
    return cors(corsOptions)(req, res, next);
};

const corsOptions = {
    origin: function (origin, callback) {
        // Permitir requests de subdominios de luisardito.com
        const allowedOrigins = [
            'https://luisardito.com',
            'https://shop.luisardito.com',
            'https://www.luisardito.com',
            'http://localhost:3000',    // Para desarrollo
            'http://localhost:3001',    // Backend (auto-referencia)
            'http://localhost:3002',    // Frontend desarrollo actual
            'http://localhost:5173',    // Vite dev server
            'http://127.0.0.1:3000',    // Para desarrollo
            'http://127.0.0.1:3001',    // Backend (auto-referencia)
            'http://127.0.0.1:3002',    // Frontend desarrollo actual
            'http://127.0.0.1:5173',    // Para desarrollo
            // Dominios adicionales de Kick
            'https://kick.com',
            'https://www.kick.com',
            'https://api.kick.com',
            'https://webhooks.kick.com',
            'https://events.kick.com',
            'https://notifications.kick.com'
        ];

        // IMPORTANTE: Permitir requests sin origin (webhooks, apps móviles, Postman, etc.)
        // Los webhooks de Kick pueden no incluir el header Origin
        if (!origin) {
            console.log('[CORS] Permitiendo request sin Origin (webhook/API/Postman)');
            return callback(null, true);
        }

        // Verificar si el origin está en la lista permitida
        if (allowedOrigins.includes(origin)) {
            console.log(`[CORS] Origin permitido: ${origin}`);
            callback(null, true);
        } else {
            // Para webhooks de Kick, permitir cualquier subdominio/IP de kick.com
            if (origin.endsWith('.kick.com') ||
                origin.includes('kick') ||
                origin.includes('127.0.0.1') ||
                origin.includes('localhost') ||
                // IPs comunes de servicios de webhooks
                /^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}/.test(origin)) {
                console.log(`[CORS] Origin especial permitido: ${origin}`);
                return callback(null, true);
            }

            console.warn(`[CORS] Origen NO permitido: ${origin}`);
            callback(new Error('No permitido por CORS'));
        }
    },
    credentials: true, // IMPORTANTE: Permitir cookies cross-origin
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: [
        'Content-Type',
        'Authorization',
        'X-Requested-With',
        'Accept',
        'Origin',
        'Access-Control-Request-Method',
        'Access-Control-Request-Headers',
        // Headers específicos de webhooks de Kick
        'kick-event-message-id',
        'kick-event-subscription-id',
        'kick-event-signature',
        'kick-event-message-timestamp',
        'kick-event-type',
        'kick-event-version',
        'User-Agent'
    ],
    exposedHeaders: [
        'Set-Cookie'
    ],
    maxAge: 86400 // Cache preflight por 24 horas
};

module.exports = corsHandler;


