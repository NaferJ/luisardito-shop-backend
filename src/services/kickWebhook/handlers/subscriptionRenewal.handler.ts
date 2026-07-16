import { processSubscriptionEvent } from "./subscriptionShared.handler";
import type {
  SubscriptionSharedPayload,
  WebhookMetadata,
} from "./subscriptionShared.handler";

/**
 * Handle subscription renewals
 */
async function handleSubscriptionRenewal(payload: unknown, _metadata: unknown) {
  await processSubscriptionEvent(
    payload as SubscriptionSharedPayload,
    _metadata as WebhookMetadata,
    {
      logLabel: "Subscription Renewal",
      configKey: "subscription_renewal_points",
      eventType: "channel.subscription.renewal",
      conceptPrefix: "Subscription renewal",
      logVerb: "sub renewed until",
      includeUserType: false,
      sendNotification: false,
    }
  );
}

export { handleSubscriptionRenewal };
