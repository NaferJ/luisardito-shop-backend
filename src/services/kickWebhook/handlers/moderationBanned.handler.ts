import logger from "../../../utils/logger";

/** Payload shape for the moderation.banned event. */
interface ModerationBannedPayload {
  broadcaster: { username: string };
  moderator: { username: string };
  banned_user: { username: string };
  metadata: { reason: string; expires_at: string | null };
}

/**
 * Handle moderation bans
 */
async function handleModerationBanned(
  payload: ModerationBannedPayload,
  _metadata: unknown
) {
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

export { handleModerationBanned };
