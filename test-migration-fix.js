idr#!/usr/bin/env node

/**
 * Script de prueba rápida para verificar que la migración de Botrix funcione después del arreglo
 */

const BotrixMigrationService = require('./src/services/botrixMigration.service');

async function testQuickMigration() {
    try {
        console.log('🧪 Prueba rápida de migración de Botrix...\n');

        // Simular el mensaje que causó el error
        const mockMessage = {
            sender: {
                username: 'BotRix',
                user_id: 'botrix_test'
            },
            content: '@NaferJ tiene 1042952 puntos.',
            broadcaster: {
                user_id: 2771761
            }
        };

        console.log('📤 Procesando mensaje:', mockMessage.content);

        // Probar el procesamiento
        const result = await BotrixMigrationService.processChatMessage(mockMessage);

        console.log('📊 Resultado:', JSON.stringify(result, null, 2));

        if (result.processed) {
            console.log('✅ ¡Migración exitosa!');
        } else {
            console.log(`⚠️ No procesado: ${result.reason}`);
            if (result.error) {
                console.log(`❌ Error: ${result.error}`);
            }
        }

    } catch (error) {
        console.error('❌ Error en prueba:', error.message);
        console.error('Stack:', error.stack);
    }

    process.exit(0);
}

// Ejecutar si es llamado directamente
if (require.main === module) {
    testQuickMigration();
}

module.exports = { testQuickMigration };
