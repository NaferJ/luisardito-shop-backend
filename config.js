require('dotenv').config();

const toBool = (val, def = false) => {
    if (val === undefined) return def;
    return /^(1|true|yes|on)$/i.test(String(val).trim());
};

module.exports = {
    db: {
        host:     process.env.DB_HOST,
        port:     Number(process.env.DB_PORT || 3306),
        user:     process.env.DB_USER,
        password: process.env.DB_PASS,
        database: process.env.DB_NAME,
        ssl:      toBool(process.env.DB_SSL, false),
        sslRejectUnauthorized: toBool(process.env.DB_SSL_REJECT_UNAUTHORIZED, false)
    },
    jwtSecret: process.env.JWT_SECRET,
    kick: {
        clientId:     process.env.KICK_CLIENT_ID,
        clientSecret: process.env.KICK_CLIENT_SECRET,
        redirectUri:  process.env.KICK_REDIRECT_URI
    },
    port: Number(process.env.PORT || 3000)
};
