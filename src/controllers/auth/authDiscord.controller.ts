/* eslint-disable @typescript-eslint/no-explicit-any */
// TEMPORARY eslint override — to be removed in the typing pass

import jwt from "jsonwebtoken";
import axios from "axios";
import config from "../../../config";
import { Usuario, DiscordUserLink } from "../../models";
import { generatePkce } from "../../utils/pkce.util";
import {
  enrichUserWithDiscordInfo,
  findDiscordLinkByUserId,
  buildDiscordDisplayName,
} from "./auth.shared";
import logger from "../../utils/logger";
import asyncHandler from "../../utils/asyncHandler";
import AppError from "../../utils/AppError";

// ==========================================
// DISCORD OAUTH
// ==========================================

function computeTokenExpiry(expiresIn: any) {
  return expiresIn ? new Date(Date.now() + expiresIn * 1000) : null;
}

function buildDiscordLinkFields(discordUser: any, tokenData: any) {
  return {
    discord_username: discordUser.username,
    discord_discriminator: discordUser.discriminator,
    discord_avatar: discordUser.avatar,
    access_token: tokenData.access_token,
    refresh_token: tokenData.refresh_token || null,
    token_expires_at: computeTokenExpiry(tokenData.expires_in),
  };
}

async function upsertDiscordLink(
  existingLink: any,
  userId: any,
  usuario: any,
  discordUser: any,
  tokenData: any
) {
  if (existingLink) {
    if (existingLink.tienda_user_id === userId) {
      logger.info(
        "[Discord OAuth][callbackDiscord] User already linked, updating tokens"
      );
      // Update tokens
      await existingLink.update(buildDiscordLinkFields(discordUser, tokenData));
    } else {
      logger.warn(
        "[Discord OAuth][callbackDiscord] Discord ID already linked to another user"
      );
      return { conflict: true };
    }
  } else {
    // Create new link
    logger.info("[Discord OAuth][callbackDiscord] Creating new link");
    await DiscordUserLink.create({
      discord_user_id: discordUser.id,
      ...buildDiscordLinkFields(discordUser, tokenData),
      tienda_user_id: userId,
      kick_user_id: usuario.user_id_ext,
    });
  }
  return { conflict: false };
}

/**
 * Starts the Discord OAuth flow
 */
const redirectDiscord = (req: any, res: any) => {
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
  } catch (err: any) {
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
const callbackDiscord = async (req: any, res: any) => {
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
    } catch (e: any) {
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
    const usuario: any = await Usuario.findByPk(userId);
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

    const linkResult = await upsertDiscordLink(
      existingLink,
      userId,
      usuario,
      discordUser,
      tokenData
    );
    if (linkResult.conflict) {
      return res.status(409).json({
        error: "This Discord account is already linked to another user",
      });
    }

    // Update discord_username on the user if missing
    if (!usuario.discord_username) {
      await usuario.update({
        discord_username: buildDiscordDisplayName(
          discordUser.username,
          discordUser.discriminator
        ),
      });
    }

    logger.info(
      "[Discord OAuth][callbackDiscord] Linking completed successfully"
    );

    // Redirect to frontend with success
    const frontendUrl = config.frontendUrl || "https://luisardito.com";
    return res.redirect(`${frontendUrl}/perfil?discord_linked=success`);
  } catch (error: any) {
    logger.error("[Discord OAuth][callbackDiscord] Error:", error);
    const frontendUrl = config.frontendUrl || "https://luisardito.com";
    return res.redirect(`${frontendUrl}/perfil?discord_linked=error`);
  }
};

/**
 * Manual Discord linking (via temporary code)
 */
const linkDiscordManual = asyncHandler(async (req: any, _res: any) => {
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
const unlinkDiscord = asyncHandler(async (req: any, res: any) => {
  const userId = req.user?.id;

  if (!userId) {
    throw new AppError("User not authenticated", 401);
  }

  logger.info(
    "[Discord OAuth][unlinkDiscord] Unlinking Discord for user:",
    userId
  );

  // Find and delete the Discord link
  const discordLink = await findDiscordLinkByUserId(userId);

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
  const usuario: any = await Usuario.findByPk(userId);
  if (usuario?.discord_username) {
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

export { redirectDiscord, callbackDiscord, linkDiscordManual, unlinkDiscord };
