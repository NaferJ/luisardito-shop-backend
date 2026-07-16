import jwt, { type JwtPayload } from "jsonwebtoken";
import crypto from "node:crypto";
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
 * @param payload - User data
 * @returns Access token
 */
function generateAccessToken(payload: string | object | Buffer) {
  return jwt.sign(payload, config.jwtSecret as string, {
    expiresIn: TOKEN_EXPIRATION.ACCESS_TOKEN,
  });
}

/**
 * Generates a unique refresh token
 * @returns Refresh token
 */
function generateRefreshTokenString() {
  return crypto.randomBytes(64).toString("hex");
}

/**
 * Creates and saves a refresh token in the DB
 * @param usuarioId - User ID
 * @param ipAddress - Client IP
 * @param userAgent - Browser user agent
 * @returns Created refresh token
 */
async function createRefreshToken(
  usuarioId: number,
  ipAddress: string | null = null,
  userAgent: string | null = null
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
 * @param token - Refresh token to validate
 * @returns Refresh token if valid, null otherwise
 */
async function validateRefreshToken(token: string) {
  const refreshToken = await RefreshToken.findOne({
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
 * @param token - Token to revoke
 * @returns true if revoked, false if it did not exist
 */
async function revokeRefreshToken(token: string) {
  const refreshToken = await RefreshToken.findOne({ where: { token } });

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
 * @param usuarioId - User ID
 * @returns Number of revoked tokens
 */
async function revokeAllUserTokens(usuarioId: number) {
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
 * @param oldToken - Token to rotate
 * @param ipAddress - Client IP
 * @param userAgent - User agent
 * @returns New refresh token
 */
async function rotateRefreshToken(
  oldToken: string,
  ipAddress: string | null = null,
  userAgent: string | null = null
) {
  const oldRefreshToken = await RefreshToken.findOne({
    where: { token: oldToken },
  });

  if (!oldRefreshToken) {
    throw new Error("Refresh token not found");
  }

  // Create new token
  const newRefreshToken = await createRefreshToken(
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
 * @returns Number of deleted tokens
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
 * @param token - Access token
 * @returns Payload if valid, null otherwise
 */
function verifyAccessToken(token: string): JwtPayload | string | null {
  try {
    return jwt.verify(token, config.jwtSecret as string);
  } catch {
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
