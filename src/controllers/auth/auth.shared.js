const { DiscordUserLink } = require("../../models");
const { extractAvatarUrl } = require("../../utils/kickApi");
const logger = require("../../utils/logger");

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

module.exports = { enrichUserWithDiscordInfo, processKickAvatar };
