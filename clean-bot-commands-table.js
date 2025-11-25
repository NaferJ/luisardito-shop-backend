const { sequelize } = require('./src/models/database');

async function cleanBotCommandsTable() {
    try {
        console.log('🧹 Limpiando tabla corrupta kick_bot_commands...');

        // Intentar eliminar índices si existen
        try {
            await sequelize.query('DROP INDEX IF EXISTS idx_kick_bot_commands_command ON kick_bot_commands');
            console.log('✅ Índice idx_kick_bot_commands_command eliminado');
        } catch (e) {
            console.log('ℹ️  Índice idx_kick_bot_commands_command no existía');
        }

        try {
            await sequelize.query('DROP INDEX IF EXISTS idx_kick_bot_commands_enabled ON kick_bot_commands');
            console.log('✅ Índice idx_kick_bot_commands_enabled eliminado');
        } catch (e) {
            console.log('ℹ️  Índice idx_kick_bot_commands_enabled no existía');
        }

        try {
            await sequelize.query('DROP INDEX IF EXISTS idx_kick_bot_commands_type ON kick_bot_commands');
            console.log('✅ Índice idx_kick_bot_commands_type eliminado');
        } catch (e) {
            console.log('ℹ️  Índice idx_kick_bot_commands_type no existía');
        }

        // Eliminar la tabla si existe
        await sequelize.query('DROP TABLE IF EXISTS kick_bot_commands');
        console.log('✅ Tabla kick_bot_commands eliminada');

        console.log('');
        console.log('🎉 Limpieza completada exitosamente');
        console.log('');
        console.log('📌 Próximo paso: Ejecutar la migración');
        console.log('   npm run migrate');
        console.log('');

        process.exit(0);
    } catch (error) {
        console.error('❌ Error limpiando tabla:', error.message);
        process.exit(1);
    }
}

cleanBotCommandsTable();
