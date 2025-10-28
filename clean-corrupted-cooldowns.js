#!/usr/bin/env node

/**
 * Script para limpiar cooldowns corruptos con fechas incorrectas
 */

const { KickChatCooldown, sequelize } = require('./src/models');
const { Op } = require('sequelize');

async function cleanCorruptedCooldowns() {
    try {
        console.log('🧹 Limpiando cooldowns corruptos...\n');

        const now = new Date();

        // 1. Mostrar cooldowns problemáticos (más de 1 día en el futuro es sospechoso)
        console.log('1️⃣ Revisando cooldowns con fechas problemáticas...');
        const oneDayFromNow = new Date(now.getTime() + 24 * 60 * 60 * 1000);

        const corruptedCooldowns = await KickChatCooldown.findAll({
            where: {
                cooldown_expires_at: {
                    [Op.gt]: oneDayFromNow // Cualquier cooldown que expire más de 1 día en el futuro es problemático
                }
            }
        });

        console.log(`❌ Encontrados ${corruptedCooldowns.length} cooldowns con fechas sospechosas (más de 1 día):`);
        corruptedCooldowns.forEach(cooldown => {
            const hoursFromNow = (cooldown.cooldown_expires_at.getTime() - now.getTime()) / (1000 * 60 * 60);
            console.log(`   ${cooldown.kick_username}: expira en ${Math.round(hoursFromNow)} horas (${cooldown.cooldown_expires_at})`);
        });

        // 2. Eliminar cooldowns problemáticos
        if (corruptedCooldowns.length > 0) {
            console.log('\n2️⃣ Eliminando cooldowns problemáticos...');
            const deletedCount = await KickChatCooldown.destroy({
                where: {
                    cooldown_expires_at: {
                        [Op.gt]: oneDayFromNow
                    }
                }
            });
            console.log(`✅ ${deletedCount} cooldowns problemáticos eliminados`);
        }

        // 3. Mostrar cooldowns válidos restantes
        console.log('\n3️⃣ Cooldowns válidos restantes...');
        const validCooldowns = await KickChatCooldown.findAll({
            order: [['last_message_at', 'DESC']]
        });

        if (validCooldowns.length === 0) {
            console.log('✅ No hay cooldowns activos (todos pueden escribir)');
        } else {
            validCooldowns.forEach(cooldown => {
                const isActive = cooldown.cooldown_expires_at > now;
                const status = isActive ? '🔒 ACTIVO' : '✅ EXPIRADO';
                console.log(`   ${cooldown.kick_username}: ${status} - expira ${cooldown.cooldown_expires_at}`);
            });
        }

        console.log('\n🎯 Limpieza completada. El cooldown debería funcionar correctamente ahora.');

    } catch (error) {
        console.error('❌ Error limpiando cooldowns:', error.message);
    }

    process.exit(0);
}

if (require.main === module) {
    cleanCorruptedCooldowns();
}

module.exports = { cleanCorruptedCooldowns };
