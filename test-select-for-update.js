#!/usr/bin/env node

/**
 * Script para probar la solución SELECT FOR UPDATE y verificar que funciona
 */

const { sequelize } = require('./src/models');

async function testSelectForUpdateSolution() {
    try {
        console.log('🚀 Probando solución SELECT FOR UPDATE...\n');

        const kickUserId = '33112734';
        const kickUsername = 'NaferJ';

        // Limpiar datos de prueba
        await sequelize.query(`
            DELETE FROM kick_chat_cooldowns WHERE kick_user_id = :kick_user_id
        `, {
            replacements: { kick_user_id: kickUserId }
        });

        console.log('✅ Datos de prueba limpiados\n');

        // Simular 2 webhooks simultáneos usando Promise.all
        console.log('🏁 Simulando 2 webhooks SIMULTÁNEOS con SELECT FOR UPDATE...\n');

        const promises = [];
        for (let i = 1; i <= 2; i++) {
            promises.push(simulateWebhookWithLock(kickUserId, kickUsername, i));
        }

        // Ejecutar ambos EXACTAMENTE al mismo tiempo
        const results = await Promise.all(promises);

        console.log('\n📊 Resultados finales:');
        results.forEach((result, index) => {
            console.log(`   Webhook ${index + 1}: ${result ? '✅ Procesado' : '❌ Bloqueado'}`);
        });

        const processedCount = results.filter(r => r).length;
        console.log(`\n🎯 Total webhooks procesados: ${processedCount}`);

        if (processedCount === 1) {
            console.log('🎉 ¡SELECT FOR UPDATE FUNCIONA PERFECTAMENTE!');
            console.log('✅ Solo 1 webhook fue procesado, el otro fue bloqueado');
        } else {
            console.log('❌ Problema: Múltiples webhooks fueron procesados');
        }

        // Verificar estado final en BD
        console.log('\n📋 Estado final en base de datos:');
        const [finalState] = await sequelize.query(`
            SELECT * FROM kick_chat_cooldowns WHERE kick_user_id = :kick_user_id
        `, {
            replacements: { kick_user_id: kickUserId },
            type: sequelize.QueryTypes.SELECT
        });

        if (finalState.length > 0) {
            const cooldown = finalState[0];
            const now = new Date();
            const isActive = new Date(cooldown.cooldown_expires_at) > now;

            console.log(`   Usuario: ${cooldown.kick_username}`);
            console.log(`   Último mensaje: ${cooldown.last_message_at}`);
            console.log(`   Expira: ${cooldown.cooldown_expires_at}`);
            console.log(`   Estado: ${isActive ? '🔒 ACTIVO' : '✅ EXPIRADO'}`);
        } else {
            console.log('   No hay cooldowns en la base de datos');
        }

    } catch (error) {
        console.error('❌ Error en prueba:', error.message);
        console.error('Stack:', error.stack);
    }

    process.exit(0);
}

async function simulateWebhookWithLock(kickUserId, kickUsername, webhookNumber) {
    const startTime = new Date();
    console.log(`🔄 Webhook ${webhookNumber} iniciando - ${startTime.toISOString()}`);

    const now = new Date();
    const COOLDOWN_MS = 5 * 60 * 1000;

    // Iniciar transacción con nivel de aislamiento
    const transaction = await sequelize.transaction({
        isolationLevel: sequelize.Transaction.ISOLATION_LEVELS.READ_COMMITTED
    });

    try {
        console.log(`   🔒 Webhook ${webhookNumber} ejecutando SELECT FOR UPDATE...`);

        // SELECT FOR UPDATE - ESTA ES LA CLAVE
        const [cooldownRows] = await sequelize.query(`
            SELECT * FROM kick_chat_cooldowns 
            WHERE kick_user_id = :kick_user_id 
            FOR UPDATE
        `, {
            replacements: { kick_user_id: kickUserId },
            transaction,
            type: sequelize.QueryTypes.SELECT
        });

        const cooldown = cooldownRows[0];
        const afterLockTime = new Date();
        const lockWaitMs = afterLockTime.getTime() - startTime.getTime();

        console.log(`   ⏱️ Webhook ${webhookNumber} obtuvo lock después de ${lockWaitMs}ms`);

        // Verificar cooldown
        if (cooldown && new Date(cooldown.cooldown_expires_at) > now) {
            const remainingMs = new Date(cooldown.cooldown_expires_at).getTime() - now.getTime();
            const remainingSecs = Math.ceil(remainingMs / 1000);

            await transaction.rollback();

            console.log(`   ❌ Webhook ${webhookNumber} BLOQUEADO - cooldown activo (${remainingSecs}s restantes)`);
            return false;
        }

        // Crear/actualizar cooldown
        const newExpiresAt = new Date(now.getTime() + COOLDOWN_MS);

        await sequelize.query(`
            INSERT INTO kick_chat_cooldowns 
                (kick_user_id, kick_username, last_message_at, cooldown_expires_at, created_at, updated_at)
            VALUES 
                (:kick_user_id, :kick_username, :now, :expires_at, :now, :now)
            ON DUPLICATE KEY UPDATE
                kick_username = :kick_username,
                last_message_at = :now,
                cooldown_expires_at = :expires_at,
                updated_at = :now
        `, {
            replacements: {
                kick_user_id: kickUserId,
                kick_username: kickUsername,
                now: now,
                expires_at: newExpiresAt
            },
            transaction,
            type: sequelize.QueryTypes.INSERT
        });

        await transaction.commit();

        const endTime = new Date();
        const totalMs = endTime.getTime() - startTime.getTime();

        console.log(`   ✅ Webhook ${webhookNumber} PROCESADO en ${totalMs}ms - cooldown hasta ${newExpiresAt.toISOString()}`);
        return true;

    } catch (error) {
        await transaction.rollback();
        console.error(`   ❌ Webhook ${webhookNumber} error: ${error.message}`);
        return false;
    }
}

if (require.main === module) {
    testSelectForUpdateSolution();
}

module.exports = { testSelectForUpdateSolution };
