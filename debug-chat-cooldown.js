#!/usr/bin/env node

/**
 * Script para diagnosticar problemas de cooldown de chat
 */

const { Usuario, KickChatCooldown, HistorialPunto } = require('./src/models');

async function debugChatCooldown() {
    try {
        console.log('🕒 Diagnosticando sistema de cooldown de chat...\n');

        // 1. Verificar tabla de cooldowns
        console.log('1️⃣ Revisando tabla de cooldowns existentes...');
        const allCooldowns = await KickChatCooldown.findAll({
            order: [['created_at', 'DESC']],
            limit: 10
        });

        console.log(`📊 Total cooldowns en BD: ${allCooldowns.length}`);
        allCooldowns.forEach(cooldown => {
            const now = new Date();
            const isExpired = cooldown.cooldown_expires_at <= now;
            const remainingMs = cooldown.cooldown_expires_at.getTime() - now.getTime();
            const remainingMinutes = Math.max(0, Math.ceil(remainingMs / (1000 * 60)));

            console.log(`   ${cooldown.kick_username} (ID: ${cooldown.kick_user_id})`);
            console.log(`     Último mensaje: ${cooldown.last_message_at}`);
            console.log(`     Expira: ${cooldown.cooldown_expires_at}`);
            console.log(`     Estado: ${isExpired ? '✅ EXPIRADO' : `⏰ ACTIVO (${remainingMinutes}m)`}`);
            console.log('');
        });

        // 2. Verificar usuario específico NaferJ
        console.log('2️⃣ Verificando usuario NaferJ específicamente...');
        const usuario = await Usuario.findOne({
            where: { nickname: 'NaferJ' }
        });

        if (usuario) {
            console.log(`👤 Usuario: ${usuario.nickname}`);
            console.log(`   user_id_ext: ${usuario.user_id_ext}`);
            console.log(`   rol_id: ${usuario.rol_id}`);

            const cooldown = await KickChatCooldown.findOne({
                where: { kick_user_id: usuario.user_id_ext }
            });

            if (cooldown) {
                const now = new Date();
                const isExpired = cooldown.cooldown_expires_at <= now;
                const remainingMs = cooldown.cooldown_expires_at.getTime() - now.getTime();

                console.log('🕒 Estado del cooldown:');
                console.log(`   Existe: ✅`);
                console.log(`   Último mensaje: ${cooldown.last_message_at}`);
                console.log(`   Expira: ${cooldown.cooldown_expires_at}`);
                console.log(`   Ahora: ${now}`);
                console.log(`   Expirado: ${isExpired}`);
                console.log(`   Diferencia: ${remainingMs}ms`);
            } else {
                console.log('🕒 Estado del cooldown: ❌ NO EXISTE');
            }
        } else {
            console.log('❌ Usuario NaferJ no encontrado');
        }

        // 3. Verificar historial reciente de mensajes
        console.log('\n3️⃣ Revisando historial reciente de puntos por chat...');
        const recentChatPoints = await HistorialPunto.findAll({
            where: {
                concepto: {
                    [require('sequelize').Op.like]: 'Mensaje en chat%'
                }
            },
            include: [{
                model: Usuario,
                attributes: ['nickname', 'user_id_ext']
            }],
            order: [['fecha', 'DESC']],
            limit: 10
        });

        console.log(`📋 Últimos ${recentChatPoints.length} puntos por chat:`);
        recentChatPoints.forEach(historial => {
            console.log(`   ${historial.Usuario.nickname}: ${historial.puntos} puntos - ${historial.fecha}`);
            console.log(`     Concepto: ${historial.concepto}`);
        });

        // 4. Simular lógica de cooldown
        console.log('\n4️⃣ Simulando lógica de cooldown...');
        const testUserId = usuario ? usuario.user_id_ext : '33112734';
        const now = new Date();

        const testCooldown = await KickChatCooldown.findOne({
            where: { kick_user_id: testUserId }
        });

        console.log('🧪 Simulación:');
        console.log(`   kick_user_id: ${testUserId}`);
        console.log(`   Cooldown encontrado: ${!!testCooldown}`);

        if (testCooldown) {
            const shouldBlock = testCooldown.cooldown_expires_at > now;
            console.log(`   Debería bloquear: ${shouldBlock}`);
            console.log(`   Comparación: ${testCooldown.cooldown_expires_at} > ${now} = ${shouldBlock}`);
        }

        // 5. Verificar posibles problemas
        console.log('\n5️⃣ Análisis de posibles problemas...');

        const duplicateCooldowns = await KickChatCooldown.findAll({
            where: { kick_user_id: testUserId }
        });

        if (duplicateCooldowns.length > 1) {
            console.log(`⚠️ PROBLEMA: ${duplicateCooldowns.length} cooldowns para el mismo usuario`);
            duplicateCooldowns.forEach((dup, index) => {
                console.log(`   ${index + 1}. ID: ${dup.id}, Expira: ${dup.cooldown_expires_at}`);
            });
        } else {
            console.log('✅ No hay cooldowns duplicados');
        }

        // 6. Verificar timezone/fechas
        console.log('\n6️⃣ Verificando manejo de fechas...');
        const testDate = new Date();
        const futureDate = new Date(testDate.getTime() + 5 * 60 * 1000);

        console.log('📅 Manejo de fechas:');
        console.log(`   Ahora: ${testDate.toISOString()}`);
        console.log(`   +5min: ${futureDate.toISOString()}`);
        console.log(`   Diferencia: ${futureDate.getTime() - testDate.getTime()}ms`);
        console.log(`   Comparación: ${futureDate} > ${testDate} = ${futureDate > testDate}`);

        console.log('\n🎯 Resumen del diagnóstico completado');

    } catch (error) {
        console.error('❌ Error en diagnóstico:', error.message);
        console.error('Stack:', error.stack);
    }

    process.exit(0);
}

// Ejecutar si es llamado directamente
if (require.main === module) {
    debugChatCooldown();
}

module.exports = { debugChatCooldown };
