#!/usr/bin/env node

/**
 * Script para probar la migración de Botrix manualmente
 */

const { Usuario, HistorialPunto } = require('./src/models');
const BotrixMigrationService = require('./src/services/botrixMigration.service');

async function testBotrixMigration() {
    try {
        console.log('🧪 Probando migración de Botrix...\n');

        // 1. Verificar usuarios en la BD
        console.log('1. Verificando usuarios registrados...');
        const usuarios = await Usuario.findAll({
            attributes: ['id', 'nickname', 'user_id_ext', 'puntos', 'botrix_migrated'],
            limit: 5
        });

        console.log('👥 Usuarios en BD:');
        usuarios.forEach(u => {
            console.log(`  - ${u.nickname} (ID: ${u.user_id_ext}) - ${u.puntos} puntos - Migrado: ${u.botrix_migrated}`);
        });

        // 2. Probar con mensaje simulado de BotRix
        console.log('\n2. Simulando mensaje de BotRix...');

        // Usar el primer usuario que no haya migrado
        const usuarioTest = usuarios.find(u => !u.botrix_migrated);

        if (!usuarioTest) {
            console.log('⚠️ No hay usuarios disponibles para probar migración');
            console.log('💡 Resetea la migración de un usuario con:');
            console.log('   UPDATE usuarios SET botrix_migrated = false WHERE id = X;');
            return;
        }

        const mockMessage = {
            sender: {
                username: 'BotRix',
                user_id: 'botrix_user_id'
            },
            content: `@${usuarioTest.nickname} tiene 1042952 puntos.`,
            broadcaster: {
                user_id: 2771761
            }
        };

        console.log('📤 Mensaje simulado:', mockMessage.content);

        // 3. Procesar migración
        console.log('\n3. Procesando migración...');
        const result = await BotrixMigrationService.processChatMessage(mockMessage);

        console.log('📊 Resultado:', JSON.stringify(result, null, 2));

        if (result.processed) {
            // 4. Verificar que se actualizó correctamente
            console.log('\n4. Verificando actualización...');
            const usuarioActualizado = await Usuario.findByPk(usuarioTest.id);

            console.log('✅ Usuario actualizado:');
            console.log(`   - Puntos anteriores: ${usuarioTest.puntos}`);
            console.log(`   - Puntos actuales: ${usuarioActualizado.puntos}`);
            console.log(`   - Puntos migrados: ${usuarioActualizado.botrix_points_migrated}`);
            console.log(`   - Migrado: ${usuarioActualizado.botrix_migrated}`);
            console.log(`   - Fecha migración: ${usuarioActualizado.botrix_migrated_at}`);

            // 5. Verificar historial
            console.log('\n5. Verificando historial...');
            const historial = await HistorialPunto.findOne({
                where: {
                    usuario_id: usuarioTest.id,
                    concepto: 'Migración desde Botrix'
                },
                order: [['creado', 'DESC']]
            });

            if (historial) {
                console.log('✅ Entrada en historial creada:');
                console.log(`   - Puntos: ${historial.puntos}`);
                console.log(`   - Tipo: ${historial.tipo}`);
                console.log(`   - Concepto: ${historial.concepto}`);
            } else {
                console.log('❌ No se encontró entrada en historial');
            }
        }

        console.log('\n🎉 Prueba completada');

    } catch (error) {
        console.error('❌ Error en prueba:', error.message);
        console.error('Stack:', error.stack);
    }

    process.exit(0);
}

// Ejecutar si es llamado directamente
if (require.main === module) {
    testBotrixMigration();
}

module.exports = { testBotrixMigration };
