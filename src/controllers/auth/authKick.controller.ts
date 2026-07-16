/* eslint-disable @typescript-eslint/no-explicit-any */
// TEMPORARY eslint override — to be removed in the typing pass

import jwt from "jsonwebtoken";
import axios from "axios";
import config from "../../../config";
import { Usuario, KickBroadcasterToken, sequelize } from "../../models";
import { Op } from "sequelize";
import { generatePkce } from "../../utils/pkce.util";
import { autoSubscribeToEvents } from "../../services/kickAutoSubscribe.service";
import { setAuthCookies } from "../../utils/cookies.util";
import {
  generateAccessToken,
  createRefreshToken,
} from "../../services/tokenService";
import { enrichUserWithDiscordInfo, processKickAvatar } from "./auth.shared";
import logger from "../../utils/logger";
import asyncHandler from "../../utils/asyncHandler";
import AppError from "../../utils/AppError";

// Redirect to Kick OAuth
const redirectKick = (req: any, res: any) => {
  try {
    const { code_verifier, code_challenge } = generatePkce();
    logger.info("[Kick OAuth][redirectKick] code_verifier:", code_verifier);
    logger.info("[Kick OAuth][redirectKick] code_challenge:", code_challenge);

    const statePayload = {
      cv: code_verifier,
      ruri: config.kick.redirectUri,
      iat: Math.floor(Date.now() / 1000),
    };
    const state = jwt.sign(statePayload, config.jwtSecret, {
      expiresIn: "10m",
    });

    logger.info("[Kick OAuth][redirectKick] statePayload:", statePayload);
    logger.info("[Kick OAuth][redirectKick] state (JWT):", state);

    const params = new URLSearchParams({
      response_type: "code",
      client_id: String(config.kick.clientId || ""),
      redirect_uri: String(config.kick.redirectUri || ""),
      scope: "user:read events:subscribe kicks:read",
      code_challenge: code_challenge,
      code_challenge_method: "S256",
      state,
    });

    const url = `${config.kick.oauthAuthorize}?${params.toString()}`;
    logger.info("[Kick OAuth][redirectKick] Final redirect URL:", url);
    return res.redirect(url);
  } catch (err: any) {
    logger.error("[Kick OAuth][redirectKick] Error:", err?.message || err);
    return res
      .status(500)
      .json({ error: "Could not start the Kick OAuth flow" });
  }
};

