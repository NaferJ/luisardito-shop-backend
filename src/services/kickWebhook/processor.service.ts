/* eslint-disable @typescript-eslint/no-explicit-any */
// TEMPORARY eslint override — to be removed in the typing pass

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

/**
 * Process event by type
 * @param {string} eventType - Event type (e.g. chat.message.sent)
 * @param {string} eventVersion - Event version
 * @param {object} payload - Event data
 * @param {object} metadata - Webhook metadata (messageId, subscriptionId, timestamp)
 */
async function processWebhookEvent(
  eventType: any,
  eventVersion: any,
  payload: any,
  metadata: any
) {
  logger.info(`[Kick Webhook] Processing event ${eventType}`);

  const handlers: any = {
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
  if (handler) {
    await handler(payload, metadata);
  } else {
    logger.warn(`UNHANDLED EVENT: "${eventType}"`);
  }
}

export { processWebhookEvent };
