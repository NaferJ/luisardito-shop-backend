const { processSubscriptionEvent } = require("./subscriptionShared");

/**
 * Handle new subscriptions
 */
async function handleNewSubscription(payload, _metadata) {
  await processSubscriptionEvent(payload, _metadata, {
    logLabel: "New Subscription",
    configKey: "subscription_new_points",
    eventType: "channel.subscription.new",
    conceptPrefix: "New subscription",
    logVerb: "sub until",
    includeUserType: true,
    sendNotification: true,
  });
}

module.exports = { handleNewSubscription };
