require('dotenv').config();

module.exports = {
    db: {
        host:     process.env.DB_HOST,
        user:     process.env.DB_USER,
        password: process.env.DB_PASS,
        database: process.env.DB_NAME
    },
    jwtSecret: process.env.JWT_SECRET,
    kick: {
        clientId:     process.env.KICK_CLIENT_ID,
        clientSecret: process.env.KICK_CLIENT_SECRET,
        redirectUri:  process.env.KICK_REDIRECT_URI
    },
    port: process.env.PORT || 3000
};
