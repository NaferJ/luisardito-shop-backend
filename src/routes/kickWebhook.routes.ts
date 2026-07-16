import express from "express";
import kickWebhookCtrl from "../controllers/kickWebhook.controller";
import {
  debugStreamStatus,
  forceStreamState,
  getPublicPointsConfig,
} from "../controllers/kickWebhookDebug.controller";
import {
  webhookCors,
  logWebhookRequest,
} from "../middleware/webhook.middleware";

const router = express.Router();

// Apply webhook-specific CORS to all routes
router.use(webhookCors);
router.use(logWebhookRequest);

router.post("/events", kickWebhookCtrl.handleWebhook);
router.get("/events", kickWebhookCtrl.handleWebhook); // For GET verifications

// Stream
router.get("/debug-stream-status", debugStreamStatus);
router.post("/debug/force-stream-state", forceStreamState);

// PUBLIC ENDPOINT: Points configuration
router.get("/public/points-config", getPublicPointsConfig);

export = router;