// Helper: resolve local user from Kick profile (find-by-user_id_ext / collision-link / create-new)
async function resolveKickUserFromProfile(kickUser: any): Promise<any> {
  let usuario: any = await Usuario.findOne({
    where: { user_id_ext: String(kickUser.user_id) },
  });
  let isNewUser = false;

  if (!usuario) {
    // If not found, search by nickname (case-insensitive) or email
    const colision: any = await Usuario.findOne({
      where: {
        [Op.or]: [
          { email: kickUser.email },
          { nickname: kickUser.name },
          // Case-insensitive lookup for nickname
          sequelize.where(
            sequelize.fn("LOWER", sequelize.col("nickname")),
            sequelize.fn("LOWER", kickUser.name)
          ),
        ],
      },
    });

    if (colision) {
      logger.info(
        "[Kick OAuth][callbackKick] Collision detected, linking existing user:",
        {
          usuario_id: colision.id,
          usuario_nickname: colision.nickname,
          kick_nickname: kickUser.name,
          kick_email: kickUser.email,
          kick_user_id: kickUser.user_id,
        }
      );

      // Link the user_id_ext to the existing user
      // Get Kick avatar
      const kickAvatarUrl = processKickAvatar(kickUser);

      await colision.update({
        user_id_ext: String(kickUser.user_id),
        nickname: kickUser.name, // Update with exact Kick name
        email: kickUser.email || colision.email, // Update email when provided by Kick
        kick_data: {
          avatar_url: kickAvatarUrl || kickUser.profile_picture,
          username: kickUser.name,
        },
      });

      usuario = colision;
    } else {
      // Create new user
      // Create the user first to obtain the ID
      const newUserData = {
        nickname: kickUser.name,
        email: kickUser.email || `${kickUser.name}@kick.user`,
        puntos: 1000,
        rol_id: 1, // New users start as "basic user"
        user_id_ext: String(kickUser.user_id),
        password_hash: null,
        kick_data: {
          avatar_url: kickUser.profile_picture, // Temporary
          username: kickUser.name,
        },
      };

      logger.info(
        "[Kick OAuth][callbackKick] Data to create user:",
        newUserData
      );

      usuario = await Usuario.create(newUserData);

      // Get Kick avatar after creating the user
      const kickAvatarUrl = processKickAvatar(kickUser);

      if (kickAvatarUrl) {
        await usuario.update({
          kick_data: {
            avatar_url: kickAvatarUrl,
            username: kickUser.name,
          },
        });
      }

      isNewUser = true;
      logger.info("[Kick OAuth][callbackKick] User created:", usuario.id);
    }
  } else {
    const colision: any = await Usuario.findOne({
      where: {
        [Op.or]: [{ email: kickUser.email }, { nickname: kickUser.name }],
        id: { [Op.ne]: usuario.id },
      },
    });
    if (colision) {
      return { conflict: true };
    }

    // Log data before updating user
    logger.info("[Kick OAuth][callbackKick] Data to update user:", {
      nickname: kickUser.name,
      email: kickUser.email || `${kickUser.name}@kick.user`,
      kick_data: {
        avatar_url: kickUser.profile_picture,
        username: kickUser.name,
      },
    });

    // Get Kick avatar
    const kickAvatarUrl = processKickAvatar(kickUser);

    await usuario.update({
      nickname: kickUser.name,
      email: kickUser.email || `${kickUser.name}@kick.user`,
      kick_data: {
        avatar_url: kickAvatarUrl || kickUser.profile_picture,
        username: kickUser.name,
      },
    });
    logger.info("[Kick OAuth][callbackKick] User updated:", usuario.id);
  }

  return { usuario, isNewUser };
}

// Helper: persist broadcaster token (findOrCreate + update)
async function persistBroadcasterToken(
  kickUserId: any,
  kickUser: any,
  tokenData: any
) {
  const accessToken = tokenData.access_token;
  const refreshToken = tokenData.refresh_token || null;
  const expiresIn = tokenData.expires_in || null;

  let tokenExpiresAt = null;
  if (expiresIn) {
    tokenExpiresAt = new Date(Date.now() + expiresIn * 1000);
  }

  // AUTOMATIC DETECTION: Is this the main broadcaster?
  const isBroadcasterPrincipal = kickUserId === config.kick.broadcasterId;

  if (isBroadcasterPrincipal) {
    logger.info(
      "[MAIN BROADCASTER] Luisardito authenticated - Setting up webhooks..."
    );
  }

  // Save or update token
  const [broadcasterToken, created]: any =
    await KickBroadcasterToken.findOrCreate({
      where: { kick_user_id: kickUserId },
      defaults: {
        kick_user_id: kickUserId,
        kick_username: kickUser.name,
        access_token: accessToken,
        refresh_token: refreshToken,
        token_expires_at: tokenExpiresAt,
        is_active: true,
        auto_subscribed: false,
      },
    });

  if (!created) {
    await broadcasterToken.update({
      kick_username: kickUser.name,
      access_token: accessToken,
      refresh_token: refreshToken,
      token_expires_at: tokenExpiresAt,
      is_active: true,
    });
  }

  logger.info(
    "[Kick OAuth][callbackKick] Token saved:",
    created ? "new" : "updated"
  );

  return { broadcasterToken, created, accessToken, isBroadcasterPrincipal };
}

