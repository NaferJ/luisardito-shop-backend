const express = require("express");
const cookieParser = require("cookie-parser");
const customCors = require("./src/middleware/cors.middleware");
const { sequelize } = require("./src/models");
const config = require("./config");
const logger = require("./src/utils/logger");

// Servicios
const tokenRefreshService = require("./src/services/tokenRefresh.service");
const VipCleanupTask = require("./src/services/vipCleanup.task");
const botMaintenanceService = require("./src/services/botMaintenance.service");
const LeaderboardSnapshotTask = require("./src/services/leaderboardSnapshot.task");
const backupScheduler = require("./src/services/backup.task");
const discordBotService = require("./src/services/discordBot.service");
const kickBotAutoSendService = require("./src/services/kickBotAutoSend.service");

// Rutas (aún por crear)
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

app.get("/", (req, res) => {
  res.send("🚀 Luisardito Shop Backend en funcionamiento");
});

// Middleware global
app.use(customCors);
app.use(cookieParser()); // Para leer cookies
app.use(express.json());

// Servir archivos estáticos desde assets
app.use('/assets', express.static('assets'));

// Middleware específico para webhooks con logging optimizado
app.use("/api/kick-webhook", (req, res, next) => {
  const hasKickHeaders = Object.keys(req.headers).some((key) =>
    key.toLowerCase().startsWith("kick-event"),
  );

  if (hasKickHeaders) {
    logger.info(
      "🎯 [WEBHOOK] Nueva petición de Kick:",
      req.method,
      req.originalUrl,
    );
  }
  next();
});

// Rutas principales
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
app.use("/api/broadcaster", broadcasterInfoRoutes); // ✅ Ruta pública para info del broadcaster
app.use("/api/notificaciones", notificacionesRoutes); // ✅ Ruta de notificaciones

// Health endpoint for liveness/readiness checks
app.get("/health", (req, res) => {
  res.status(200).json({ status: "ok" });
});

// Sincronizar modelos y arrancar servidor con reintentos de conexión a la BD
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
        `⚠️  Falló la conexión a la BD (intento ${attempt}/${retries}) [${code}]. Reintentando en ${delayMs}ms...`,
      );
      await new Promise((r) => setTimeout(r, delayMs));
    }
  }

  if (!connected) {
    logger.error(
      "❌ No fue posible conectar a la base de datos tras múltiples intentos. Saliendo...",
    );
    process.exit(1);
  }

  try {
    await sequelize.sync();
    logger.info("✅ Base de datos conectada y modelos sincronizados");

    // Iniciar el servicio de refresh automático de tokens
    tokenRefreshService.start();

    // Iniciar limpieza automática de VIPs expirados
    VipCleanupTask.start();

    // Iniciar mantenimiento automático del bot de Kick
    botMaintenanceService.start();

    // Iniciar snapshots automáticos del leaderboard
    LeaderboardSnapshotTask.start();

    // Iniciar backups automáticos
    backupScheduler.start();

    // Iniciar bot de Discord
    await discordBotService.initialize();


    // Iniciar servicio de auto-envío de comandos
    kickBotAutoSendService.start();

    app.listen(config.port, () => {
      // Detectar si estamos en Docker para mostrar el puerto correcto
      const isDocker =
        process.env.NODE_ENV === "development" &&
        process.env.CHOKIDAR_USEPOLLING === "true";
      const displayPort = isDocker ? "3001 (mapeado desde :3000)" : config.port;

      if (isDocker) {
        logger.info(`🚀 Servidor escuchando en:`);
        logger.info(
          `   • Interno (contenedor): http://localhost:${config.port}`,
        );
        logger.info(`   • Externo (tu máquina): http://localhost:3001`);
        logger.info(`   📌 Usa http://localhost:3001 desde tu navegador`);
      } else {
        logger.info(
          `🚀 Servidor escuchando en http://localhost:${config.port}`,
        );
      }
    });
  } catch (err) {
    logger.error("❌ Error al sincronizar modelos:", err);
    process.exit(1);
  }
};

start();
