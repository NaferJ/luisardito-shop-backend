const WebSocket = require('ws');
const axios = require('axios');

async function testKickWebSocket() {
    console.log('🔍 [TEST] Iniciando prueba de WebSocket de Kick...');

    try {
        // 1. Primero obtener el ID del canal de Luisardito
        console.log('📡 [TEST] Obteniendo ID del canal de Luisardito...');

        const channelResponse = await axios.get('https://kick.com/api/v2/channels/luisardito', {
            timeout: 10000,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            }
        });

        const channelData = channelResponse.data;
        console.log('📡 [TEST] Canal encontrado:', {
            id: channelData.id,
            slug: channelData.slug,
            user_id: channelData.user_id,
            is_live: channelData.livestream?.is_live || false
        });

        const channelId = channelData.id;

        // 2. Probar conexión WebSocket (varias URLs posibles)
        const wsUrls = [
            `wss://ws-us2.pusher.app/app/32cbd69e4b950bf97679?protocol=7&client=js&version=4.4.0&flash=false`,
            `wss://ws.pusher.com/app/32cbd69e4b950bf97679?protocol=7&client=js&version=4.4.0&flash=false`,
            `wss://kick.com/ws/chat`,
            `wss://chat.kick.com/ws`
        ];

        for (const wsUrl of wsUrls) {
            console.log(`🔌 [TEST] Probando WebSocket: ${wsUrl}`);

            try {
                const ws = new WebSocket(wsUrl);

                const testPromise = new Promise((resolve, reject) => {
                    const timeout = setTimeout(() => {
                        ws.close();
                        reject(new Error('Timeout - no se pudo conectar en 5 segundos'));
                    }, 5000);

                    ws.on('open', function() {
                        console.log(`✅ [TEST] Conectado a: ${wsUrl}`);
                        clearTimeout(timeout);

                        // Intentar suscribirse al chat
                        try {
                            ws.send(JSON.stringify({
                                event: 'pusher:subscribe',
                                data: {
                                    channel: `chatrooms.${channelId}.v2`
                                }
                            }));
                            console.log(`📨 [TEST] Enviado subscribe a canal: chatrooms.${channelId}.v2`);
                        } catch (e) {
                            console.log(`⚠️ [TEST] Error enviando subscribe:`, e.message);
                        }

                        resolve(true);
                    });

                    ws.on('message', function(data) {
                        try {
                            const message = JSON.parse(data);
                            console.log(`📩 [TEST] Mensaje recibido:`, message);

                            if (message.event === 'pusher:connection_established') {
                                console.log(`🎉 [TEST] Conexión establecida exitosamente`);
                            }

                            if (message.event === 'pusher:subscription_succeeded') {
                                console.log(`🎉 [TEST] Suscripción al chat exitosa`);
                            }

                            if (message.event === 'App\\Events\\ChatMessageEvent') {
                                console.log(`💬 [TEST] MENSAJE DE CHAT:`, message.data);
                            }
                        } catch (e) {
                            console.log(`⚠️ [TEST] Error parseando mensaje:`, e.message);
                        }
                    });

                    ws.on('error', function(error) {
                        console.log(`❌ [TEST] Error WebSocket:`, error.message);
                        clearTimeout(timeout);
                        reject(error);
                    });

                    ws.on('close', function(code, reason) {
                        console.log(`🔌 [TEST] WebSocket cerrado: ${code} - ${reason}`);
                        clearTimeout(timeout);
                        resolve(false);
                    });
                });

                const result = await testPromise;
                if (result) {
                    console.log(`✅ [TEST] WebSocket funcional encontrado: ${wsUrl}`);

                    // Mantener conexión por 30 segundos para probar mensajes
                    console.log(`⏰ [TEST] Manteniendo conexión por 30 segundos para probar mensajes...`);
                    await new Promise(resolve => setTimeout(resolve, 30000));

                    ws.close();
                    break;
                }

            } catch (error) {
                console.log(`❌ [TEST] Falló ${wsUrl}:`, error.message);
                continue;
            }
        }

    } catch (error) {
        console.error('❌ [TEST] Error general:', error.message);

        if (error.response) {
            console.error('❌ [TEST] Detalles del error:', {
                status: error.response.status,
                statusText: error.response.statusText,
                data: error.response.data
            });
        }
    }
}

module.exports = { testKickWebSocket };

// Si se ejecuta directamente
if (require.main === module) {
    testKickWebSocket();
}
