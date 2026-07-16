/* eslint-disable @typescript-eslint/no-explicit-any */
// TEMPORARY eslint override — to be removed in the typing pass

/**
 * Webhook middleware - Optimized for production
 */

const logWebhookRequest = (req: any, _res: any, next: any) => {
  // Only log for real Kick webhooks
  const hasKickHeaders = Object.keys(req.headers).some((key: string) =>
    key.toLowerCase().startsWith("kick-event")
  );

  if (hasKickHeaders || req.body?.test) {
    const kickHeaders: any = {};
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

const webhookCors = (req: any, res: any, next: any) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Methods", "*");
  res.header("Access-Control-Allow-Headers", "*");

  if (req.method === "OPTIONS") {
    return res.sendStatus(200);
  }

  next();
};

export { webhookCors, logWebhookRequest };
