import { KickUserTracking } from "../models";

interface SubscriberStatus {
  /** True only when the user has an active (non-expired) subscription. */
  is_subscriber: boolean;
  /** Whether the subscription is currently active (not expired). */
  is_active: boolean;
  /** Whether the subscription expires within the next 7 days. */
  expires_soon: boolean;
  /** When the current subscription expires, if known. */
  expires_at: Date | null;
  /** Accumulated subscription duration reported by Kick, in months. */
  subscription_duration_months: number | null;
}

const INACTIVE: SubscriberStatus = {
  is_subscriber: false,
  is_active: false,
  expires_soon: false,
  expires_at: null,
  subscription_duration_months: null,
};

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * Resolves subscriber status, expiry, and duration from KickUserTracking.
 *
 * `is_subscriber` is true only for an active (non-expired) subscription, matching
 * the leaderboard response shape (issue #74). `subscription_duration_months` is
 * the accumulated subscription duration sent by Kick's subscription events.
 *
 * @param userIdExt - Kick user ID
 * @returns Subscriber status fields; all inactive/null when not subscribed or expired
 */
async function resolveSubscriberStatus(
  userIdExt: string | null
): Promise<SubscriberStatus> {
  if (!userIdExt) return INACTIVE;

  const userTracking = await KickUserTracking.findOne({
    where: { kick_user_id: userIdExt },
    attributes: [
      "is_subscribed",
      "subscription_expires_at",
      "subscription_duration_months",
    ],
    raw: true,
  });

  if (!userTracking?.is_subscribed) return INACTIVE;

  const now = new Date();
  const expiresAt = userTracking.subscription_expires_at
    ? new Date(userTracking.subscription_expires_at)
    : null;
  const isActive = !expiresAt || expiresAt > now;

  if (!isActive) return INACTIVE;

  return {
    is_subscriber: true,
    is_active: true,
    expires_soon:
      !!expiresAt && expiresAt <= new Date(now.getTime() + SEVEN_DAYS_MS),
    expires_at: expiresAt,
    subscription_duration_months:
      userTracking.subscription_duration_months ?? null,
  };
}

export { resolveSubscriberStatus };
export type { SubscriberStatus };
