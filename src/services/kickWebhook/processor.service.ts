import logger from "../../utils/logger";
import { handleChatMessage } from "./handlers/chatMessage.handler";
import { handleChannelFollowed } from "./handlers/channelFollowed.handler";
import { handleNewSubscription } from "./handlers/newSubscription.handler";
import { handleSubscriptionRenewal } from "./handlers/subscriptionRenewal.handler";
import { handleSubscriptionGifts } from "./handlers/subscriptionGifts.handler";
import { handleLivestreamStatusUpdated } from "./handlers/livestreamStatusUpdated.handler";
import { handleLivestreamMetadataUpdated } from "./handlers/livestreamMetadataUpdated.handler";
import { handleModerationBanned } from "./handlers/moderationBanned.handler";
import { handleKicksGifted } from "./handlers/kicksGifted.handler";
import { handleRewardRedemption } from "./handlers/rewardRedemption.handler";

/** Webhook metadata received alongside each event. */
interface WebhookMetadata {
  messageId: string;
  subscriptionId: string;
  timestamp: string;
  [key: string]: unknown;
}

/** Handler function signature for all event handlers. */
type EventHandler = (
  payload: unknown,
  metadata: WebhookMetadata
) => boolean | void | Promise<boolean | void>;

/**
 * Process event by type
 * @param eventType - Event type (e.g. chat.message.sent)
 * @param eventVersion - Event version
 * @param payload - Event data
 * @param metadata - Webhook metadata (messageId, subscriptionId, timestamp)
 * @returns false when the handler caught and logged a processing failure
 */
async function processWebhookEvent(
  eventType: string,
  eventVersion: number,
  payload: unknown,
  metadata: WebhookMetadata
): Promise<boolean> {
  logger.info(`[Kick Webhook] Processing event ${eventType}`);

  const handlers: Record<string, EventHandler> = {
    "chat.message.sent": handleChatMessage,
    "channel.followed": handleChannelFollowed,
    "channel.subscription.new": handleNewSubscription,
    "channel.subscription.renewal": handleSubscriptionRenewal,
    "channel.subscription.gifts": handleSubscriptionGifts,
    "livestream.status.updated": handleLivestreamStatusUpdated,
    "livestream.metadata.updated": handleLivestreamMetadataUpdated,
    "moderation.banned": handleModerationBanned,
    "kicks.gifted": handleKicksGifted,
    "channel.reward.redemption.updated": handleRewardRedemption,
  };

  const handler = handlers[eventType];
  if (!handler) {
    logger.warn(`UNHANDLED EVENT: "${eventType}"`);
    return true;
  }

  const result = await handler(payload, metadata);
  return result !== false;
}

export { processWebhookEvent };
