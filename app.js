const express = require("express");
const cors = require("cors");
const { sequelize } = require("./src/models");
const config = require("./config");

// Servicios
const tokenRefreshService = require("./src/services/tokenRefresh.service");

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

const app = express();

app.get("/", (req, res) => {
  res.send("🚀 Luisardito Shop Backend en funcionamiento");
});

// Middleware global
app.use(cors());
app.use(express.json());

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
      console.error(
        `⚠️  Falló la conexión a la BD (intento ${attempt}/${retries}) [${code}]. Reintentando en ${delayMs}ms...`,
      );
      await new Promise((r) => setTimeout(r, delayMs));
    }
  }

  if (!connected) {
    console.error(
      "❌ No fue posible conectar a la base de datos tras múltiples intentos. Saliendo...",
    );
    process.exit(1);
  }

  try {
    await sequelize.sync();
    console.log("✅ Base de datos conectada y modelos sincronizados");

    // Iniciar el servicio de refresh automático de tokens
    tokenRefreshService.start();

    app.listen(config.port, () => {
      // Detectar si estamos en Docker para mostrar el puerto correcto
      const isDocker =
        process.env.NODE_ENV === "development" &&
        process.env.CHOKIDAR_USEPOLLING === "true";
      const displayPort = isDocker ? "3001 (mapeado desde :3000)" : config.port;

      if (isDocker) {
        console.log(`🚀 Servidor escuchando en:`);
        console.log(
          `   • Interno (contenedor): http://localhost:${config.port}`,
        );
        console.log(`   • Externo (tu máquina): http://localhost:3001`);
        console.log(`   📌 Usa http://localhost:3001 desde tu navegador`);
      } else {
        console.log(
          `🚀 Servidor escuchando en http://localhost:${config.port}`,
        );
      }
    });
  } catch (err) {
    console.error("❌ Error al sincronizar modelos:", err);
    process.exit(1);
  }
};

start();
