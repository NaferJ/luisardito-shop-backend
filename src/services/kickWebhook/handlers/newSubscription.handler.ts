import { processSubscriptionEvent } from "./subscriptionShared.handler";
import type {
  SubscriptionSharedPayload,
  WebhookMetadata,
} from "./subscriptionShared.handler";

/**
 * Handle new subscriptions
 */
async function handleNewSubscription(payload: unknown, _metadata: unknown) {
  await processSubscriptionEvent(
    payload as SubscriptionSharedPayload,
    _metadata as WebhookMetadata,
    {
      logLabel: "New Subscription",
      configKey: "subscription_new_points",
      eventType: "channel.subscription.new",
      conceptPrefix: "New subscription",
      logVerb: "sub until",
      includeUserType: true,
      sendNotification: true,
    }
  );
}

export { handleNewSubscription };
