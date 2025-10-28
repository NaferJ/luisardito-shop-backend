#!/usr/bin/env node

/**
 * Script simple para verificar que el cooldown funcione
 */

const { KickChatCooldown } = require('./src/models');

async function testCooldown() {
    try {
        console.log('🕒 Verificando cooldown actual...\n');

        const cooldowns = await KickChatCooldown.findAll({
            order: [['last_message_at', 'DESC']],
            limit: 5
        });

        const now = new Date();

        console.log(`📊 Cooldowns activos (${cooldowns.length} encontrados):`);
        cooldowns.forEach(cooldown => {
            const isActive = cooldown.cooldown_expires_at > now;
            const remainingMs = cooldown.cooldown_expires_at.getTime() - now.getTime();
            const remainingMinutes = Math.max(0, Math.ceil(remainingMs / (1000 * 60)));

            console.log(`   ${cooldown.kick_username}:`);
            console.log(`     Último mensaje: ${cooldown.last_message_at}`);
            console.log(`     Expira: ${cooldown.cooldown_expires_at}`);
            console.log(`     Estado: ${isActive ? `🔒 ACTIVO (${remainingMinutes}m)` : '✅ EXPIRADO'}`);
            console.log('');
        });

        console.log('✅ El cooldown debería funcionar ahora con transacciones atómicas');
        console.log('🎯 Prueba escribiendo 3 mensajes rápidos - solo el primero debería dar puntos');

    } catch (error) {
        console.error('❌ Error:', error.message);
    }

    process.exit(0);
}

if (require.main === module) {
    testCooldown();
}

module.exports = { testCooldown };
