const sequelize = require('./src/config/database');
const KickBotToken = require('./src/models/kickBotToken.model');

async function initBotTokensTable() {
    try {
        console.log(' Inicializando tabla kick_bot_tokens...');
        
        // Sincronizar el modelo con la base de datos
        await KickBotToken.sync({ force: false, alter: true });
        
        console.log('✅ Tabla kick_bot_tokens creada/actualizada correctamente');
        
        // Cerrar la conexión
        await sequelize.close();
        process.exit(0);
    } catch (error) {
        console.error('❌ Error al inicializar la tabla kick_bot_tokens:', error);
        process.exit(1);
    }
}

initBotTokensTable();