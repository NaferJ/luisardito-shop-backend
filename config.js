require('dotenv').config();

const toBool = (val, def = false) => {
    if (val === undefined) return def;
    return /^(1|true|yes|on)$/i.test(String(val).trim());
};

// 🔍 DEBUG: Agreguemos logs para ver qué está pasando
console.log('🔍 DEBUG - Variables de entorno:');
console.log('JWT_SECRET existe:', !!process.env.JWT_SECRET);
console.log('NODE_ENV:', process.env.NODE_ENV);
console.log('DB_HOST:', process.env.DB_HOST);
console.log('KICK_BROADCASTER_ID:', process.env.KICK_BROADCASTER_ID || 'NO CONFIGURADO');

module.exports = {
    db: {
        host:     process.env.DB_HOST,
        port:     Number(process.env.DB_PORT || 3306),
        user:     process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME,
        ssl:      toBool(process.env.DB_SSL, false),
        sslRejectUnauthorized: toBool(process.env.DB_SSL_REJECT_UNAUTHORIZED, false)
    },
    jwtSecret: process.env.JWT_SECRET,
    kick: {
        clientId:       process.env.KICK_CLIENT_ID,
        clientSecret:   process.env.KICK_CLIENT_SECRET,
        redirectUri:    process.env.KICK_REDIRECT_URI,
        broadcasterId:  process.env.KICK_BROADCASTER_ID, // ID de Luisardito
        // API base (host distinto al de OAuth). Ajusta según la doc de APIs públicas.
        apiBaseUrl:     process.env.KICK_API_BASE_URL || 'https://api.kick.com',
        // Permite override por entorno si fuera necesario
        oauthAuthorize: process.env.KICK_OAUTH_AUTHORIZE_URL || 'https://id.kick.com/oauth/authorize',
        oauthToken:     process.env.KICK_OAUTH_TOKEN_URL     || 'https://id.kick.com/oauth/token',
        oauthRevoke:    process.env.KICK_OAUTH_REVOKE_URL    || 'https://id.kick.com/oauth/revoke'
    },
    // Configuración específica del BOT de chat (aplicación separada)
    kickBot: {
        clientId:       process.env.KICK_BOT_CLIENT_ID,
        clientSecret:   process.env.KICK_BOT_CLIENT_SECRET,
        redirectUri:    process.env.KICK_BOT_REDIRECT_URI,
        // Para simplificar el envío de mensajes, usaremos un Access Token del bot (user token)
        accessToken:    process.env.KICK_BOT_ACCESS_TOKEN,
        // Opcional: username del bot para logs/diagnóstico
        username:       process.env.KICK_BOT_USERNAME
    },
    cloudinary: {
        cloudName: process.env.CLOUDINARY_CLOUD_NAME,
        apiKey: process.env.CLOUDINARY_API_KEY,
        apiSecret: process.env.CLOUDINARY_API_SECRET
    },
    cookies: {
        domain: process.env.COOKIE_DOMAIN || (process.env.NODE_ENV === 'production' ? '.luisardito.com' : undefined),
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax'
    },
    frontendUrl: process.env.FRONTEND_URL,
    port: Number(process.env.PORT || 3000),
    discord: {
        botToken: process.env.DISCORD_BOT_TOKEN,
        clientId: process.env.DISCORD_CLIENT_ID,
        clientSecret: process.env.DISCORD_CLIENT_SECRET,
        guildId: process.env.DISCORD_GUILD_ID
    }
};

console.log('🔍 DEBUG - Config resultante:');
console.log('jwtSecret existe:', !!module.exports.jwtSecret);
console.log('jwtSecret valor:', module.exports.jwtSecret ? 'CONFIGURADO' : 'undefined');
console.log('kick.broadcasterId:', module.exports.kick.broadcasterId || 'NO CONFIGURADO');
