const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const axios = require("axios");
const config = require("../../config");
const {
  Usuario,
  KickBroadcasterToken,
  sequelize,
  DiscordUserLink,
} = require("../models");
const { generatePkce } = require("../utils/pkce.util");
const { getKickUserData } = require("../utils/kickApi");
const { Op } = require("sequelize");
const {
  autoSubscribeToEvents,
} = require("../services/kickAutoSubscribe.service");
const { extractAvatarUrl } = require("../utils/kickApi");
const { setAuthCookies, clearAuthCookies } = require("../utils/cookies.util");
const KickBotTokenService = require("../services/kickBotToken.service");
const logger = require("../utils/logger");
const asyncHandler = require("../utils/asyncHandler");
const AppError = require("../utils/AppError");

/**
 * Helper to enrich user info with Discord data
 * @param {Object} user - Usuario model instance
 * @returns {Promise<{discord_info: Object|null, display_name: string}>} Enriched Discord info
 */
async function enrichUserWithDiscordInfo(user) {
  let discordInfo = null;
  const discordLink = await DiscordUserLink.findOne({
    where: { tienda_user_id: user.id },
  });

  if (discordLink) {
    discordInfo = {
      linked: true,
      id: discordLink.discord_user_id,
      username: discordLink.discord_username,
      discriminator: discordLink.discord_discriminator,
      avatar: discordLink.discord_avatar,
      linked_at: discordLink.createdAt,
      display_name:
        discordLink.discord_discriminator &&
        discordLink.discord_discriminator !== "0"
          ? `${discordLink.discord_username}#${discordLink.discord_discriminator}`
          : discordLink.discord_username,
    };
  }

  return {
    discord_info: discordInfo,
    display_name: discordInfo?.display_name || user.nickname,
  };
}
const {
  generateAccessToken,
  createRefreshToken,
  validateRefreshToken,
  revokeRefreshToken,
  revokeAllUserTokens,
  rotateRefreshToken,
} = require("../services/tokenService");

/**
 * Extracts the Kick avatar
 * @param {Object} kickUser - Kick user data
 * @returns {string|null} - Kick avatar URL or null if absent
 */
function processKickAvatar(kickUser) {
  try {
    const kickAvatarUrl = extractAvatarUrl(kickUser);

    if (!kickAvatarUrl) {
      logger.info(`[Auth] No avatar found in Kick data`);
      return null;
    }

    logger.info(`[Auth] Kick avatar obtained:`, kickAvatarUrl);
    return kickAvatarUrl;
  } catch (error) {
    logger.warn(
      `[Auth] Error extracting avatar, continuing without it:`,
      error.message
    );
    return null;
  }
}

exports.registerLocal = asyncHandler(async (req, res) => {
  try {
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
    const existe = await Usuario.findOne({
      where: { [Op.or]: [{ nickname }, { email }] },
    });
    if (existe) {
      throw new AppError("Nickname or email already registered", 409);
    }

    const hash = await bcrypt.hash(password, 10);
    const user = await Usuario.create({ nickname, email, password_hash: hash });
    res.status(201).json({ message: "User created", userId: user.id });
  } catch (err) {
    if (err instanceof AppError) throw err;
    throw new AppError(err.message, 400);
  }
});

