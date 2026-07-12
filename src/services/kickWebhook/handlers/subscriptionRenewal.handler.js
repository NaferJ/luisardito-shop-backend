const { processSubscriptionEvent } = require("./subscriptionShared");

/**
 * Handle subscription renewals
 */
async function handleSubscriptionRenewal(payload, _metadata) {
  await processSubscriptionEvent(payload, _metadata, {
    logLabel: "Subscription Renewal",
    configKey: "subscription_renewal_points",
    eventType: "channel.subscription.renewal",
    conceptPrefix: "Subscription renewal",
    logVerb: "sub renewed until",
    includeUserType: false,
    sendNotification: false,
  });
}

module.exports = { handleSubscriptionRenewal };
