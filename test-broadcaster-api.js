/**
 * Script de prueba para simular un stream en vivo
 * Establece datos en Redis para probar el endpoint /api/broadcaster/info
 */

const { getRedisClient } = require('./src/config/redis.config');
const logger = require('./src/utils/logger');

async function simulateOnlineStream() {
    try {
        const redis = getRedisClient();
        
        console.log('🎮 Simulando stream en vivo...');
        
        // Simular stream ONLINE
        await redis.set('stream:is_live', 'true');
        console.log('✅ Estado del stream: ONLINE');
        
        // Simular información del stream
        const streamInfo = {
            title: '🎮 JUGANDO CON LA COMUNIDAD | !discord !puntos',
            category: 'Grand Theft Auto V',
            category_id: 19577,
            language: 'es',
            has_mature_content: false,
            broadcaster: 'Luisardito',
            started_at: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(), // 2 horas atrás
            updated_by: 'test_script',
        };
        
        await redis.set('stream:current_info', JSON.stringify(streamInfo));
        console.log('✅ Información del stream guardada');
        console.log('   Título:', streamInfo.title);
        console.log('   Categoría:', streamInfo.category);
        console.log('   Iniciado hace:', '2 horas');
        
        // Timestamps
        await redis.set('stream:last_status_update', new Date().toISOString(), 'EX', 86400);
        await redis.set('stream:last_metadata_update', new Date().toISOString(), 'EX', 86400);
        console.log('✅ Timestamps actualizados');
        
        console.log('\n🎉 Simulación completada!');
        console.log('\n📡 Prueba el endpoint:');
        console.log('   curl http://localhost:3001/api/broadcaster/info');
        
        process.exit(0);
        
    } catch (error) {
        console.error('❌ Error simulando stream:', error.message);
        process.exit(1);
    }
}

async function simulateOfflineStream() {
    try {
        const redis = getRedisClient();
        
        console.log('🔴 Simulando stream offline...');
        
        // Simular stream OFFLINE
        await redis.set('stream:is_live', 'false', 'EX', 86400);
        console.log('✅ Estado del stream: OFFLINE');
        
        // Limpiar información del stream
        await redis.del('stream:current_info');
        console.log('✅ Información del stream limpiada');
        
        // Timestamp de última vez en vivo (hace 2 días)
        const twoDaysAgo = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000);
        await redis.set('stream:last_status_update', twoDaysAgo.toISOString(), 'EX', 86400);
        console.log('✅ Última vez en vivo: hace 2 días');
        
        console.log('\n🎉 Simulación completada!');
        console.log('\n📡 Prueba el endpoint:');
        console.log('   curl http://localhost:3001/api/broadcaster/info');
        
        process.exit(0);
        
    } catch (error) {
        console.error('❌ Error simulando stream:', error.message);
        process.exit(1);
    }
}

async function clearStreamData() {
    try {
        const redis = getRedisClient();
        
        console.log('🧹 Limpiando datos del stream...');
        
        await redis.del('stream:is_live');
        await redis.del('stream:current_info');
        await redis.del('stream:last_status_update');
        await redis.del('stream:last_metadata_update');
        
        console.log('✅ Datos limpiados');
        
        console.log('\n📡 Prueba el endpoint:');
        console.log('   curl http://localhost:3001/api/broadcaster/info');
        
        process.exit(0);
        
    } catch (error) {
        console.error('❌ Error limpiando datos:', error.message);
        process.exit(1);
    }
}

// Ejecutar según argumento
const command = process.argv[2];

switch (command) {
    case 'online':
        simulateOnlineStream();
        break;
    case 'offline':
        simulateOfflineStream();
        break;
    case 'clear':
        clearStreamData();
        break;
    default:
        console.log('📋 Uso:');
        console.log('   node test-broadcaster-api.js online   - Simular stream en vivo');
        console.log('   node test-broadcaster-api.js offline  - Simular stream offline');
        console.log('   node test-broadcaster-api.js clear    - Limpiar datos de prueba');
        process.exit(0);
}