// Helper: auto-subscribe main broadcaster to events
async function maybeAutoSubscribe(
  broadcasterToken: any,
  accessToken: any,
  kickUserId: any,
  isBroadcasterPrincipal: any
) {
  if (!isBroadcasterPrincipal) {
    logger.info(
      "[NORMAL USER] Authenticated, no webhook configuration required"
    );
    return null;
  }

  logger.info("[MAIN BROADCASTER] Setting up webhook subscriptions...");

  try {
    // Use ITS OWN token to subscribe to ITS OWN channel events
    const autoSubscribeResult: any = await autoSubscribeToEvents(
      accessToken,
      kickUserId,
      kickUserId
    );

    await broadcasterToken.update({
      auto_subscribed: autoSubscribeResult.success,
      last_subscription_attempt: new Date(),
      subscription_error: autoSubscribeResult.success
        ? null
        : JSON.stringify(autoSubscribeResult.error),
    });

    if (autoSubscribeResult.success) {
      logger.info(
        `[MAIN BROADCASTER] ${autoSubscribeResult.totalSubscribed} events configured. System ready.`
      );
    } else {
      logger.error(
        "[MAIN BROADCASTER] Configuration error:",
        autoSubscribeResult.error
      );
    }

    return autoSubscribeResult;
  } catch (subscribeError: any) {
    logger.error("[MAIN BROADCASTER] Critical error:", subscribeError.message);
    await broadcasterToken.update({
      auto_subscribed: false,
      last_subscription_attempt: new Date(),
      subscription_error: subscribeError.message,
    });
    return null;
  }
}

// Helper: handle callbackKick errors
function handleCallbackKickError(res: any, error: any) {
  logger.error(
    "[Kick OAuth][callbackKick] General error:",
    error?.message || error
  );

  // Show Sequelize validation error details if present
  if (error.errors) {
    logger.error(
      "[Kick OAuth][callbackKick] Validation error details:",
      error.errors
    );
    // Respond with the validation message if it is a uniqueness collision
    const uniqueError = error.errors.find(
      (e: any) => e.type === "unique violation"
    );
    if (uniqueError) {
      return res.status(409).json({
        error: uniqueError.message,
        campo: uniqueError.path,
        valor: uniqueError.value,
      });
    }
  }

  if (error.response) {
    logger.info(
      "[Kick OAuth][callbackKick] error.response.data:",
      error.response.data
    );
    return res.status(error.response.status).json({
      error: "Error communicating with Kick",
      provider_status: error.response.status,
      details: error.response.data,
    });
  }

  return res.status(502).json({
    error: "Provider network failure",
    detalle: error.errors || error.message || error,
  });
}

