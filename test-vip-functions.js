#!/usr/bin/env node

/**
 * Script de prueba para verificar que las funciones VIP funcionen después del arreglo
 */

const VipService = require('./src/services/vip.service');

async function testVipFunctions() {
    try {
        console.log('🧪 Probando funciones VIP después del arreglo...\n');

        // 1. Probar getVipStats (usa Op.lt internamente)
        console.log('1️⃣ Probando getVipStats()...');
        const vipStats = await VipService.getVipStats();
        console.log('📊 Estadísticas VIP:', {
            total_vips: vipStats.total_vips,
            active_vips: vipStats.active_vips,
            expired_vips: vipStats.expired_vips,
            permanent_vips: vipStats.permanent_vips,
            temporary_vips: vipStats.temporary_vips
        });

        // 2. Probar cleanupExpiredVips (usa Op.lt internamente)
        console.log('\n2️⃣ Probando cleanupExpiredVips()...');
        const cleanupResult = await VipService.cleanupExpiredVips();
        console.log('🧹 Resultado limpieza:', {
            cleaned_count: cleanupResult.cleaned_count,
            total_expired: cleanupResult.total_expired
        });

        // 3. Probar getVipPointsConfig
        console.log('\n3️⃣ Probando getVipPointsConfig()...');
        const vipConfig = await VipService.getVipPointsConfig();
        console.log('⚙️ Configuración VIP:', {
            points_enabled: vipConfig.vip_points_enabled,
            chat_points: vipConfig.vip_chat_points,
            follow_points: vipConfig.vip_follow_points,
            sub_points: vipConfig.vip_sub_points
        });

        console.log('\n✅ Todas las funciones VIP funcionan correctamente');
        console.log('🎉 No hay errores de sequelize.Op');

    } catch (error) {
        console.error('❌ Error en pruebas VIP:', error.message);
        console.error('Stack:', error.stack);

        if (error.message.includes('Cannot read properties of undefined')) {
            console.error('\n🔍 Posible problema con importaciones de Sequelize Op');
        }
    }

    process.exit(0);
}

// Ejecutar si es llamado directamente
if (require.main === module) {
    testVipFunctions();
}

module.exports = { testVipFunctions };
