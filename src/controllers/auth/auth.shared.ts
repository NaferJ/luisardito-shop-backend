/* eslint-disable @typescript-eslint/no-explicit-any */
// TEMPORARY eslint override — to be removed in the typing pass

import { DiscordUserLink } from "../../models";
import { extractAvatarUrl } from "../../utils/kickApi";
import logger from "../../utils/logger";

/**
 * Find a DiscordUserLink by tienda_user_id
 * @param {number} userId - User id
 * @returns {Promise<Object|null>}
 */
async function findDiscordLinkByUserId(userId: any) {
  return DiscordUserLink.findOne({
    where: { tienda_user_id: userId },
  });
}

/**
 * Build a Discord display name from username and discriminator.
 * Returns "username#discriminator" when a non-zero discriminator exists,
 * otherwise just the username.
 * @param {string} username
 * @param {string} discriminator
 * @returns {string}
 */
function buildDiscordDisplayName(username: any, discriminator: any) {
  return discriminator && discriminator !== "0"
    ? `${username}#${discriminator}`
    : username;
}

/**
 * Helper to enrich user info with Discord data
 * @param {Object} user - User model instance
 * @returns {Promise<{discord_info: Object|null, display_name: string}>} Enriched Discord info
 */
async function enrichUserWithDiscordInfo(user: any) {
  let discordInfo = null;
  const discordLink: any = await findDiscordLinkByUserId(user.id);

  if (discordLink) {
    discordInfo = {
      linked: true,
      id: discordLink.discord_user_id,
      username: discordLink.discord_username,
      discriminator: discordLink.discord_discriminator,
      avatar: discordLink.discord_avatar,
      linked_at: discordLink.createdAt,
      display_name: buildDiscordDisplayName(
        discordLink.discord_username,
        discordLink.discord_discriminator
      ),
    };
  }

  return {
    discord_info: discordInfo,
    display_name: discordInfo?.display_name || user.nickname,
  };
}

/**
 * Extracts the Kick avatar
 * @param {Object} kickUser - Kick user data
 * @returns {string|null} - Kick avatar URL or null if absent
 */
function processKickAvatar(kickUser: any) {
  try {
    const kickAvatarUrl = extractAvatarUrl(kickUser);

    if (!kickAvatarUrl) {
      logger.info(`[Auth] No avatar found in Kick data`);
      return null;
    }

    logger.info(`[Auth] Kick avatar obtained:`, kickAvatarUrl);
    return kickAvatarUrl;
  } catch (error: any) {
    logger.warn(
      `[Auth] Error extracting avatar, continuing without it:`,
      error.message
    );
    return null;
  }
}

export {
  enrichUserWithDiscordInfo,
  processKickAvatar,
  findDiscordLinkByUserId,
  buildDiscordDisplayName,
};
