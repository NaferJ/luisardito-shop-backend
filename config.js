require('dotenv').config();

const toBool = (val, def = false) => {
    if (val === undefined) return def;
    return /^(1|true|yes|on)$/i.test(String(val).trim());
};

// 🔍 DEBUG: Agreguemos logs para ver qué está pasando
console.log('🔍 DEBUG - Variables de entorno:');
console.log('JWT_SECRET existe:', !!process.env.JWT_SECRET);
console.log('JWT_SECRET valor:', process.env.JWT_SECRET ? `"${process.env.JWT_SECRET.substring(0, 10)}..."` : 'undefined');
console.log('JWT_SECRET type:', typeof process.env.JWT_SECRET);
console.log('JWT_SECRET length:', process.env.JWT_SECRET?.length);
console.log('NODE_ENV:', process.env.NODE_ENV);
console.log('DB_HOST:', process.env.DB_HOST);

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
        // API base (host distinto al de OAuth). Ajusta según la doc de APIs públicas.
        apiBaseUrl:     process.env.KICK_API_BASE_URL || 'https://api.kick.com',
        // Permite override por entorno si fuera necesario
        oauthAuthorize: process.env.KICK_OAUTH_AUTHORIZE_URL || 'https://id.kick.com/oauth/authorize',
        oauthToken:     process.env.KICK_OAUTH_TOKEN_URL     || 'https://id.kick.com/oauth/token',
        oauthRevoke:    process.env.KICK_OAUTH_REVOKE_URL    || 'https://id.kick.com/oauth/revoke'
    },
    port: Number(process.env.PORT || 3000)
};

// 🔍 DEBUG: Ver el resultado final
console.log('🔍 DEBUG - Config resultante:');
console.log('jwtSecret existe:', !!module.exports.jwtSecret);
console.log('jwtSecret valor:', module.exports.jwtSecret ? 'CONFIGURADO' : 'undefined');
