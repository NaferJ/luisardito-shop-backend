import type { RequestHandler } from "express";

/**
 * Webhook middleware - Optimized for production
 */

const logWebhookRequest: RequestHandler = (req, _res, next) => {
  // Only log for real Kick webhooks
  const hasKickHeaders = Object.keys(req.headers).some((key: string) =>
    key.toLowerCase().startsWith("kick-event")
  );

  if (hasKickHeaders || req.body?.test) {
    const kickHeaders: Record<string, string | string[]> = {};
    Object.keys(req.headers).forEach((key: string) => {
      if (key.toLowerCase().startsWith("kick-event")) {
        kickHeaders[key] = req.headers[key];
      }
    });

    if (Object.keys(kickHeaders).length > 0) {
      // logger.debug('[KICK HEADERS]', kickHeaders);
    }

    if (req.body && Object.keys(req.body).length > 0) {
      // logger.debug('[PAYLOAD]', JSON.stringify(req.body).substring(0, 200) + '...');
    }
  }

  next();
};

const webhookCors: RequestHandler = (req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Methods", "*");
  res.header("Access-Control-Allow-Headers", "*");

  if (req.method === "OPTIONS") {
    res.sendStatus(200);
    return;
  }

  next();
};

export { webhookCors, logWebhookRequest };
