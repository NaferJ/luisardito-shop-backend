import express, {
  type Request,
  type Response,
  type NextFunction,
} from "express";
import cookieParser from "cookie-parser";
import customCors from "./src/middleware/cors.middleware";
import {
  notFoundHandler,
  errorHandler,
} from "./src/middleware/errorHandler.middleware";
import { sequelize } from "./src/models";
import config from "./config";
import logger from "./src/utils/logger";

// Services
import tokenRefreshService from "./src/services/tokenRefresh.service";
import VipCleanupTask from "./src/services/vipCleanup.task";
import botMaintenanceService from "./src/services/botMaintenance.service";
import LeaderboardSnapshotTask from "./src/services/leaderboardSnapshot.task";
import backupScheduler from "./src/services/backup.task";
import discordBotService from "./src/services/discordBot.service";
import kickBotAutoSendService from "./src/services/kickBotAutoSend.service";
import dbCleanupTask from "./src/services/dbCleanup.task";

// Routes
import authRoutes from "./src/routes/auth.routes";
import usuariosRoutes from "./src/routes/usuarios.routes";
import productosRoutes from "./src/routes/productos.routes";
import canjesRoutes from "./src/routes/canjes.routes";
import historialPuntosRoutes from "./src/routes/historialPuntos.routes";
import kickWebhookRoutes from "./src/routes/kickWebhook.routes";
import kickSubscriptionRoutes from "./src/routes/kickSubscription.routes";
import kickPointsConfigRoutes from "./src/routes/kickPointsConfig.routes";
import kickBroadcasterRoutes from "./src/routes/kickBroadcaster.routes";
import kickAdminRoutes from "./src/routes/kickAdmin.routes";
import kickBotCommandsRoutes from "./src/routes/kickBotCommands.routes";
import leaderboardRoutes from "./src/routes/leaderboard.routes";
import promocionesRoutes from "./src/routes/promociones.routes";
import broadcasterInfoRoutes from "./src/routes/broadcasterInfo.routes";
import notificacionesRoutes from "./src/routes/notificaciones.routes";

const app = express();

// Disable X-Powered-By header to avoid revealing framework info
app.disable("x-powered-by");

app.get("/", (_req: Request, res: Response) => {
  res.json({ service: "luisardito-shop-backend", status: "ok" });
});

// Global middleware
app.use(customCors);
app.use(cookieParser()); // Parse cookies
app.use(express.json());

// Serve static files from assets
app.use("/assets", express.static("assets"));

// Webhook-specific middleware with optimized logging
app.use(
  "/api/kick-webhook",
  (req: Request, _res: Response, next: NextFunction) => {
    const hasKickHeaders = Object.keys(req.headers).some((key) =>
      key.toLowerCase().startsWith("kick-event")
    );

    if (hasKickHeaders) {
      logger.info("[WEBHOOK] New Kick request:", req.method, req.originalUrl);
    }
    next();
  }
);

// Main routes
app.use("/api/auth", authRoutes);
app.use("/api/usuarios", usuariosRoutes);
app.use("/api/productos", productosRoutes);
app.use("/api/canjes", canjesRoutes);
app.use("/api/historial-puntos", historialPuntosRoutes);
app.use("/api/kick-webhook", kickWebhookRoutes);
app.use("/api/kick", kickSubscriptionRoutes);
app.use("/api/kick", kickPointsConfigRoutes);
app.use("/api/kick", kickBroadcasterRoutes);
app.use("/api/kick-admin", kickAdminRoutes);
app.use("/api/kick-admin/bot-commands", kickBotCommandsRoutes);
app.use("/api/leaderboard", leaderboardRoutes);
app.use("/api/promociones", promocionesRoutes);
app.use("/api/broadcaster", broadcasterInfoRoutes); // Public route for broadcaster info
app.use("/api/notificaciones", notificacionesRoutes); // Notifications route

// Health endpoint for liveness/readiness checks
app.get("/health", (_req: Request, res: Response) => {
  res.status(200).json({ status: "ok" });
});

// Centralized error handling (must be registered after all routes)
app.use(notFoundHandler); // catches unmatched routes
app.use(errorHandler); // last middleware, 4-arg error handler

// Sync models and start server with DB connection retries
const start = async (): Promise<void> => {
  const retries = Number(process.env.DB_CONNECT_RETRIES || 30);
  const delayMs = Number(process.env.DB_CONNECT_RETRY_DELAY_MS || 2000);

  let connected = false;
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      await sequelize.authenticate();
      connected = true;
      break;
    } catch (err: unknown) {
      const code =
        (err as { parent?: { code?: string }; name?: string })?.parent?.code ||
        (err as { name?: string })?.name ||
        "UNKNOWN_ERROR";
      logger.error(
        `DB connection failed (attempt ${attempt}/${retries}) [${code}]. Retrying in ${delayMs}ms...`
      );
      await new Promise((r) => setTimeout(r, delayMs));
    }
  }

  if (!connected) {
    logger.error(
      "Could not connect to the database after multiple attempts. Exiting..."
    );
    process.exit(1);
  }

  try {
    await sequelize.sync();
    logger.info("Database connected and models synchronized");

    // Start automatic token refresh service
    tokenRefreshService.start();

    // Start expired VIP cleanup
    VipCleanupTask.start();

    // Start Kick bot automatic maintenance
    botMaintenanceService.start();

    // Start automatic leaderboard snapshots
    LeaderboardSnapshotTask.start();

    // Start automatic backups
    backupScheduler.start();

    // Start automatic database cleanup (daily at 4:30 AM)
    dbCleanupTask.start();

    // Start Discord bot
    await discordBotService.initialize();

    // Start auto-send commands service
    kickBotAutoSendService.start();

    app.listen(config.port, () => {
      // Detect Docker to show the correct port
      const isDocker =
        process.env.NODE_ENV === "development" &&
        process.env.CHOKIDAR_USEPOLLING === "true";

      if (isDocker) {
        logger.info(`Server listening on:`);
        logger.info(
          `   - Internal (container): http://localhost:${config.port}`
        );
        logger.info(`   - External (host machine): http://localhost:3001`);
        logger.info(`   Use http://localhost:3001 from your browser`);
      } else {
        logger.info(`Server listening on http://localhost:${config.port}`);
      }
    });
  } catch (err: unknown) {
    logger.error("Error synchronizing models:", err);
    process.exit(1);
  }
};

if (require.main === module) {
  void start();
}

export = app;
