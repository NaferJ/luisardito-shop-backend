import logger from "../../../utils/logger";

/**
 * Handle moderation bans
 */
export async function handleModerationBanned(payload: any, _metadata: any) {
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