// Local login
exports.loginLocal = asyncHandler(async (req, res) => {
  const { nickname, password } = req.body;
  const user = await Usuario.findOne({ where: { nickname } });
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

// Redirect to Kick OAuth
exports.redirectKick = (req, res) => {
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
  } catch (err) {
    logger.error("[Kick OAuth][redirectKick] Error:", err?.message || err);
    return res
      .status(500)
      .json({ error: "Could not start the Kick OAuth flow" });
  }
};

// Redirect to Kick OAuth (BOT)
exports.redirectKickBot = (req, res) => {
  try {
    const { code_verifier, code_challenge } = generatePkce();

    const statePayload = {
      cv: code_verifier,
      ruri: config.kickBot.redirectUri,
      iat: Math.floor(Date.now() / 1000),
    };
    const state = jwt.sign(statePayload, config.jwtSecret, {
      expiresIn: "10m",
    });

    const params = new URLSearchParams({
      response_type: "code",
      client_id: String(config.kickBot.clientId || ""),
      redirect_uri: String(config.kickBot.redirectUri || ""),
      scope: "user:read chat:write channel:read channel:write",
      code_challenge: code_challenge,
      code_challenge_method: "S256",
      state,
    });

    const url = `${config.kick.oauthAuthorize}?${params.toString()}`;
    return res.redirect(url);
  } catch (err) {
    logger.error("[Kick OAuth][redirectKickBot] Error:", err?.message || err);
    return res
      .status(500)
      .json({ error: "Could not start the BOT OAuth flow" });
  }
};

// Helper: resolve local user from Kick profile (find-by-user_id_ext / collision-link / create-new)
async function resolveKickUserFromProfile(kickUser) {
  let usuario = await Usuario.findOne({
    where: { user_id_ext: String(kickUser.user_id) },
  });
  let isNewUser = false;

  if (!usuario) {
    // If not found, search by nickname (case-insensitive) or email
    const colision = await Usuario.findOne({
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
      isNewUser = false;
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
    const colision = await Usuario.findOne({
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
async function persistBroadcasterToken(kickUserId, kickUser, tokenData) {
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
  const [broadcasterToken, created] = await KickBroadcasterToken.findOrCreate({
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
  broadcasterToken,
  accessToken,
  kickUserId,
  isBroadcasterPrincipal
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
    const autoSubscribeResult = await autoSubscribeToEvents(
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
  } catch (subscribeError) {
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
function handleCallbackKickError(res, error) {
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
    const uniqueError = error.errors.find((e) => e.type === "unique violation");
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
exports.callbackKick = async (req, res) => {
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
    } catch (e) {
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

    const userResult = await resolveKickUserFromProfile(kickUser);
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

    const autoSubscribeResult = await maybeAutoSubscribe(
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

    const refreshTokenObj = await createRefreshToken(
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
  } catch (error) {
    return handleCallbackKickError(res, error);
  }
};

// Kick OAuth callback (BOT)
exports.callbackKickBot = async (req, res) => {
  try {
    const { code, state } = req.query || {};
    logger.info("[Kick OAuth][callbackKickBot] Parameters received:", {
      code,
      state,
    });

    if (!code || !state) {
      logger.info(
        "[Kick OAuth][callbackKickBot] Missing code/state parameters"
      );
      return res.status(400).json({ error: "Missing code/state parameters" });
    }

    // Validate the state
    let decodedState;
    try {
      decodedState = jwt.verify(state, config.jwtSecret);
      logger.info("[Kick OAuth][callbackKickBot] Decoded state:", decodedState);
    } catch (err) {
      logger.error("[Kick OAuth][callbackKickBot] Error decoding state:", err);
      return res.status(400).json({ error: "Invalid or expired state" });
    }

    // Obtain access tokens
    const tokenResponse = await axios.post(
      config.kick.oauthToken,
      new URLSearchParams({
        grant_type: "authorization_code",
        client_id: String(config.kickBot.clientId || ""),
        client_secret: String(config.kickBot.clientSecret || ""),
        code,
        redirect_uri: String(decodedState.ruri || ""),
        code_verifier: decodedState.cv,
      }),
      {
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
      }
    );

    const { access_token, refresh_token, expires_in } = tokenResponse.data;
    const tokenExpiresAt = new Date(Date.now() + expires_in * 1000);

    // Get bot data
    const botUser = await getKickUserData(access_token);
    if (!botUser || !botUser.id) {
      throw new Error("Could not fetch bot data from Kick");
    }

    // Save bot token
    await KickBotTokenService.saveBotToken({
      kick_user_id: String(botUser.id),
      kick_username: String(botUser.username || `bot-${botUser.id}`),
      access_token,
      refresh_token,
      token_expires_at: tokenExpiresAt,
      scopes: ["user:read", "chat:write", "channel:read", "channel:write"],
    });

    // Also save to tokens.json for auto-refresh
    try {
      const fs = require("node:fs").promises;
      const path = require("node:path");
      const tokensFile = path.join(__dirname, "../../tokens/tokens.json");
      const fullPath = path.resolve(tokensFile);
      logger.info("[Kick OAuth][callbackKickBot] Saving tokens to:", fullPath);
      const tokensForFile = {
        accessToken: access_token,
        refreshToken: refresh_token,
        expiresAt: Date.now() + expires_in * 1000,
        refreshExpiresAt: Date.now() + 365 * 24 * 60 * 60 * 1000, // ~1 year
        username: String(botUser.username || `bot-${botUser.id}`),
      };
      await fs.writeFile(tokensFile, JSON.stringify(tokensForFile, null, 2));
      logger.info("[Kick OAuth][callbackKickBot] Tokens saved to tokens.json");
    } catch (error) {
      logger.error(
        "[Kick OAuth][callbackKickBot] Error saving tokens.json:",
        error.message
      );
    }

    // Redirect to frontend
    const frontendUrl = config.frontendUrl || "http://localhost:5173";
    const message = encodeURIComponent("Bot connected successfully");
    return res.redirect(
      `${frontendUrl}/admin/integrations?kickBot=connected&msg=${message}`
    );
  } catch (err) {
    logger.error("[Kick OAuth][callbackKickBot] Error:", err);
    return res.status(500).json({
      error: "Error in the bot authentication callback",
      details: err.message,
    });
  }
};

/**
 * Endpoint to refresh the access token using the refresh token
 */
exports.refreshToken = asyncHandler(async (req, res) => {
  const { refreshToken } = req.body;

  if (!refreshToken) {
    throw new AppError("refreshToken required", 400);
  }

  // Validate the refresh token
  const tokenRecord = await validateRefreshToken(refreshToken);

  if (!tokenRecord) {
    throw new AppError("Invalid or expired refresh token", 401);
  }

  // Get user data
  const usuario = await Usuario.findByPk(tokenRecord.usuario_id);

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
exports.logout = asyncHandler(async (req, res) => {
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
exports.logoutAll = asyncHandler(async (req, res) => {
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

// Receive tokens from the frontend (token exchange done in the browser)
exports.storeTokens = asyncHandler(async (req, res) => {
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
  } catch (error) {
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
  let usuario = await Usuario.findOne({
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

/**
 * Endpoint to check cookie status (debugging)
 */
exports.cookieStatus = asyncHandler(async (req, res) => {
  const cookies = req.headers.cookie;
  const authToken = req.cookies?.auth_token;
  const refreshToken = req.cookies?.refresh_token;

  return res.json({
    hasCookies: !!cookies,
    authToken: authToken ? "present" : "absent",
    refreshToken: refreshToken ? "present" : "absent",
    environment: process.env.NODE_ENV,
    domain:
      process.env.NODE_ENV === "production" ? ".luisardito.com" : "localhost",
    userAgent: req.headers["user-agent"],
    origin: req.headers.origin,
    allCookies: req.cookies,
  });
});

// ==========================================
// DISCORD OAUTH
// ==========================================

/**
 * Starts the Discord OAuth flow
 */
exports.redirectDiscord = (req, res) => {
  try {
    logger.info("[Discord OAuth][redirectDiscord] Starting Discord OAuth flow");

    // Verify the user is authenticated
    const userId = req.user?.id;
    if (!userId) {
      logger.warn("[Discord OAuth][redirectDiscord] User not authenticated");
      return res.status(401).json({ error: "User not authenticated" });
    }

    const { code_verifier, code_challenge } = generatePkce();
    logger.info("[Discord OAuth][redirectDiscord] code_verifier generated");

    const statePayload = {
      cv: code_verifier,
      ruri: config.discord.redirectUri,
      userId: userId,
      iat: Math.floor(Date.now() / 1000),
    };
    const state = jwt.sign(statePayload, config.jwtSecret, {
      expiresIn: "10m",
    });

    logger.info(
      "[Discord OAuth][redirectDiscord] state created for userId:",
      userId
    );

    const params = new URLSearchParams({
      response_type: "code",
      client_id: String(config.discord.clientId || ""),
      redirect_uri: String(config.discord.redirectUri || ""),
      scope: "identify guilds.join",
      code_challenge: code_challenge,
      code_challenge_method: "S256",
      state,
    });

    const url = `${config.discord.oauthAuthorize}?${params.toString()}`;
    logger.info("[Discord OAuth][redirectDiscord] Redirect URL:", url);

    return res.redirect(url);
  } catch (err) {
    logger.error(
      "[Discord OAuth][redirectDiscord] Error:",
      err?.message || err
    );
    return res
      .status(500)
      .json({ error: "Could not start the Discord OAuth flow" });
  }
};

/**
 * Discord OAuth callback
 */
exports.callbackDiscord = async (req, res) => {
  try {
    const { code, state } = req.query || {};
    logger.info("[Discord OAuth][callbackDiscord] Parameters received:", {
      code,
      state,
    });

    if (!code || !state) {
      logger.warn(
        "[Discord OAuth][callbackDiscord] Missing code/state parameters"
      );
      return res.status(400).json({ error: "Missing code/state parameters" });
    }

    let decoded;
    try {
      decoded = jwt.verify(String(state), config.jwtSecret);
      logger.info("[Discord OAuth][callbackDiscord] Decoded state:", decoded);
    } catch (e) {
      logger.error(
        "[Discord OAuth][callbackDiscord] Invalid or expired state:",
        e?.message || e
      );
      return res.status(400).json({ error: "Invalid or expired state" });
    }

    const code_verifier = decoded?.cv;
    const finalRedirectUri = decoded?.ruri || config.discord.redirectUri;
    const userId = decoded?.userId;

    logger.info("[Discord OAuth][callbackDiscord] Extracted data:", {
      code_verifier: !!code_verifier,
      finalRedirectUri,
      userId,
    });

    if (!code_verifier || !finalRedirectUri || !userId) {
      logger.error("[Discord OAuth][callbackDiscord] Invalid data in state");
      return res.status(400).json({ error: "Invalid data in state" });
    }

    // Verify the user exists
    const usuario = await Usuario.findByPk(userId);
    if (!usuario) {
      logger.error("[Discord OAuth][callbackDiscord] User not found:", userId);
      return res.status(404).json({ error: "User not found" });
    }

    // Exchange code for tokens
    const tokenUrl = config.discord.oauthToken;
    const clientId = config.discord.clientId;
    const clientSecret = config.discord.clientSecret;

    if (!clientId || !clientSecret) {
      logger.error(
        "[Discord OAuth][callbackDiscord] Missing DISCORD_CLIENT_ID/DISCORD_CLIENT_SECRET configuration"
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
      "[Discord OAuth][callbackDiscord] Exchanging code for tokens..."
    );

    const tokenRes = await axios.post(tokenUrl, params.toString(), {
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      timeout: 10000,
    });

    const tokenData = tokenRes.data;
    logger.info(
      "[Discord OAuth][callbackDiscord] Tokens obtained successfully"
    );

    // Get Discord user info
    const userUrl = `${config.discord.apiBaseUrl}/users/@me`;
    const userRes = await axios.get(userUrl, {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
      timeout: 10000,
    });

    const discordUser = userRes.data;
    logger.info("[Discord OAuth][callbackDiscord] Discord user obtained:", {
      id: discordUser.id,
      username: discordUser.username,
      discriminator: discordUser.discriminator,
    });

    // Check if a link already exists
    const existingLink = await DiscordUserLink.findOne({
      where: { discord_user_id: discordUser.id },
    });

    if (existingLink) {
      if (existingLink.tienda_user_id === userId) {
        logger.info(
          "[Discord OAuth][callbackDiscord] User already linked, updating tokens"
        );
        // Update tokens
        await existingLink.update({
          discord_username: discordUser.username,
          discord_discriminator: discordUser.discriminator,
          discord_avatar: discordUser.avatar,
          access_token: tokenData.access_token,
          refresh_token: tokenData.refresh_token || null,
          token_expires_at: tokenData.expires_in
            ? new Date(Date.now() + tokenData.expires_in * 1000)
            : null,
        });
      } else {
        logger.warn(
          "[Discord OAuth][callbackDiscord] Discord ID already linked to another user"
        );
        return res.status(409).json({
          error: "This Discord account is already linked to another user",
        });
      }
    } else {
      // Create new link
      logger.info("[Discord OAuth][callbackDiscord] Creating new link");
      await DiscordUserLink.create({
        discord_user_id: discordUser.id,
        discord_username: discordUser.username,
        discord_discriminator: discordUser.discriminator,
        discord_avatar: discordUser.avatar,
        tienda_user_id: userId,
        kick_user_id: usuario.user_id_ext,
        access_token: tokenData.access_token,
        refresh_token: tokenData.refresh_token || null,
        token_expires_at: tokenData.expires_in
          ? new Date(Date.now() + tokenData.expires_in * 1000)
          : null,
      });
    }

    // Update discord_username on the user if missing
    if (!usuario.discord_username) {
      await usuario.update({
        discord_username: `${discordUser.username}#${discordUser.discriminator}`,
      });
    }

    logger.info(
      "[Discord OAuth][callbackDiscord] Linking completed successfully"
    );

    // Redirect to frontend with success
    const frontendUrl = config.frontendUrl || "https://luisardito.com";
    return res.redirect(`${frontendUrl}/perfil?discord_linked=success`);
  } catch (error) {
    logger.error("[Discord OAuth][callbackDiscord] Error:", error);
    const frontendUrl = config.frontendUrl || "https://luisardito.com";
    return res.redirect(`${frontendUrl}/perfil?discord_linked=error`);
  }
};

/**
 * Manual Discord linking (via temporary code)
 */
exports.linkDiscordManual = asyncHandler(async (req, _res) => {
  const { code } = req.body;
  const userId = req.user?.id;

  if (!userId) {
    throw new AppError("User not authenticated", 401);
  }

  if (!code) {
    throw new AppError("Code required", 400);
  }

  // Here we would implement the temporary code logic
  // For now, return that it is not implemented
  logger.info("[Discord OAuth][linkDiscordManual] Method not implemented yet");
  throw new AppError("Method not implemented", 501);
});

/**
 * Unlink Discord account
 */
exports.unlinkDiscord = asyncHandler(async (req, res) => {
  const userId = req.user?.id;

  if (!userId) {
    throw new AppError("User not authenticated", 401);
  }

  logger.info(
    "[Discord OAuth][unlinkDiscord] Unlinking Discord for user:",
    userId
  );

  // Find and delete the Discord link
  const discordLink = await DiscordUserLink.findOne({
    where: { tienda_user_id: userId },
  });

  if (!discordLink) {
    logger.warn(
      "[Discord OAuth][unlinkDiscord] No Discord link found for user:",
      userId
    );
    throw new AppError("No linked Discord account", 404);
  }

  // Delete the link
  await discordLink.destroy();

  // Clear discord_username on the user if present
  const usuario = await Usuario.findByPk(userId);
  if (usuario && usuario.discord_username) {
    await usuario.update({ discord_username: null });
  }

  logger.info(
    "[Discord OAuth][unlinkDiscord] Discord unlinked successfully for user:",
    userId
  );

  // Enrich user info with Discord data (should now be null)
  const { discord_info, display_name } =
    await enrichUserWithDiscordInfo(usuario);

  return res.json({
    message: "Discord account unlinked successfully",
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
