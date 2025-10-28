#!/usr/bin/env node

/**
 * Script para limpiar duplicados MANUALMENTE sin usar Sequelize
 */

const mysql = require('mysql2/promise');

async function manualCleanupDuplicates() {
    let connection;

    try {
        console.log('🔧 LIMPIEZA MANUAL DE DUPLICADOS (SIN SEQUELIZE)...\n');

        // Conectar directamente a MySQL sin Sequelize
        connection = await mysql.createConnection({
            host: process.env.DB_HOST || 'localhost',
            port: process.env.DB_PORT || 3307,
            user: process.env.DB_USER || 'root',
            password: process.env.DB_PASSWORD || 'password',
            database: process.env.DB_NAME || 'luisardito_shop'
        });

        console.log('✅ Conectado a MySQL directamente');

        // 1. Ver duplicados actuales
        console.log('\n1️⃣ Verificando duplicados...');
        const [duplicates] = await connection.execute(`
            SELECT kick_user_id, kick_username, COUNT(*) as count 
            FROM kick_chat_cooldowns 
            GROUP BY kick_user_id 
            HAVING COUNT(*) > 1
            ORDER BY count DESC
        `);

        if (duplicates.length === 0) {
            console.log('✅ No hay duplicados');
        } else {
            console.log(`⚠️ Encontrados ${duplicates.length} usuarios con duplicados:`);
            duplicates.forEach(dup => {
                console.log(`   ${dup.kick_username} (${dup.kick_user_id}): ${dup.count} registros`);
            });

            // 2. Limpiar duplicados manualmente
            console.log('\n2️⃣ Eliminando duplicados...');

            for (const duplicate of duplicates) {
                // Eliminar duplicados manteniendo el más reciente
                const [result] = await connection.execute(`
                    DELETE FROM kick_chat_cooldowns 
                    WHERE kick_user_id = ? 
                    AND id NOT IN (
                        SELECT id FROM (
                            SELECT id FROM kick_chat_cooldowns 
                            WHERE kick_user_id = ? 
                            ORDER BY updated_at DESC, created_at DESC, id DESC
                            LIMIT 1
                        ) as latest
                    )
                `, [duplicate.kick_user_id, duplicate.kick_user_id]);

                console.log(`   ✅ ${duplicate.kick_username}: eliminados ${result.affectedRows} duplicados`);
            }
        }

        // 3. Verificar que no quedan duplicados
        console.log('\n3️⃣ Verificando limpieza...');
        const [remaining] = await connection.execute(`
            SELECT kick_user_id, COUNT(*) as count 
            FROM kick_chat_cooldowns 
            GROUP BY kick_user_id 
            HAVING COUNT(*) > 1
        `);

        if (remaining.length > 0) {
            console.error('❌ Aún hay duplicados:', remaining);
            throw new Error('No se pudieron eliminar todos los duplicados');
        }

        console.log('✅ Todos los duplicados eliminados');

        // 4. Verificar si el índice ya existe
        console.log('\n4️⃣ Verificando índice UNIQUE...');
        const [indexes] = await connection.execute(`
            SHOW INDEX FROM kick_chat_cooldowns 
            WHERE Column_name = 'kick_user_id' AND Non_unique = 0
        `);

        if (indexes.length > 0) {
            console.log('✅ Índice UNIQUE ya existe');
        } else {
            console.log('⚠️ Creando índice UNIQUE...');

            try {
                await connection.execute(`
                    ALTER TABLE kick_chat_cooldowns 
                    ADD UNIQUE INDEX idx_kick_user_id_unique (kick_user_id)
                `);
                console.log('✅ Índice UNIQUE creado');
            } catch (indexError) {
                if (indexError.code === 'ER_DUP_KEY_NAME') {
                    console.log('⚠️ El índice ya existe con otro nombre');
                } else {
                    throw indexError;
                }
            }
        }

        // 5. Estado final
        console.log('\n5️⃣ Estado final...');
        const [stats] = await connection.execute(`
            SELECT 
                COUNT(*) as total,
                COUNT(DISTINCT kick_user_id) as unique_users
            FROM kick_chat_cooldowns
        `);

        console.log(`📊 Total: ${stats[0].total}, Únicos: ${stats[0].unique_users}`);

        if (stats[0].total === stats[0].unique_users) {
            console.log('✅ Perfecto: 1 registro por usuario');
        }

        console.log('\n🎉 LIMPIEZA COMPLETADA EXITOSAMENTE');
        console.log('🚀 Ahora puedes intentar encender el backend sin problemas');

    } catch (error) {
        console.error('❌ Error:', error.message);
        console.error('Stack:', error.stack);
    } finally {
        if (connection) {
            await connection.end();
        }
    }

    process.exit(0);
}

if (require.main === module) {
    manualCleanupDuplicates();
}
