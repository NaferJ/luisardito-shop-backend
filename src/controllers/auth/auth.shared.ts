import { DiscordUserLink, Usuario } from "../../models";
import { extractAvatarUrl } from "../../utils/kickApi";
import logger from "../../utils/logger";

/**
 * Find a DiscordUserLink by tienda_user_id
 * @param userId - User id
 */
async function findDiscordLinkByUserId(userId: number) {
  return DiscordUserLink.findOne({
    where: { tienda_user_id: userId },
  });
}

/**
 * Build a Discord display name from username and discriminator.
 * Returns "username#discriminator" when a non-zero discriminator exists,
 * otherwise just the username.
 * @param username
 * @param discriminator
 * @returns Display name string
 */
function buildDiscordDisplayName(
  username: string,
  discriminator: string
): string {
  return discriminator && discriminator !== "0"
    ? `${username}#${discriminator}`
    : username;
}

/**
 * Helper to enrich user info with Discord data
 * @param user - User model instance
 * @returns Enriched Discord info
 */
async function enrichUserWithDiscordInfo(user: Usuario) {
  let discordInfo = null;
  const discordLink = await findDiscordLinkByUserId(user.id);

  if (discordLink) {
    discordInfo = {
      linked: true,
      id: discordLink.discord_user_id,
      username: discordLink.discord_username,
      discriminator: discordLink.discord_discriminator,
      avatar: discordLink.discord_avatar,
      linked_at: discordLink.created_at,
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
 * @param kickUser - Kick user data
 * @returns Kick avatar URL or null if absent
 */
function processKickAvatar(kickUser: unknown): string | null {
  try {
    const kickAvatarUrl = extractAvatarUrl(kickUser as Record<string, unknown>);

    if (!kickAvatarUrl) {
      logger.info(`[Auth] No avatar found in Kick data`);
      return null;
    }

    logger.info(`[Auth] Kick avatar obtained:`, kickAvatarUrl);
    return kickAvatarUrl;
  } catch (error) {
    logger.warn(
      `[Auth] Error extracting avatar, continuing without it:`,
      error instanceof Error ? error.message : String(error)
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
