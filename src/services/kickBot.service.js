const axios = require('axios');
const config = require('../../config');
const KickBotToken = require('../models/kickBotToken.model');

/**
 * Servicio para enviar mensajes al chat de Kick usando el BOT
 * Requiere un access token de usuario del bot (KICK_BOT_ACCESS_TOKEN)
 */
class KickBotService {
    constructor() {
        this.apiBase = String(config.kick.apiBaseUrl || '').replace(/\/$/, '');
        this.accessToken = config.kickBot?.accessToken;
        this.botUsername = config.kickBot?.username || 'Bot';
    }

    /**
     * Renueva un token de acceso usando el refresh token
     * @param {Object} tokenRecord - Instancia del modelo KickBotToken
     * @returns {Promise<Object>} - Token actualizado
     */
    async refreshToken(tokenRecord) {
        try {
            console.log(`[KickBot] 🔄 Intentando renovar token para ${tokenRecord.kick_username}`);

            const response = await axios.post('https://id.kick.com/oauth/token', {
                grant_type: 'refresh_token',
                refresh_token: tokenRecord.refresh_token,
                client_id: config.kickBot.clientId,
                client_secret: config.kickBot.clientSecret,
                scope: 'user:read chat:write channel:read channel:write'
            }, {
                headers: { 'Content-Type': 'application/json' }
            });

            const { access_token, refresh_token, expires_in } = response.data;
            const tokenExpiresAt = new Date(Date.now() + (expires_in * 1000));

            // Actualizar el registro en la base de datos
            await tokenRecord.update({
                access_token,
                refresh_token: refresh_token || tokenRecord.refresh_token,
                token_expires_at: tokenExpiresAt,
                updated_at: new Date()
            });

            console.log(`[KickBot] ✅ Token renovado exitosamente para ${tokenRecord.kick_username}`);
            return tokenRecord;

        } catch (error) {
            console.error('[KickBot] ❌ Error renovando token:', error.response?.data || error.message);
            
            // Si el error es de autenticación, marcar el token como inactivo
            if (error.response?.status === 401) {
                console.log(`[KickBot] ⚠️ Desactivando token inválido para ${tokenRecord.kick_username}`);
                await tokenRecord.update({ is_active: false });
            }
            
            throw error;
        }
    }

    /**
     * Resuelve el token de acceso, renovándolo si es necesario
     * @returns {Promise<string>} - Token de acceso
     */
    async resolveAccessToken() {
        console.log('[KickBot] 🔍 Resolviendo access token...');
        
        // Si hay un token en la configuración, usarlo (para desarrollo)
        if (this.accessToken && String(this.accessToken).length > 10) {
            console.log('[KickBot] ✅ Usando token de configuración');
            return this.accessToken;
        }

        // Buscar token almacenado del bot en la tabla kick_bot_tokens
        try {
            const where = this.botUsername ? { 
                kick_username: this.botUsername, 
                is_active: true 
            } : { 
                is_active: true 
            };
            
            console.log('[KickBot] 🔍 Buscando token en DB...');
            const record = await KickBotToken.findOne({ 
                where, 
                order: [['updated_at', 'DESC']] 
            });
            
            if (!record) {
                console.log('[KickBot] ❌ No se encontró token activo en la base de datos');
                return null;
            }

            console.log(`[KickBot] 🔍 Token encontrado para ${record.kick_username}`, {
                expira_en: record.token_expires_at,
                activo: record.is_active,
                tiene_refresh: !!record.refresh_token
            });

            // Verificar si el token está por expirar (en menos de 5 minutos)
            const expiresIn = new Date(record.token_expires_at) - new Date();
            const fiveMinutes = 5 * 60 * 1000; // 5 minutos en milisegundos
            
            if (expiresIn < fiveMinutes) {
                console.log(`[KickBot] ⏳ Token expira pronto (en ${Math.round(expiresIn/1000/60)} minutos), renovando...`);
                try {
                    const updatedRecord = await this.refreshToken(record);
                    this.accessToken = updatedRecord.access_token;
                    return this.accessToken;
                } catch (error) {
                    console.error('[KickBot] ❌ No se pudo renovar el token:', error.message);
                    return record.access_token; // Intentar con el token actual aunque esté por expirar
                }
            }

            // Si el token es válido por más de 5 minutos, usarlo directamente
            this.accessToken = record.access_token;
            return this.accessToken;

        } catch (e) {
            console.error('[KickBot] ❌ Error resolviendo token desde DB:', e.message);
            return null;
        }
    }

    /**
     * Envía un mensaje al chat como bot
     * @param {string} message - El mensaje a enviar (máx 500 caracteres)
     * @returns {Promise<{ok: boolean, data?: Object, error?: string}>} Resultado de la operación
     */
    async sendMessage(message) {
        const token = await this.resolveAccessToken();
        if (!token) {
            console.error('[KickBot] ❌ No hay access token disponible (config ni DB)');
            return { ok: false, error: 'missing_access_token' };
        }
        
        if (!message || !String(message).trim()) {
            return { ok: false, error: 'empty_message' };
        }

        const url = `${this.apiBase}/public/v1/chat`;
        const broadcasterId = parseInt(config.kick.broadcasterId || '2771761'); // ID del canal de Luisardito
        const payload = {
            type: 'bot',  // Usar 'user' en lugar de 'bot' para mejor compatibilidad
            content: String(message).trim().substring(0, 500),  // Asegura que no exceda el límite
            broadcaster_user_id: broadcasterId  // Necesario cuando type es 'user'
        };

        console.log('[KickBot] 🔍 Detalles del envío:', {
            url,
            payload,
            tokenPreview: token ? `${token.substring(0, 10)}...${token.slice(-5)}` : 'NO TOKEN',
            botUsername: this.botUsername,
            broadcasterId,
            timestamp: new Date().toISOString()
        });

        try {
            console.log(`[KickBot] 📤 Enviando mensaje: "${payload.content}"`);
            const response = await axios.post(
                url,
                payload,
                {
                    headers: {
                        'Authorization': `Bearer ${token}`,
                        'Content-Type': 'application/json',
                        'Accept': 'application/json',
                        'User-Agent': 'LuisarditoShop/1.0'
                    },
                    timeout: 10000,
                    validateStatus: status => status < 500 // No lanzar error para códigos 4xx
                }
            );

            console.log('[KickBot] ✅ Respuesta de la API:', {
                status: response.status,
                statusText: response.statusText,
                data: response.data,
                headers: response.headers
            });

            if (response.status >= 400) {
                console.error('[KickBot] ❌ Error en la respuesta de la API:', {
                    status: response.status,
                    data: response.data,
                    headers: response.headers
                });
            }

            return { 
                ok: response.status < 400, 
                status: response.status,
                data: {
                    messageId: response.data?.data?.message_id,
                    isSent: response.data?.data?.is_sent === true,
                    raw: response.data
                },
                headers: response.headers
            };
        } catch (error) {
            const errorData = error.response?.data || error.message;
            console.error('[KickBot] ❌ Error enviando mensaje:', errorData);
            return { 
                ok: false, 
                error: typeof errorData === 'object' ? JSON.stringify(errorData) : errorData,
                status: error.response?.status
            };
        }
    }
}

module.exports = new KickBotService();


