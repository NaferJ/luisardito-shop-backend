import { processSubscriptionEvent } from "./subscriptionShared";

/**
 * Handle subscription renewals
 */
export async function handleSubscriptionRenewal(payload: any, _metadata: any) {
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
