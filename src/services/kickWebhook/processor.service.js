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

  // DEBUG LOG - SEE ALL EVENTS

  // Check exact value
  if (eventType === "livestream.status.updated") {
    logger.warn(`EXACT MATCH: livestream.status.updated`);
  } else if (eventType?.includes?.("livestream")) {
    logger.warn(`CONTAINS livestream BUT NO MATCH: "${eventType}"`);
  }

  switch (eventType) {
    case "chat.message.sent":
      await handleChatMessage(payload, metadata);
      break;

    case "channel.followed":
      logger.info("CASE MATCH: channel.followed");
      await handleChannelFollowed(payload, metadata);
      break;

    case "channel.subscription.new":
      logger.info("CASE MATCH: channel.subscription.new");
      await handleNewSubscription(payload, metadata);
      break;

    case "channel.subscription.renewal":
      logger.info("CASE MATCH: channel.subscription.renewal");
      await handleSubscriptionRenewal(payload, metadata);
      break;

    case "channel.subscription.gifts":
      logger.info("CASE MATCH: channel.subscription.gifts");
      await handleSubscriptionGifts(payload, metadata);
      break;

    case "livestream.status.updated":
      logger.info("CASE MATCH: livestream.status.updated");
      await handleLivestreamStatusUpdated(payload, metadata);
      break;

    case "livestream.metadata.updated":
      logger.info("CASE MATCH: livestream.metadata.updated");
      await handleLivestreamMetadataUpdated(payload, metadata);
      break;

    case "moderation.banned":
      logger.info("CASE MATCH: moderation.banned");
      await handleModerationBanned(payload, metadata);
      break;

    case "kicks.gifted":
      logger.info("CASE MATCH: kicks.gifted");
      await handleKicksGifted(payload, metadata);
      break;

    case "channel.reward.redemption.updated":
      logger.info("CASE MATCH: channel.reward.redemption.updated");
      await handleRewardRedemption(payload, metadata);
      break;

    default:
      logger.warn(`UNHANDLED EVENT: "${eventType}"`);
      logger.info(`[Kick Webhook] Unhandled event type: ${eventType}`);
  }
}

module.exports = { processWebhookEvent };
