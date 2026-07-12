import { processSubscriptionEvent } from "./subscriptionShared";

/**
 * Handle new subscriptions
 */
export async function handleNewSubscription(payload: any, _metadata: any) {
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
