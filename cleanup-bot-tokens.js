const { KickBotToken } = require('./src/models');
const { Op } = require('sequelize');

/**
 * Script para limpiar tokens de bot expirados
 * Puede ejecutarse como cron job
 */
async function cleanupExpiredBotTokens() {
    try {
        const now = new Date();

        console.log('🧹 [CLEANUP] Iniciando limpieza de tokens de bot expirados...');

        // Buscar tokens expirados que aún estén marcados como activos
        const expiredTokens = await KickBotToken.findAll({
            where: {
                is_active: true,
                token_expires_at: {
                    [Op.lt]: now
                }
            }
        });

        if (expiredTokens.length === 0) {
            console.log('✅ [CLEANUP] No hay tokens expirados para limpiar');
            return;
        }

        console.log(`🔍 [CLEANUP] Encontrados ${expiredTokens.length} tokens expirados:`);
        expiredTokens.forEach(token => {
            const expiredHours = Math.round((now - new Date(token.token_expires_at)) / 1000 / 60 / 60);
            console.log(`  - ${token.kick_username} (ID: ${token.id}) - Expiró hace ${expiredHours} horas`);
        });

        // Marcar como inactivos
        const result = await KickBotToken.update(
            {
                is_active: false,
                updated_at: now
            },
            {
                where: {
                    is_active: true,
                    token_expires_at: {
                        [Op.lt]: now
                    }
                }
            }
        );

        console.log(`✅ [CLEANUP] ${result[0]} tokens marcados como inactivos exitosamente`);

        // Mostrar estadísticas finales
        const totalTokens = await KickBotToken.count();
        const activeTokens = await KickBotToken.count({ where: { is_active: true } });
        const inactiveTokens = totalTokens - activeTokens;

        console.log(`📊 [CLEANUP] Estadísticas finales:`);
        console.log(`  - Total de tokens: ${totalTokens}`);
        console.log(`  - Tokens activos: ${activeTokens}`);
        console.log(`  - Tokens inactivos: ${inactiveTokens}`);

    } catch (error) {
        console.error('❌ [CLEANUP] Error limpiando tokens expirados:', error);
        throw error;
    }
}

// Si se ejecuta directamente
if (require.main === module) {
    cleanupExpiredBotTokens()
        .then(() => {
            console.log('🎉 [CLEANUP] Limpieza completada exitosamente');
            process.exit(0);
        })
        .catch(error => {
            console.error('💥 [CLEANUP] Error fatal:', error);
            process.exit(1);
        });
}

module.exports = cleanupExpiredBotTokens;
