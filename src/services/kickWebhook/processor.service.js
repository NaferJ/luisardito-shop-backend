const logger = require("../../utils/logger");
const { handleChatMessage } = require("./handlers/chatMessage.handler");
const { handleChannelFollowed } = require("./handlers/channelFollowed.handler");
const { handleNewSubscription } = require("./handlers/newSubscription.handler");
const {
  handleSubscriptionRenewal,
} = require("./handlers/subscriptionRenewal.handler");
const {
  handleSubscriptionGifts,
} = require("./handlers/subscriptionGifts.handler");
const {
  handleLivestreamStatusUpdated,
} = require("./handlers/livestreamStatusUpdated.handler");
const {
  handleLivestreamMetadataUpdated,
} = require("./handlers/livestreamMetadataUpdated.handler");
const {
  handleModerationBanned,
} = require("./handlers/moderationBanned.handler");
const { handleKicksGifted } = require("./handlers/kicksGifted.handler");
const {
  handleRewardRedemption,
} = require("./handlers/rewardRedemption.handler");

/**
 * Process event by type
 * @param {string} eventType - Event type (e.g. chat.message.sent)
 * @param {string} eventVersion - Event version
 * @param {object} payload - Event data
 * @param {object} metadata - Webhook metadata (messageId, subscriptionId, timestamp)
 */
async function processWebhookEvent(eventType, eventVersion, payload, metadata) {
  logger.info(`[Kick Webhook] Processing event ${eventType}`);

  const handlers = {
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
    logger.info(`[Kick Webhook] Unhandled event type: ${eventType}`);
  }
}

module.exports = { processWebhookEvent };
