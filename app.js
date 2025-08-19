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

// Sincronizar modelos y arrancar servidor
sequelize.sync()
    .then(() => {
        console.log('✅ Base de datos conectada y modelos sincronizados');
        app.listen(config.port, () => {
            console.log(`🚀 Servidor escuchando en http://localhost:${config.port}`);
        });
    })
    .catch(err => {
        console.error('❌ Error al conectar la base de datos:', err);
    });
