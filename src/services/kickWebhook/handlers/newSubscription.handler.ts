/* eslint-disable @typescript-eslint/no-explicit-any */
// TEMPORARY eslint override — to be removed in the typing pass

import { processSubscriptionEvent } from "./subscriptionShared.handler";

/**
 * Handle new subscriptions
 */
async function handleNewSubscription(payload: any, _metadata: any) {
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

export { handleNewSubscription };
