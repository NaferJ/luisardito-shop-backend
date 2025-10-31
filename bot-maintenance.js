// bot-maintenance.js - Mantenimiento completo del bot cada hora
const kickBotService = require('./src/services/kickBot.service');
const { KickBotToken } = require('./src/models');
const { Op } = require('sequelize');

async function botMaintenance() {
    try {
        console.log('🔧 [MAINTENANCE] Iniciando mantenimiento del bot...');

        // 1. Limpiar tokens expirados
        console.log('🧹 [MAINTENANCE] Limpiando tokens expirados...');
        const now = new Date();
        const expiredTokens = await KickBotToken.findAll({
            where: {
                is_active: true,
                token_expires_at: { [Op.lt]: now }
            }
        });

        if (expiredTokens.length > 0) {
            await KickBotToken.update(
                { is_active: false },
                {
                    where: {
                        is_active: true,
                        token_expires_at: { [Op.lt]: now }
                    }
                }
            );
            console.log(`✅ [MAINTENANCE] ${expiredTokens.length} tokens expirados marcados como inactivos`);
        } else {
            console.log('✅ [MAINTENANCE] No hay tokens expirados para limpiar');
        }

        // 2. Verificar y renovar token activo
        console.log('🔄 [MAINTENANCE] Verificando token activo...');
        const token = await kickBotService.resolveAccessToken();

        if (token) {
            console.log('✅ [MAINTENANCE] Token válido y renovado si era necesario');

            // 3. Opcional: Probar envío (deshabilitado por defecto)
            const testSend = process.env.BOT_MAINTENANCE_TEST_SEND === 'true';
            if (testSend) {
                console.log('📤 [MAINTENANCE] Probando envío de mensaje...');
                const result = await kickBotService.sendMessage('🔧 Mantenimiento del bot completado');
                if (result.ok) {
                    console.log('✅ [MAINTENANCE] Mensaje de prueba enviado correctamente');
                } else {
                    console.log('⚠️ [MAINTENANCE] Error enviando mensaje de prueba:', result.error);
                }
            }
        } else {
            console.error('❌ [MAINTENANCE] No se pudo obtener token válido');
            return false;
        }

        // 4. Estadísticas finales
        const totalTokens = await KickBotToken.count();
        const activeTokens = await KickBotToken.count({ where: { is_active: true } });

        console.log('📊 [MAINTENANCE] Estadísticas:');
        console.log(`   - Total de tokens: ${totalTokens}`);
        console.log(`   - Tokens activos: ${activeTokens}`);

        console.log('🎉 [MAINTENANCE] Mantenimiento completado exitosamente');
        return true;

    } catch (error) {
        console.error('❌ [MAINTENANCE] Error en mantenimiento:', error.message);
        return false;
    }
}

// Si se ejecuta directamente
if (require.main === module) {
    botMaintenance()
        .then(success => {
            process.exit(success ? 0 : 1);
        })
        .catch(error => {
            console.error('💥 Error fatal:', error);
            process.exit(1);
        });
}

module.exports = botMaintenance;
