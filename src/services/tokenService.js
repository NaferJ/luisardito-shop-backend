const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const config = require('../../config');
const { RefreshToken } = require('../models');
const { Op } = require('sequelize');

/**
 * Duración de los tokens
 *
 * Para tienda de puntos de lealtad (usuarios públicos):
 * - Access token: 30 días (usuarios no pierden sesión)
 * - Refresh token: 90 días (permite renovar acceso)
 */
const TOKEN_EXPIRATION = {
    ACCESS_TOKEN: '30d',     // 30 días (antes era 1h)
    REFRESH_TOKEN: 90        // 90 días
};

/**
 * Genera un access token JWT
 * @param {Object} payload - Datos del usuario
 * @returns {string} Access token
 */
function generateAccessToken(payload) {
    return jwt.sign(payload, config.jwtSecret, {
        expiresIn: TOKEN_EXPIRATION.ACCESS_TOKEN
    });
}

/**
 * Genera un refresh token único
 * @returns {string} Refresh token
 */
function generateRefreshTokenString() {
    return crypto.randomBytes(64).toString('hex');
}

/**
 * Crea y guarda un refresh token en la BD
 * @param {number} usuarioId - ID del usuario
 * @param {string} ipAddress - IP del cliente
 * @param {string} userAgent - User agent del navegador
 * @returns {Promise<Object>} Refresh token creado
 */
async function createRefreshToken(usuarioId, ipAddress = null, userAgent = null) {
    const token = generateRefreshTokenString();
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + TOKEN_EXPIRATION.REFRESH_TOKEN);

    const refreshToken = await RefreshToken.create({
        usuario_id: usuarioId,
        token,
        expires_at: expiresAt,
        ip_address: ipAddress,
        user_agent: userAgent
    });

    return refreshToken;
}

/**
 * Valida un refresh token
 * @param {string} token - Refresh token a validar
 * @returns {Promise<Object|null>} Refresh token si es válido, null si no
 */
async function validateRefreshToken(token) {
    const refreshToken = await RefreshToken.findOne({
        where: {
            token,
            is_revoked: false,
            expires_at: { [Op.gt]: new Date() }
        }
    });

    return refreshToken;
}

/**
 * Revoca un refresh token
 * @param {string} token - Token a revocar
 * @returns {Promise<boolean>} true si se revocó, false si no existía
 */
async function revokeRefreshToken(token) {
    const refreshToken = await RefreshToken.findOne({ where: { token } });

    if (!refreshToken) {
        return false;
    }

    await refreshToken.update({
        is_revoked: true,
        revoked_at: new Date()
    });

    return true;
}

/**
 * Revoca todos los refresh tokens de un usuario
 * @param {number} usuarioId - ID del usuario
 * @returns {Promise<number>} Cantidad de tokens revocados
 */
async function revokeAllUserTokens(usuarioId) {
    const result = await RefreshToken.update(
        {
            is_revoked: true,
            revoked_at: new Date()
        },
        {
            where: {
                usuario_id: usuarioId,
                is_revoked: false
            }
        }
    );

    return result[0]; // Cantidad de filas actualizadas
}

/**
 * Rota un refresh token (revoca el viejo y crea uno nuevo)
 * @param {string} oldToken - Token a rotar
 * @param {string} ipAddress - IP del cliente
 * @param {string} userAgent - User agent
 * @returns {Promise<Object>} Nuevo refresh token
 */
async function rotateRefreshToken(oldToken, ipAddress = null, userAgent = null) {
    const oldRefreshToken = await RefreshToken.findOne({ where: { token: oldToken } });

    if (!oldRefreshToken) {
        throw new Error('Refresh token no encontrado');
    }

    // Crear nuevo token
    const newRefreshToken = await createRefreshToken(
        oldRefreshToken.usuario_id,
        ipAddress,
        userAgent
    );

    // Revocar el viejo y vincular al nuevo
    await oldRefreshToken.update({
        is_revoked: true,
        revoked_at: new Date(),
        replaced_by_token: newRefreshToken.token
    });

    return newRefreshToken;
}

/**
 * Limpia tokens expirados (ejecutar periódicamente)
 * @returns {Promise<number>} Cantidad de tokens eliminados
 */
async function cleanupExpiredTokens() {
    const result = await RefreshToken.destroy({
        where: {
            expires_at: { [Op.lt]: new Date() }
        }
    });

    return result;
}

/**
 * Verifica un access token JWT
 * @param {string} token - Access token
 * @returns {Object|null} Payload si es válido, null si no
 */
function verifyAccessToken(token) {
    try {
        return jwt.verify(token, config.jwtSecret);
    } catch (error) {
        return null;
    }
}

module.exports = {
    TOKEN_EXPIRATION,
    generateAccessToken,
    generateRefreshTokenString,
    createRefreshToken,
    validateRefreshToken,
    revokeRefreshToken,
    revokeAllUserTokens,
    rotateRefreshToken,
    cleanupExpiredTokens,
    verifyAccessToken
};