// Kick OAuth callback
const callbackKick = async (req: any, res: any) => {
  try {
    const { code, state } = req.query || {};
    logger.info("[Kick OAuth][callbackKick] Parameters received:", {
      code,
      state,
    });

    if (!code || !state) {
      logger.info("[Kick OAuth][callbackKick] Missing code/state parameters:", {
        code,
        state,
      });
      return res.status(400).json({ error: "Missing code/state parameters" });
    }

    let decoded;
    try {
      decoded = jwt.verify(String(state), config.jwtSecret);
      logger.info("[Kick OAuth][callbackKick] Decoded state:", decoded);
    } catch (e: any) {
      logger.info(
        "[Kick OAuth][callbackKick] Invalid or expired state:",
        e?.message || e
      );
      return res.status(400).json({ error: "Invalid or expired state" });
    }

    const code_verifier = decoded?.cv;
    const finalRedirectUri = decoded?.ruri || config.kick.redirectUri;
    logger.info(
      "[Kick OAuth][callbackKick] Recovered code_verifier:",
      code_verifier
    );
    logger.info(
      "[Kick OAuth][callbackKick] finalRedirectUri:",
      finalRedirectUri
    );

    if (!code_verifier || !finalRedirectUri) {
      logger.info("[Kick OAuth][callbackKick] Invalid PKCE or redirect_uri:", {
        code_verifier,
        finalRedirectUri,
      });
      return res.status(400).json({ error: "Invalid PKCE or redirect_uri" });
    }

    const tokenUrl = config.kick.oauthToken;
    const clientId = config.kick.clientId;
    const clientSecret = config.kick.clientSecret;

    logger.info("[Kick OAuth][callbackKick] tokenUrl:", tokenUrl);
    logger.info("[Kick OAuth][callbackKick] clientId:", clientId);
    logger.info("[Kick OAuth][callbackKick] clientSecret:", clientSecret);

    if (!clientId || !clientSecret) {
      logger.error(
        "[Kick OAuth][callbackKick] Missing KICK_CLIENT_ID/KICK_CLIENT_SECRET configuration"
      );
      return res
        .status(500)
        .json({ error: "Incomplete provider configuration" });
    }

    const params = new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: finalRedirectUri,
      client_id: clientId,
      client_secret: clientSecret,
      code_verifier,
    });

    logger.info(
      "[Kick OAuth][callbackKick] Parameters sent to token endpoint:",
      params.toString()
    );

    const tokenRes = await axios.post(tokenUrl, params.toString(), {
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      timeout: 10000,
    });

    logger.info(
      "[Kick OAuth][callbackKick] Token endpoint response:",
      tokenRes.data
    );

    const tokenData = tokenRes.data;

    const userApiBase = config.kick.apiBaseUrl.replace(/\/$/, "");
    const userUrl = `${userApiBase}/public/v1/users`;
    logger.info(
      "[Kick OAuth][callbackKick] URL to fetch user profile:",
      userUrl
    );

    const userRes = await axios.get(userUrl, {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
      timeout: 10000,
    });

    logger.info(
      "[Kick OAuth][callbackKick] User profile response:",
      userRes.data
    );

    const kickUser = Array.isArray(userRes.data.data)
      ? userRes.data.data[0]
      : userRes.data;

    const userResult: any = await resolveKickUserFromProfile(kickUser);
    if (userResult.conflict) {
      return res
        .status(409)
        .json({ error: "Email or nickname already in use by another user." });
    }
    const { usuario, isNewUser } = userResult;

    // Save broadcaster token and auto-subscribe to events
    const kickUserId = String(kickUser.user_id);
    const { broadcasterToken, accessToken, isBroadcasterPrincipal } =
      await persistBroadcasterToken(kickUserId, kickUser, tokenData);

    const autoSubscribeResult: any = await maybeAutoSubscribe(
      broadcasterToken,
      accessToken,
      kickUserId,
      isBroadcasterPrincipal
    );

    // Generate access token and refresh token
    const jwtAccessToken = generateAccessToken({
      userId: usuario.id,
      rolId: usuario.rol_id,
      nickname: usuario.nickname,
      kick_id: usuario.user_id,
    });

    const ipAddress = req.ip || req.connection.remoteAddress;
    const userAgent = req.headers["user-agent"];

    const refreshTokenObj: any = await createRefreshToken(
      usuario.id,
      ipAddress,
      userAgent
    );

    logger.info("[Kick OAuth][callbackKick] JWT issued (access + refresh)");

    // Set cross-domain cookies
    setAuthCookies(res, jwtAccessToken, refreshTokenObj.token);

    // Enrich user info with Discord data
    const { discord_info, display_name } =
      await enrichUserWithDiscordInfo(usuario);

    const frontendUrl = config.frontendUrl || "http://localhost:5173";
    const callbackData = {
      token: jwtAccessToken, // Backward compatibility
      accessToken: jwtAccessToken,
      refreshToken: refreshTokenObj.token,
      expiresIn: 3600, // 1 hour in seconds
      usuario: {
        id: usuario.id,
        nickname: usuario.nickname,
        display_name,
        puntos: usuario.puntos,
        rol_id: usuario.rol_id,
        user_id_ext: usuario.user_id_ext,
        kick_data: usuario.kick_data,
        discord_info,
        createdAt: usuario.createdAt,
        updatedAt: usuario.updatedAt,
      },
      isNewUser,
      kickProfile: {
        username: kickUser.name,
        id: kickUser.user_id,
        avatar_url: kickUser.profile_picture,
      },
      broadcasterConnected: true,
      autoSubscribed: autoSubscribeResult?.success || false,
      subscriptionInfo: autoSubscribeResult
        ? {
            totalSubscribed: autoSubscribeResult.totalSubscribed,
            totalErrors: autoSubscribeResult.totalErrors,
          }
        : null,
    };

    const encodedData = Buffer.from(JSON.stringify(callbackData)).toString(
      "base64"
    );
    const redirectUrl = `${frontendUrl}/auth/callback?data=${encodeURIComponent(encodedData)}`;

    logger.info(
      "[Kick OAuth][callbackKick] Redirecting to frontend:",
      redirectUrl
    );

    return res.redirect(redirectUrl);
  } catch (error: any) {
    return handleCallbackKickError(res, error);
  }
};

