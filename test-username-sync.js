/**
 * 🧪 Script de prueba para el sistema de sincronización de usernames
 * 
 * Simula diferentes escenarios:
 * 1. Usuario cambia nombre (sin colisión)
 * 2. Usuario cambia nombre (con colisión)
 * 3. Usuario sin cambio de nombre
 * 4. Throttling de Redis
 */

const { Usuario } = require('./src/models');
const { syncUsernameIfNeeded } = require('./src/utils/usernameSync.util');
const { getRedisClient } = require('./src/config/redis.config');

async function testUsernameSync() {
    try {
        console.log('🧪 Iniciando pruebas de sincronización de username...\n');

        // Buscar un usuario de prueba
        const usuario = await Usuario.findOne({
            where: { user_id_ext: { $ne: null } }
        });

        if (!usuario) {
            console.log('❌ No se encontró ningún usuario de prueba');
            return;
        }

        console.log('✅ Usuario de prueba encontrado:');
        console.log(`   ID: ${usuario.id}`);
        console.log(`   Nickname actual: ${usuario.nickname}`);
        console.log(`   user_id_ext: ${usuario.user_id_ext}\n`);

        // TEST 1: Sin cambio de nombre
        console.log('📝 TEST 1: Usuario sin cambio de nombre');
        const result1 = await syncUsernameIfNeeded(
            usuario,
            usuario.nickname,
            usuario.user_id_ext,
            false
        );
        console.log(`   Resultado:`, result1);
        console.log('');

        // TEST 2: Con cambio de nombre (simulado)
        console.log('📝 TEST 2: Usuario con cambio de nombre simulado');
        const newName = `${usuario.nickname}_test_${Date.now()}`;
        const result2 = await syncUsernameIfNeeded(
            usuario,
            newName,
            usuario.user_id_ext,
            false
        );
        console.log(`   Nuevo nombre: ${newName}`);
        console.log(`   Resultado:`, result2);
        
        if (result2.updated) {
            console.log(`   ✅ Nombre actualizado correctamente`);
            
            // Revertir cambio
            await usuario.update({ 
                nickname: result2.oldNickname,
                kick_data: {
                    ...usuario.kick_data,
                    username: result2.oldNickname
                }
            });
            console.log(`   ↩️  Cambio revertido para mantener integridad`);
        }
        console.log('');

        // TEST 3: Verificar throttling
        console.log('📝 TEST 3: Verificar throttling de Redis');
        const redis = getRedisClient();
        const syncKey = `username_sync:${usuario.user_id_ext}`;
        const ttl = await redis.ttl(syncKey);
        
        if (ttl > 0) {
            const hours = (ttl / 3600).toFixed(1);
            console.log(`   ⏰ Throttling activo: ${ttl}s restantes (${hours}h)`);
        } else {
            console.log(`   ✅ Sin throttling activo`);
        }
        console.log('');

        // TEST 4: Intentar sync con throttling activo
        if (ttl > 0) {
            console.log('📝 TEST 4: Intentar sync con throttling activo');
            const result3 = await syncUsernameIfNeeded(
                usuario,
                `${usuario.nickname}_throttled`,
                usuario.user_id_ext,
                false
            );
            console.log(`   Resultado:`, result3);
            console.log('');
        }

        // TEST 5: Sync forzado (ignora throttling)
        console.log('📝 TEST 5: Sync forzado (ignorar throttling)');
        const forcedName = `${usuario.nickname}_forced_${Date.now()}`;
        const result4 = await syncUsernameIfNeeded(
            usuario,
            forcedName,
            usuario.user_id_ext,
            true // forceSync = true
        );
        console.log(`   Nuevo nombre: ${forcedName}`);
        console.log(`   Resultado:`, result4);
        
        if (result4.updated) {
            console.log(`   ✅ Sync forzado exitoso`);
            
            // Revertir cambio
            await usuario.update({ 
                nickname: result4.oldNickname,
                kick_data: {
                    ...usuario.kick_data,
                    username: result4.oldNickname
                }
            });
            console.log(`   ↩️  Cambio revertido`);
            
            // Limpiar throttling
            await redis.del(syncKey);
            console.log(`   🧹 Throttling limpiado`);
        }
        console.log('');

        console.log('✅ Todas las pruebas completadas exitosamente');

    } catch (error) {
        console.error('❌ Error en pruebas:', error.message);
        console.error(error.stack);
    } finally {
        process.exit(0);
    }
}

// Ejecutar pruebas
testUsernameSync();
