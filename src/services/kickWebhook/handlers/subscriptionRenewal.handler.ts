/* eslint-disable @typescript-eslint/no-explicit-any */
// TEMPORARY eslint override — to be removed in the typing pass

import { processSubscriptionEvent } from "./subscriptionShared.handler";

/**
 * Handle subscription renewals
 */
async function handleSubscriptionRenewal(payload: any, _metadata: any) {
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

export { handleSubscriptionRenewal };
