const express = require("express");
const cookieParser = require("cookie-parser");
const customCors = require("./src/middleware/cors.middleware");
const {
  notFoundHandler,
  errorHandler,
} = require("./src/middleware/errorHandler.middleware");
const { sequelize } = require("./src/models");
const config = require("./config");
const logger = require("./src/utils/logger");

// Services
const tokenRefreshService = require("./src/services/tokenRefresh.service");
const VipCleanupTask = require("./src/services/vipCleanup.task");
const botMaintenanceService = require("./src/services/botMaintenance.service");
const LeaderboardSnapshotTask = require("./src/services/leaderboardSnapshot.task");
const backupScheduler = require("./src/services/backup.task");
const discordBotService = require("./src/services/discordBot.service");
const kickBotAutoSendService = require("./src/services/kickBotAutoSend.service");
const dbCleanupTask = require("./src/services/dbCleanup.task");

// Routes
const authRoutes = require("./src/routes/auth.routes");
const usuariosRoutes = require("./src/routes/usuarios.routes");
const productosRoutes = require("./src/routes/productos.routes");
const canjesRoutes = require("./src/routes/canjes.routes");
const historialPuntosRoutes = require("./src/routes/historialPuntos.routes");
const kickWebhookRoutes = require("./src/routes/kickWebhook.routes");
const kickSubscriptionRoutes = require("./src/routes/kickSubscription.routes");
const kickPointsConfigRoutes = require("./src/routes/kickPointsConfig.routes");
const kickBroadcasterRoutes = require("./src/routes/kickBroadcaster.routes");
const kickAdminRoutes = require("./src/routes/kickAdmin.routes");
const kickBotCommandsRoutes = require("./src/routes/kickBotCommands.routes");
const leaderboardRoutes = require("./src/routes/leaderboard.routes");
const promocionesRoutes = require("./src/routes/promociones.routes");
const broadcasterInfoRoutes = require("./src/routes/broadcasterInfo.routes");
const notificacionesRoutes = require("./src/routes/notificaciones.routes");

const app = express();

// Disable X-Powered-By header to avoid revealing framework info
app.disable("x-powered-by");

app.get("/", (req, res) => {
  res.json({ service: "luisardito-shop-backend", status: "ok" });
});

// Global middleware
app.use(customCors);
app.use(cookieParser()); // Parse cookies
app.use(express.json());

// Serve static files from assets
app.use("/assets", express.static("assets"));

// Webhook-specific middleware with optimized logging
app.use("/api/kick-webhook", (req, res, next) => {
  const hasKickHeaders = Object.keys(req.headers).some((key) =>
    key.toLowerCase().startsWith("kick-event")
  );

  if (hasKickHeaders) {
    logger.info("[WEBHOOK] New Kick request:", req.method, req.originalUrl);
  }
  next();
});

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
app.get("/health", (req, res) => {
  res.status(200).json({ status: "ok" });
});

// Centralized error handling (must be registered after all routes)
app.use(notFoundHandler); // catches unmatched routes
app.use(errorHandler); // last middleware, 4-arg error handler

// Sync models and start server with DB connection retries
const start = async () => {
  const retries = Number(process.env.DB_CONNECT_RETRIES || 30);
  const delayMs = Number(process.env.DB_CONNECT_RETRY_DELAY_MS || 2000);

  let connected = false;
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      await sequelize.authenticate();
      connected = true;
      break;
    } catch (err) {
      const code = err?.parent?.code || err?.name || "UNKNOWN_ERROR";
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
  } catch (err) {
    logger.error("Error synchronizing models:", err);
    process.exit(1);
  }
};

if (require.main === module) {
  start();
}

module.exports = app;
