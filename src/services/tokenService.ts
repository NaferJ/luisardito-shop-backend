/* eslint-disable @typescript-eslint/no-explicit-any */
// TEMPORARY eslint override — to be removed in the typing pass

import jwt from "jsonwebtoken";
import crypto from "crypto";
import config from "../../config";
import { RefreshToken } from "../models";
import { Op } from "sequelize";

/**
 * Token durations
 *
 * For loyalty points store (public users):
 * - Access token: 30 days (users do not lose session)
 * - Refresh token: 90 days (allows renewing access)
 */
const TOKEN_EXPIRATION = {
  ACCESS_TOKEN: "30d", // 30 days (was 1h)
  REFRESH_TOKEN: 90, // 90 days
};

/**
 * Generates a JWT access token
 * @param {Object} payload - User data
 * @returns {string} Access token
 */
function generateAccessToken(payload: any) {
  return jwt.sign(payload, config.jwtSecret, {
    expiresIn: TOKEN_EXPIRATION.ACCESS_TOKEN,
  });
}

/**
 * Generates a unique refresh token
 * @returns {string} Refresh token
 */
function generateRefreshTokenString() {
  return crypto.randomBytes(64).toString("hex");
}

/**
 * Creates and saves a refresh token in the DB
 * @param {number} usuarioId - User ID
 * @param {string} ipAddress - Client IP
 * @param {string} userAgent - Browser user agent
 * @returns {Promise<Object>} Created refresh token
 */
async function createRefreshToken(
  usuarioId: any,
  ipAddress: any = null,
  userAgent: any = null
) {
  const token = generateRefreshTokenString();
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + TOKEN_EXPIRATION.REFRESH_TOKEN);

  const refreshToken = await RefreshToken.create({
    usuario_id: usuarioId,
    token,
    expires_at: expiresAt,
    ip_address: ipAddress,
    user_agent: userAgent,
  });

  return refreshToken;
}

/**
 * Validates a refresh token
 * @param {string} token - Refresh token to validate
 * @returns {Promise<Object|null>} Refresh token if valid, null otherwise
 */
async function validateRefreshToken(token: any) {
  const refreshToken: any = await RefreshToken.findOne({
    where: {
      token,
      is_revoked: false,
      expires_at: { [Op.gt]: new Date() },
    },
  });

  return refreshToken;
}

/**
 * Revokes a refresh token
 * @param {string} token - Token to revoke
 * @returns {Promise<boolean>} true if revoked, false if it did not exist
 */
async function revokeRefreshToken(token: any) {
  const refreshToken: any = await RefreshToken.findOne({ where: { token } });

  if (!refreshToken) {
    return false;
  }

  await refreshToken.update({
    is_revoked: true,
    revoked_at: new Date(),
  });

  return true;
}

/**
 * Revokes all refresh tokens for a user
 * @param {number} usuarioId - User ID
 * @returns {Promise<number>} Number of revoked tokens
 */
async function revokeAllUserTokens(usuarioId: any) {
  const result = await RefreshToken.update(
    {
      is_revoked: true,
      revoked_at: new Date(),
    },
    {
      where: {
        usuario_id: usuarioId,
        is_revoked: false,
      },
    }
  );

  return result[0]; // Number of updated rows
}

/**
 * Rotates a refresh token (revokes the old one and creates a new one)
 * @param {string} oldToken - Token to rotate
 * @param {string} ipAddress - Client IP
 * @param {string} userAgent - User agent
 * @returns {Promise<Object>} New refresh token
 */
async function rotateRefreshToken(
  oldToken: any,
  ipAddress: any = null,
  userAgent: any = null
) {
  const oldRefreshToken: any = await RefreshToken.findOne({
    where: { token: oldToken },
  });

  if (!oldRefreshToken) {
    throw new Error("Refresh token not found");
  }

  // Create new token
  const newRefreshToken: any = await createRefreshToken(
    oldRefreshToken.usuario_id,
    ipAddress,
    userAgent
  );

  // Revoke the old one and link to the new one
  await oldRefreshToken.update({
    is_revoked: true,
    revoked_at: new Date(),
    replaced_by_token: newRefreshToken.token,
  });

  return newRefreshToken;
}

/**
 * Cleans up expired tokens (run periodically)
 * @returns {Promise<number>} Number of deleted tokens
 */
async function cleanupExpiredTokens() {
  const result = await RefreshToken.destroy({
    where: {
      expires_at: { [Op.lt]: new Date() },
    },
  });

  return result;
}

/**
 * Verifies a JWT access token
 * @param {string} token - Access token
 * @returns {Object|null} Payload if valid, null otherwise
 */
function verifyAccessToken(token: any) {
  try {
    return jwt.verify(token, config.jwtSecret);
  } catch (_error) {
    return null;
  }
}

export {
  TOKEN_EXPIRATION,
  generateAccessToken,
  generateRefreshTokenString,
  createRefreshToken,
  validateRefreshToken,
  revokeRefreshToken,
  revokeAllUserTokens,
  rotateRefreshToken,
  cleanupExpiredTokens,
  verifyAccessToken,
};
