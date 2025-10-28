#!/usr/bin/env node

/**
 * Script SEGURO para limpiar duplicados y crear el índice UNIQUE sin afectar datos importantes
 */

const { sequelize } = require('./src/models');

async function safeCleanupAndCreateIndex() {
    try {
        console.log('🔧 LIMPIEZA SEGURA DE DUPLICADOS EN COOLDOWNS...\n');
        console.log('⚠️ NOTA: Esto NO afecta datos de usuarios, productos, ni nada importante');
        console.log('📋 Solo limpia la tabla temporal de cooldowns de chat\n');

        // 1. Verificar qué duplicados existen
        console.log('1️⃣ Verificando duplicados existentes...');
        const [duplicates] = await sequelize.query(`
            SELECT kick_user_id, kick_username, COUNT(*) as count 
            FROM kick_chat_cooldowns 
            GROUP BY kick_user_id 
            HAVING COUNT(*) > 1
            ORDER BY count DESC
        `);

        if (duplicates.length === 0) {
            console.log('✅ No hay duplicados, procediendo a crear índice...');
        } else {
            console.log(`⚠️ Encontrados ${duplicates.length} usuarios con registros duplicados:`);
            duplicates.forEach(dup => {
                console.log(`   ${dup.kick_username} (${dup.kick_user_id}): ${dup.count} registros`);
            });

            // 2. Limpiar duplicados de forma segura (mantener el más reciente)
            console.log('\n2️⃣ Limpiando duplicados (manteniendo el registro más reciente)...');

            for (const duplicate of duplicates) {
                const [cleanupResult] = await sequelize.query(`
                    DELETE FROM kick_chat_cooldowns 
                    WHERE kick_user_id = :kick_user_id 
                    AND id NOT IN (
                        SELECT id FROM (
                            SELECT id FROM kick_chat_cooldowns 
                            WHERE kick_user_id = :kick_user_id 
                            ORDER BY updated_at DESC, created_at DESC, id DESC
                            LIMIT 1
                        ) as latest
                    )
                `, {
                    replacements: { kick_user_id: duplicate.kick_user_id }
                });

                console.log(`   ✅ ${duplicate.kick_username}: eliminados ${cleanupResult.affectedRows || 0} duplicados`);
            }
        }

        // 3. Verificar que ya no hay duplicados
        console.log('\n3️⃣ Verificando que no quedan duplicados...');
        const [remainingDuplicates] = await sequelize.query(`
            SELECT kick_user_id, COUNT(*) as count 
            FROM kick_chat_cooldowns 
            GROUP BY kick_user_id 
            HAVING COUNT(*) > 1
        `);

        if (remainingDuplicates.length > 0) {
            console.error('❌ Aún quedan duplicados. No se puede crear índice UNIQUE.');
            console.error('Duplicados restantes:', remainingDuplicates);
            return;
        }

        console.log('✅ No quedan duplicados');

        // 4. Intentar crear el índice UNIQUE
        console.log('\n4️⃣ Creando índice UNIQUE...');

        try {
            await sequelize.query(`
                ALTER TABLE kick_chat_cooldowns 
                ADD UNIQUE INDEX idx_kick_user_id_unique (kick_user_id)
            `);
            console.log('✅ Índice UNIQUE creado exitosamente');
        } catch (indexError) {
            if (indexError.code === 'ER_DUP_KEY_NAME') {
                console.log('⚠️ El índice ya existe, omitiendo...');
            } else {
                throw indexError;
            }
        }

        // 5. Verificar el estado final
        console.log('\n5️⃣ Estado final de la tabla...');
        const [finalStats] = await sequelize.query(`
            SELECT 
                COUNT(*) as total_cooldowns,
                COUNT(DISTINCT kick_user_id) as unique_users
            FROM kick_chat_cooldowns
        `);

        console.log(`📊 Estadísticas finales:`);
        console.log(`   Total cooldowns: ${finalStats[0].total_cooldowns}`);
        console.log(`   Usuarios únicos: ${finalStats[0].unique_users}`);

        if (finalStats[0].total_cooldowns === finalStats[0].unique_users) {
            console.log('✅ Perfecto: 1 cooldown por usuario (sin duplicados)');
        } else {
            console.log('⚠️ Aún hay inconsistencias');
        }

        // 6. Verificar índices
        console.log('\n6️⃣ Verificando índices...');
        const [indexes] = await sequelize.query(`
            SHOW INDEX FROM kick_chat_cooldowns 
            WHERE Column_name = 'kick_user_id'
        `);

        const hasUniqueIndex = indexes.some(idx => idx.Non_unique === 0);
        console.log(`🔍 Índice UNIQUE en kick_user_id: ${hasUniqueIndex ? '✅ Existe' : '❌ No existe'}`);

        console.log('\n✅ LIMPIEZA COMPLETADA DE FORMA SEGURA');
        console.log('🎯 La tabla de cooldowns está lista para SELECT FOR UPDATE');
        console.log('⚠️ NO se afectaron datos de usuarios, productos, canjes, ni nada importante');

    } catch (error) {
        console.error('❌ Error durante la limpieza:', error.message);
        console.error('Stack:', error.stack);
    }

    process.exit(0);
}

if (require.main === module) {
    safeCleanupAndCreateIndex();
}

module.exports = { safeCleanupAndCreateIndex };
