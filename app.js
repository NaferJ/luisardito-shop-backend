const express = require('express');
const cors    = require('cors');
const { sequelize } = require('./src/models');
const config = require('./config');

// Rutas (aún por crear)
const authRoutes      = require('./src/routes/auth.routes');
const usuariosRoutes  = require('./src/routes/usuarios.routes');
const productosRoutes = require('./src/routes/productos.routes');
const canjesRoutes    = require('./src/routes/canjes.routes');
const historialPuntosRoutes = require('./src/routes/historialPuntos.routes');

const app = express();

app.get('/', (req, res) => {
    res.send('🚀 Luisardito Shop Backend en funcionamiento');
});

// Middleware global
app.use(cors());
app.use(express.json());

// Rutas principales
app.use('/api/auth', authRoutes);
app.use('/api/usuarios', usuariosRoutes);
app.use('/api/productos', productosRoutes);
app.use('/api/canjes', canjesRoutes);
app.use('/api/historial-puntos', historialPuntosRoutes);

// Health endpoint for liveness/readiness checks
app.get('/health', (req, res) => {
    res.status(200).json({ status: 'ok' });
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
            const code = err?.parent?.code || err?.name || 'UNKNOWN_ERROR';
            console.error(`⚠️  Falló la conexión a la BD (intento ${attempt}/${retries}) [${code}]. Reintentando en ${delayMs}ms...`);
            await new Promise(r => setTimeout(r, delayMs));
        }
    }

    if (!connected) {
        console.error('❌ No fue posible conectar a la base de datos tras múltiples intentos. Saliendo...');
        process.exit(1);
    }

    try {
        await sequelize.sync();
        console.log('✅ Base de datos conectada y modelos sincronizados');
        app.listen(config.port, () => {
            console.log(`🚀 Servidor escuchando en http://localhost:${config.port}`);
        });
    } catch (err) {
        console.error('❌ Error al sincronizar modelos:', err);
        process.exit(1);
    }
};

start();
