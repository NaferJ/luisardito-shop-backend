const logger = require("../../../utils/logger");

/**
 * Handle moderation bans
 */
async function handleModerationBanned(payload, _metadata) {
  logger.info("[Kick Webhook][Moderation Banned]", {
    broadcaster: payload.broadcaster.username,
    moderator: payload.moderator.username,
    banned_user: payload.banned_user.username,
    reason: payload.metadata.reason,
    expires_at: payload.metadata.expires_at,
  });

  // Ban business logic (register ban, update permissions, etc.) is not yet implemented.
  // Logging only — no action taken for moderation bans at this time.
}

module.exports = { handleModerationBanned };
