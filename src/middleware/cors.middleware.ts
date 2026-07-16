import cors from "cors";
import type { RequestHandler } from "express";

// CORS optimized for production
const corsHandler: RequestHandler = (req, res, next) => {
  // Detect webhooks to allow full access
  const isWebhook =
    req.originalUrl && req.originalUrl.includes("/api/kick-webhook");

  if (isWebhook) {
    // Webhooks: allow everything
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Methods", "*");
    res.header("Access-Control-Allow-Headers", "*");
    res.header("Access-Control-Allow-Credentials", "true");
    res.header("Access-Control-Expose-Headers", "*");

    if (req.method === "OPTIONS") {
      res.sendStatus(200);
      return;
    }
    next();
    return;
  }

  // For everything else: specific CORS
  cors({
    origin: (origin, callback) => {
      const allowedOrigins = [
        "https://luisardito.com",
        "https://shop.luisardito.com",
        "https://www.luisardito.com",
        "http://localhost:3000",
        "http://localhost:3001",
        "http://localhost:3002",
        "http://localhost:5173",
        "http://127.0.0.1:3000",
        "http://127.0.0.1:3001",
        "http://127.0.0.1:3002",
        "http://127.0.0.1:5173",
      ];

      if (
        !origin ||
        allowedOrigins.includes(origin) ||
        origin.endsWith(".luisardito.com") ||
        origin.includes("kick.com")
      ) {
        callback(null, true);
      } else {
        callback(new Error("Not allowed by CORS"));
      }
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: [
      "Content-Type",
      "Authorization",
      "X-Requested-With",
      "Accept",
      "Origin",
      "Access-Control-Request-Method",
      "Access-Control-Request-Headers",
      "kick-event-message-id",
      "kick-event-subscription-id",
      "kick-event-signature",
      "kick-event-message-timestamp",
      "kick-event-type",
      "kick-event-version",
      "User-Agent",
    ],
    exposedHeaders: ["Set-Cookie"],
    maxAge: 86400,
  })(req, res, next);
};

export = corsHandler;