// Receive tokens from the frontend (token exchange done in the browser)
const storeTokens = asyncHandler(async (req: any, res: any) => {
  const { accessToken } = req.body || {};
  if (!accessToken) {
    throw new AppError("accessToken required", 400);
  }

  const userApiBase = config.kick.apiBaseUrl.replace(/\/$/, "");
  const userUrl = `${userApiBase}/public/v1/users`;

  // Get user data with the received access token
  let userRes;
  try {
    userRes = await axios.get(userUrl, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
      timeout: 10000,
    });
  } catch (error: any) {
    if (error.response) {
      throw new AppError(
        "Error fetching Kick profile",
        400,
        error.response.data
      );
    }
    throw new AppError("Internal server error", 500);
  }

  const kickUser = Array.isArray(userRes.data.data)
    ? userRes.data.data[0]
    : userRes.data;

  // Upsert local user
  let usuario: any = await Usuario.findOne({
    where: { user_id_ext: String(kickUser.user_id) },
  });
  let isNewUser = false;
  if (!usuario) {
    // Create new user
    const newUserData = {
      nickname: kickUser.name,
      email: kickUser.email || `${kickUser.name}@kick.user`,
      puntos: 1000,
      rol_id: 1, // New users start as "basic user"
      user_id_ext: String(kickUser.user_id),
      password_hash: null,
      kick_data: {
        avatar_url: kickUser.profile_picture, // Temporary
        username: kickUser.name,
      },
    };

    usuario = await Usuario.create(newUserData);

    // Get Kick avatar after creating the user
    const kickAvatarUrl = processKickAvatar(kickUser);

    if (kickAvatarUrl) {
      await usuario.update({
        kick_data: {
          avatar_url: kickAvatarUrl,
          username: kickUser.name,
        },
      });
    }

    isNewUser = true;
  } else {
    // Get Kick avatar
    const kickAvatarUrl = processKickAvatar(kickUser);

    await usuario.update({
      nickname: kickUser.name,
      email: kickUser.email || `${kickUser.name}@kick.user`,
      kick_data: {
        avatar_url: kickAvatarUrl || kickUser.profile_picture,
        username: kickUser.name,
      },
    });
  }

  // Issue our JWT
  const token = jwt.sign(
    {
      userId: usuario.id,
      rolId: usuario.rol_id,
      nickname: usuario.nickname,
      kick_id: kickUser.user_id,
    },
    config.jwtSecret,
    { expiresIn: "30d" }
  );

  // Set cookies (although this endpoint is used less, for compatibility)
  setAuthCookies(res, token, "no-refresh-token-provided");

  // Enrich user info with Discord data
  const { discord_info, display_name } =
    await enrichUserWithDiscordInfo(usuario);

  return res.json({
    token,
    usuario: {
      id: usuario.id,
      nickname: usuario.nickname,
      display_name,
      puntos: usuario.puntos,
      rol_id: usuario.rol_id,
      user_id_ext: usuario.user_id_ext,
      kick_data: usuario.kick_data,
      discord_info,
      createdAt: usuario.createdAt,
      updatedAt: usuario.updatedAt,
    },
    isNewUser,
    kickProfile: {
      username: kickUser.name,
      id: kickUser.user_id,
      avatar_url: kickUser.profile_picture,
    },
  });
});

export { redirectKick, callbackKick, storeTokens };
