const { verifyWebhookSignature } = require("../utils/kickWebhook.util");
const { KickWebhookEvent } = require("../models");
const logger = require("../utils/logger");
const {
  processWebhookEvent,
} = require("../services/kickWebhook/processor.service");

/**
 * Main controller to receive Kick webhooks
 */
exports.handleWebhook = async (req, res) => {
  // Production-optimized logging
  const eventType = req.headers["kick-event-type"];
  const messageId = req.headers["kick-event-message-id"];

  // LOG ALL EVENTS - UNFILTERED

  try {
    // If it's a simple test request, respond immediately
    if (req.body && req.body.test === true) {
      return res.status(200).json({
        status: "success",
        message: "Test webhook received",
        timestamp: new Date().toISOString(),
      });
    }

    // Extract webhook headers
    const subscriptionId = req.headers["kick-event-subscription-id"];
    const signature = req.headers["kick-event-signature"];
    const timestamp = req.headers["kick-event-message-timestamp"];
    const eventVersion = req.headers["kick-event-version"];

    // If Kick webhook headers are missing but there's content, it may be a verification
    if (!messageId && !eventType) {
      return res.status(200).json({ message: "Webhook endpoint ready" });
    }

    // Validate required headers exist
    if (!messageId || !signature || !timestamp || !eventType) {
      logger.error("[Kick Webhook] Missing required headers");
      return res.status(400).json({ error: "Missing required headers" });
    }

    // Get raw body as string
    const rawBody = JSON.stringify(req.body);

    // Verify webhook signature
    const isValidSignature = verifyWebhookSignature(
      messageId,
      timestamp,
      rawBody,
      signature
    );

    if (!isValidSignature) {
      logger.error("[Kick Webhook] Invalid signature");
      return res.status(401).json({ error: "Invalid signature" });
    }

    // Check if event was already processed (idempotency)
    const existingEvent = await KickWebhookEvent.findOne({
      where: { message_id: messageId },
    });

    if (existingEvent) {
      return res.status(200).json({ message: "Event already processed" });
    }

    // Save event to database
    await KickWebhookEvent.create({
      message_id: messageId,
      subscription_id: subscriptionId,
      event_type: eventType,
      event_version: eventVersion,
      message_timestamp: new Date(timestamp),
      payload: req.body,
      processed: false,
    });

    // Process event by type
    await processWebhookEvent(eventType, eventVersion, req.body, {
      messageId,
      subscriptionId,
      timestamp,
    });

    // Mark as processed
    await KickWebhookEvent.update(
      { processed: true, processed_at: new Date() },
      { where: { message_id: messageId } }
    );

    // Respond with 200 to confirm receipt
    return res.status(200).json({ message: "Webhook processed successfully" });
  } catch (error) {
    logger.error("[Kick Webhook] Error processing webhook:", error.message);
    return res.status(500).json({ error: "Internal error processing webhook" });
  }
};
