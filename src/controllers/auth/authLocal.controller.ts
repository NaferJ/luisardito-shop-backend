/* eslint-disable @typescript-eslint/no-explicit-any */
// TEMPORARY eslint override — to be removed in the typing pass

import bcrypt from "bcryptjs";
import { Usuario } from "../../models";
import { Op } from "sequelize";
import {
  generateAccessToken,
  createRefreshToken,
  validateRefreshToken,
  revokeRefreshToken,
  revokeAllUserTokens,
  rotateRefreshToken,
} from "../../services/tokenService";
import { setAuthCookies, clearAuthCookies } from "../../utils/cookies.util";
import { enrichUserWithDiscordInfo } from "./auth.shared";
import logger from "../../utils/logger";
import asyncHandler from "../../utils/asyncHandler";
import AppError from "../../utils/AppError";

const registerLocal = asyncHandler(async (req: any, res: any) => {
  try {
    // eslint-disable-next-line prefer-const
    let { nickname, email, password } = req.body;

    if (!nickname || !email || !password) {
      throw new AppError("All fields are required", 400);
    }

    nickname = nickname.trim().toLowerCase();
    email = email.trim().toLowerCase();

    const developers = ["naferjml@gmail.com"];
    if (!developers.includes(email)) {
      throw new AppError("Manual registration is for developers only", 403);
    }

    // Check for duplicates
    const existe: any = await Usuario.findOne({
      where: { [Op.or]: [{ nickname }, { email }] },
    });
    if (existe) {
      throw new AppError("Nickname or email already registered", 409);
    }

    const hash = await bcrypt.hash(password, 10);
    const user: any = await Usuario.create({
      nickname,
      email,
      password_hash: hash,
    });
    res.status(201).json({ message: "User created", userId: user.id });
  } catch (err: any) {
    if (err instanceof AppError) throw err;
    throw new AppError(err.message, 400);
  }
});

// Local login
const loginLocal = asyncHandler(async (req: any, res: any) => {
  const { nickname, password } = req.body;
  const user: any = await Usuario.findOne({ where: { nickname } });
  if (
    !user?.password_hash ||
    !(await bcrypt.compare(password, user.password_hash))
  ) {
    throw new AppError("Invalid credentials", 401);
  }

  // Generate access token and refresh token
  const accessToken = generateAccessToken({
    userId: user.id,
    rolId: user.rol_id,
    nickname: user.nickname,
  });

  const ipAddress = req.ip || req.connection.remoteAddress;
  const userAgent = req.headers["user-agent"];

  const refreshToken = await createRefreshToken(user.id, ipAddress, userAgent);

  // Set cross-domain cookies
  setAuthCookies(res, accessToken, refreshToken.token);

  // Enrich user info with Discord data
  const { discord_info, display_name } = await enrichUserWithDiscordInfo(user);

  res.json({
    accessToken,
    refreshToken: refreshToken.token,
    expiresIn: 3600, // 1 hour in seconds
    user: {
      id: user.id,
      nickname: user.nickname,
      display_name,
      puntos: user.puntos,
      rol_id: user.rol_id,
      discord_info,
    },
  });
});

/**
 * Endpoint to refresh the access token using the refresh token
 */
const refreshToken = asyncHandler(async (req: any, res: any) => {
  const { refreshToken } = req.body;

  if (!refreshToken) {
    throw new AppError("refreshToken required", 400);
  }

  // Validate the refresh token
  const tokenRecord: any = await validateRefreshToken(refreshToken);

  if (!tokenRecord) {
    throw new AppError("Invalid or expired refresh token", 401);
  }

  // Get user data
  const usuario: any = await Usuario.findByPk(tokenRecord.usuario_id);

  if (!usuario) {
    throw new AppError("User not found", 404);
  }

  // Rotate the refresh token (higher security)
  const ipAddress = req.ip || req.connection.remoteAddress;
  const userAgent = req.headers["user-agent"];

  const newRefreshToken = await rotateRefreshToken(
    refreshToken,
    ipAddress,
    userAgent
  );

  // Generate new access token
  const newAccessToken = generateAccessToken({
    userId: usuario.id,
    rolId: usuario.rol_id,
    nickname: usuario.nickname,
    kick_id: usuario.user_id_ext,
  });

  logger.info(
    `[Auth][refreshToken] Token renewed for user ${usuario.nickname}`
  );

  // Set cookies with the new tokens
  setAuthCookies(res, newAccessToken, newRefreshToken.token);

  // Enrich user info with Discord data
  const { discord_info, display_name } =
    await enrichUserWithDiscordInfo(usuario);

  return res.json({
    accessToken: newAccessToken,
    refreshToken: newRefreshToken.token,
    expiresIn: 3600, // 1 hour in seconds
    user: {
      id: usuario.id,
      nickname: usuario.nickname,
      display_name,
      puntos: usuario.puntos,
      rol_id: usuario.rol_id,
      discord_info,
    },
  });
});

/**
 * Endpoint to log out (revoke refresh token)
 */
const logout = asyncHandler(async (req: any, res: any) => {
  const { refreshToken } = req.body;

  if (!refreshToken) {
    throw new AppError("refreshToken required", 400);
  }

  // Revoke the refresh token
  const revoked = await revokeRefreshToken(refreshToken);

  if (!revoked) {
    throw new AppError("Refresh token not found", 404);
  }

  // Clear cross-domain cookies
  clearAuthCookies(res);

  logger.info("[Auth][logout] Session closed successfully");

  return res.json({ message: "Session closed successfully" });
});

/**
 * Endpoint to close all sessions for a user
 */
const logoutAll = asyncHandler(async (req: any, res: any) => {
  // Get userId from the current token (assumes auth middleware)
  const { userId } = req.user || req.body;

  if (!userId) {
    throw new AppError("userId required", 400);
  }

  // Revoke all refresh tokens for the user
  const revokedCount = await revokeAllUserTokens(userId);

  // Clear cross-domain cookies
  clearAuthCookies(res);

  logger.info(
    `[Auth][logoutAll] ${revokedCount} sessions closed for user ${userId}`
  );

  return res.json({
    message: `${revokedCount} session(s) closed successfully`,
    revokedCount,
  });
});

export { registerLocal, loginLocal, refreshToken, logout, logoutAll };
