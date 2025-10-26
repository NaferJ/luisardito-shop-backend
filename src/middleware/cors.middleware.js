const cors = require('cors');

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
            'http://127.0.0.1:5173'     // Para desarrollo
        ];

        // Permitir requests sin origin (para apps móviles, Postman, etc.)
        if (!origin) return callback(null, true);

        if (allowedOrigins.includes(origin)) {
            callback(null, true);
        } else {
            console.warn(`[CORS] Origen no permitido: ${origin}`);
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
        'Access-Control-Request-Headers'
    ],
    exposedHeaders: [
        'Set-Cookie'
    ],
    maxAge: 86400 // Cache preflight por 24 horas
};

module.exports = cors(corsOptions);
