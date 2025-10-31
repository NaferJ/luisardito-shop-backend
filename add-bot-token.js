const { KickBotToken } = require('./src/models');

/**
 * Script para insertar un nuevo token de bot de Kick
 * Uso: node add-bot-token.js <kick_user_id> <kick_username> <access_token> <refresh_token> <expires_in_seconds>
 */

async function addBotToken() {
    const args = process.argv.slice(2);
    
    if (args.length < 4) {
        console.log('❌ Uso incorrecto. Formato:');
        console.log('node add-bot-token.js <kick_user_id> <kick_username> <access_token> <refresh_token> [expires_in_seconds]');
        console.log('');
        console.log('Ejemplo:');
        console.log('node add-bot-token.js "12345" "LuisarditoBot" "acc_token_aquí" "ref_token_aquí" 3600');
        console.log('');
        console.log('Si no especificas expires_in_seconds, se usará 3600 (1 hora)');
        process.exit(1);
    }

    const [kick_user_id, kick_username, access_token, refresh_token, expires_in = '3600'] = args;
    
    try {
        const expiresInSeconds = parseInt(expires_in);
        const token_expires_at = new Date(Date.now() + (expiresInSeconds * 1000));
        
        console.log('🔄 Insertando token de bot...');
        console.log(`   Usuario: ${kick_username} (ID: ${kick_user_id})`);
        console.log(`   Expira en: ${Math.round(expiresInSeconds / 60)} minutos`);
        
        // Verificar si ya existe un token para este usuario
        const existingToken = await KickBotToken.findOne({
            where: { kick_user_id }
        });
        
        if (existingToken) {
            console.log('⚠️ Ya existe un token para este usuario. Actualizando...');
            await existingToken.update({
                kick_username,
                access_token,
                refresh_token,
                token_expires_at,
                is_active: true,
                updated_at: new Date()
            });
            console.log('✅ Token actualizado exitosamente');
        } else {
            await KickBotToken.create({
                kick_user_id,
                kick_username,
                access_token,
                refresh_token,
                token_expires_at,
                is_active: true,
                scopes: ['user:read', 'chat:write', 'channel:read', 'channel:write']
            });
            console.log('✅ Token creado exitosamente');
        }
        
        // Verificar la inserción
        const totalTokens = await KickBotToken.count();
        const activeTokens = await KickBotToken.count({ where: { is_active: true } });
        
        console.log('📊 Estado actual:');
        console.log(`   Total de tokens: ${totalTokens}`);
        console.log(`   Tokens activos: ${activeTokens}`);
        
        // Probar el token
        console.log('🧪 Probando token...');
        const kickBotService = require('./src/services/kickBot.service');
        const resolvedToken = await kickBotService.resolveAccessToken();
        
        if (resolvedToken) {
            console.log('✅ Token resuelto correctamente, bot listo para usar');
        } else {
            console.log('❌ Error resolviendo token, verificar datos');
        }
        
    } catch (error) {
        console.error('❌ Error insertando token:', error);
        throw error;
    }
}

// Función para mostrar tokens existentes
async function listTokens() {
    try {
        const tokens = await KickBotToken.findAll({
            order: [['updated_at', 'DESC']]
        });
        
        if (tokens.length === 0) {
            console.log('📭 No hay tokens de bot en la base de datos');
            return;
        }
        
        console.log(`📋 Tokens de bot encontrados (${tokens.length}):`);
        console.log('');
        
        tokens.forEach(token => {
            const now = new Date();
            const expiresAt = new Date(token.token_expires_at);
            const expiresIn = Math.round((expiresAt - now) / 1000 / 60);
            
            const status = token.is_active 
                ? (expiresIn > 0 ? `✅ Activo (expira en ${expiresIn}min)` : `⚠️ Expirado hace ${Math.abs(expiresIn)}min`)
                : '❌ Inactivo';
                
            console.log(`  🤖 ${token.kick_username} (ID: ${token.kick_user_id})`);
            console.log(`     Estado: ${status}`);
            console.log(`     Refresh: ${token.refresh_token ? '✅' : '❌'}`);
            console.log(`     Actualizado: ${token.updated_at}`);
            console.log('');
        });
        
    } catch (error) {
        console.error('❌ Error listando tokens:', error);
        throw error;
    }
}

// Si se ejecuta directamente
if (require.main === module) {
    const command = process.argv[2];
    
    if (command === 'list' || command === '--list' || command === '-l') {
        listTokens()
            .then(() => process.exit(0))
            .catch(error => {
                console.error('💥 Error fatal:', error);
                process.exit(1);
            });
    } else {
        addBotToken()
            .then(() => {
                console.log('🎉 Operación completada exitosamente');
                process.exit(0);
            })
            .catch(error => {
                console.error('💥 Error fatal:', error);
                process.exit(1);
            });
    }
}

module.exports = { addBotToken, listTokens };
