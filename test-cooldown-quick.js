#!/usr/bin/env node

/**
 * Prueba simple del cooldown sin usar el webhook completo
 */

const { sequelize } = require('./src/models');
const { Transaction } = require('sequelize');

async function testCooldownQuick() {
    try {
        console.log('🧪 Prueba rápida del cooldown...\n');

        const kickUserId = '33112734';
        const kickUsername = 'NaferJ';
        const now = new Date();
        const COOLDOWN_MS = 5 * 60 * 1000;

        // Limpiar cualquier cooldown existente para esta prueba
        await sequelize.query(`
            DELETE FROM kick_chat_cooldowns WHERE kick_user_id = ?
        `, {
            replacements: [kickUserId],
            type: sequelize.QueryTypes.DELETE
        });

        console.log('✅ Datos de prueba limpiados');

        // Simular primer mensaje
        console.log('\n1️⃣ Simulando primer mensaje...');

        const transaction1 = await sequelize.transaction({
            isolationLevel: Transaction.ISOLATION_LEVELS.READ_COMMITTED
        });

        try {
            // SELECT FOR UPDATE
            const cooldownRows1 = await sequelize.query(`
                SELECT * FROM kick_chat_cooldowns 
                WHERE kick_user_id = ? 
                FOR UPDATE
            `, {
                replacements: [kickUserId],
                transaction: transaction1,
                type: sequelize.QueryTypes.SELECT
            });

            const cooldown1 = cooldownRows1[0];

            if (cooldown1 && new Date(cooldown1.cooldown_expires_at) > now) {
                await transaction1.rollback();
                console.log('   ❌ BLOQUEADO (no debería pasar en el primer mensaje)');
                return;
            }

            // Crear cooldown
            const newExpiresAt = new Date(now.getTime() + COOLDOWN_MS);

            await sequelize.query(`
                INSERT INTO kick_chat_cooldowns 
                    (kick_user_id, kick_username, last_message_at, cooldown_expires_at, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, ?)
                ON DUPLICATE KEY UPDATE
                    kick_username = VALUES(kick_username),
                    last_message_at = VALUES(last_message_at),
                    cooldown_expires_at = VALUES(cooldown_expires_at),
                    updated_at = VALUES(updated_at)
            `, {
                replacements: [kickUserId, kickUsername, now, newExpiresAt, now, now],
                transaction: transaction1,
                type: sequelize.QueryTypes.INSERT
            });

            await transaction1.commit();
            console.log(`   ✅ PRIMER mensaje procesado - cooldown hasta ${newExpiresAt.toISOString()}`);

        } catch (error) {
            await transaction1.rollback();
            throw error;
        }

        // Simular segundo mensaje inmediato
        console.log('\n2️⃣ Simulando segundo mensaje (inmediato)...');

        const transaction2 = await sequelize.transaction({
            isolationLevel: Transaction.ISOLATION_LEVELS.READ_COMMITTED
        });

        try {
            // SELECT FOR UPDATE
            const cooldownRows2 = await sequelize.query(`
                SELECT * FROM kick_chat_cooldowns 
                WHERE kick_user_id = ? 
                FOR UPDATE
            `, {
                replacements: [kickUserId],
                transaction: transaction2,
                type: sequelize.QueryTypes.SELECT
            });

            const cooldown2 = cooldownRows2[0];
            const now2 = new Date();

            if (cooldown2 && new Date(cooldown2.cooldown_expires_at) > now2) {
                const remainingMs = new Date(cooldown2.cooldown_expires_at).getTime() - now2.getTime();
                const remainingSecs = Math.ceil(remainingMs / 1000);

                await transaction2.rollback();
                console.log(`   ✅ SEGUNDO mensaje BLOQUEADO correctamente (${remainingSecs}s restantes)`);

                console.log('\n🎉 ¡COOLDOWN FUNCIONA PERFECTAMENTE!');
                console.log('✅ Primer mensaje: Procesado');
                console.log('✅ Segundo mensaje: Bloqueado');

                return;
            } else {
                await transaction2.rollback();
                console.log('   ❌ ERROR: Segundo mensaje NO fue bloqueado');
                return;
            }

        } catch (error) {
            await transaction2.rollback();
            throw error;
        }

    } catch (error) {
        console.error('❌ Error en prueba:', error.message);
        console.error('Stack:', error.stack);
    }

    process.exit(0);
}

if (require.main === module) {
    testCooldownQuick();
}

module.exports = { testCooldownQuick };
