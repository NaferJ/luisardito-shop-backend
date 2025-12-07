/**
 * Script de inicialización para recompensas de Kick
 * Ejecutar después de la migración:
 * node init-kick-rewards.js
 */

const { KickReward } = require('./src/models');
const KickRewardService = require('./src/services/kickReward.service');
const logger = require('./src/utils/logger');

async function initializeKickRewards() {
    try {
        console.log('🎁 ========================================');
        console.log('🎁 INICIALIZACIÓN DE RECOMPENSAS DE KICK');
        console.log('🎁 ========================================\n');

        // 1. Verificar conexión a BD
        console.log('📊 Verificando conexión a base de datos...');
        const rewardsCount = await KickReward.count();
        console.log(`✅ Conexión exitosa. Recompensas actuales: ${rewardsCount}\n`);

        // 2. Sincronizar recompensas desde Kick
        console.log('🔄 Sincronizando recompensas desde Kick API...');
        const syncResult = await KickRewardService.syncRewardsFromKick();

        console.log('\n✅ SINCRONIZACIÓN COMPLETADA');
        console.log(`   📦 Total sincronizadas: ${syncResult.total}`);
        console.log(`   ✨ Nuevas: ${syncResult.created}`);
        console.log(`   🔄 Actualizadas: ${syncResult.updated}\n`);

        // 3. Mostrar recompensas sincronizadas
        const rewards = await KickReward.findAll({
            order: [['created_at', 'DESC']]
        });

        if (rewards.length > 0) {
            console.log('📋 RECOMPENSAS DISPONIBLES:');
            console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
            
            rewards.forEach((reward, index) => {
                console.log(`\n${index + 1}. ${reward.title}`);
                console.log(`   ID Kick: ${reward.kick_reward_id}`);
                console.log(`   Costo en Kick: ${reward.cost} puntos`);
                console.log(`   Puntos a otorgar: ${reward.puntos_a_otorgar} puntos`);
                console.log(`   Estado: ${reward.is_enabled ? '✅ Habilitada' : '❌ Deshabilitada'}`);
                console.log(`   Auto-aceptar: ${reward.auto_accept ? '✅ Sí' : '❌ No'}`);
                console.log(`   Canjeos totales: ${reward.total_redemptions}`);
            });

            console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        }

        // 4. Instrucciones
        console.log('\n📝 PRÓXIMOS PASOS:');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log('1. Configura los puntos a otorgar para cada recompensa');
        console.log('   Endpoint: PATCH /api/admin/kick-rewards/:id/points');
        console.log('   Body: { "puntos_a_otorgar": 10000, "auto_accept": true }\n');
        
        console.log('2. Ejemplo para configurar "10K Kiosko":');
        console.log('   curl -X PATCH http://localhost:3000/api/admin/kick-rewards/1/points \\');
        console.log('        -H "Authorization: Bearer YOUR_TOKEN" \\');
        console.log('        -H "Content-Type: application/json" \\');
        console.log('        -d \'{"puntos_a_otorgar": 10000, "auto_accept": true}\'\n');
        
        console.log('3. Los webhooks ya están configurados para recibir eventos de canjeo\n');
        
        console.log('4. Para crear una nueva recompensa desde tu app:');
        console.log('   POST /api/admin/kick-rewards');
        console.log('   Body: {');
        console.log('     "title": "Nueva Recompensa",');
        console.log('     "cost": 5000,');
        console.log('     "puntos_a_otorgar": 5000,');
        console.log('     "description": "Descripción",');
        console.log('     "auto_accept": true');
        console.log('   }\n');

        console.log('5. Para ver estadísticas:');
        console.log('   GET /api/admin/kick-rewards/stats\n');
        
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log('\n✅ INICIALIZACIÓN COMPLETADA EXITOSAMENTE\n');

    } catch (error) {
        console.error('\n❌ ERROR EN INICIALIZACIÓN:', error.message);
        console.error('\nDetalles:', error);
        
        if (error.message.includes('No se pudo obtener token')) {
            console.error('\n⚠️  SOLUCIÓN: Verifica que las credenciales de Kick estén configuradas correctamente en .env');
            console.error('   - KICK_CLIENT_ID');
            console.error('   - KICK_CLIENT_SECRET');
        }
        
        process.exit(1);
    }
}

// Ejecutar inicialización
initializeKickRewards()
    .then(() => process.exit(0))
    .catch(error => {
        console.error('Error fatal:', error);
        process.exit(1);
    });
