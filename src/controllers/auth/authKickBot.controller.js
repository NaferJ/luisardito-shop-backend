const jwt = require("jsonwebtoken");
const axios = require("axios");
const config = require("../../../config");
const { generatePkce } = require("../../utils/pkce.util");
const { getKickUserData } = require("../../utils/kickApi");
const KickBotTokenService = require("../../services/kickBotToken.service");
const logger = require("../../utils/logger");

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
      const tokensFile = path.join(__dirname, "../../../tokens/tokens.json");
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
