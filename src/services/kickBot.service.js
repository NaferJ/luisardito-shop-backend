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
     * Envía un mensaje al chat de un canal
     * @param {string} channelId - ID del canal/broadcaster
     * @param {string} message - Contenido del mensaje
     */
    async resolveAccessToken() {
        console.log('[KickBot] 🔍 Resolviendo access token...');
        console.log('[KickBot] 🔍 Token en config:', this.accessToken ? `${this.accessToken.substring(0, 10)}...` : 'NO CONFIGURADO');
        console.log('[KickBot] 🔍 Bot username en config:', this.botUsername);
        
        if (this.accessToken && String(this.accessToken).length > 10) {
            console.log('[KickBot] ✅ Usando token de configuración');
            return this.accessToken;
        }

        // Buscar token almacenado del bot en la tabla kick_bot_tokens
        try {
            const where = this.botUsername ? { kick_username: this.botUsername, is_active: true } : { is_active: true };
            console.log('[KickBot] 🔍 Buscando en DB con where:', where);
            
            const record = await KickBotToken.findOne({ where, order: [['updated_at', 'DESC']] });
            console.log('[KickBot] 🔍 Registro encontrado:', record ? {
                id: record.id,
                kick_username: record.kick_username,
                is_active: record.is_active,
                has_token: !!record.access_token,
                token_preview: record.access_token ? `${record.access_token.substring(0, 10)}...` : 'NO TOKEN'
            } : 'NO ENCONTRADO');
            
            if (record?.access_token) {
                this.accessToken = record.access_token;
                console.log('[KickBot] ✅ Token obtenido de DB exitosamente');
                return this.accessToken;
            } else {
                console.log('[KickBot] ❌ No se encontró token en el registro');
            }
        } catch (e) {
            console.error('[KickBot] ❌ Error resolviendo token desde DB:', e.message);
            console.error('[KickBot] ❌ Stack:', e.stack);
        }

        console.log('[KickBot] ❌ No hay token disponible');
        return null;
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
        const payload = {
            type: 'bot',  // Envía como bot
            content: String(message).trim().substring(0, 500)  // Asegura que no exceda el límite
        };

        try {
            console.log(`[KickBot] Enviando mensaje: ${payload.content}`);
            const response = await axios.post(
                url,
                payload,
                {
                    headers: {
                        'Authorization': `Bearer ${token}`,
                        'Content-Type': 'application/json',
                        'Accept': 'application/json'
                    },
                    timeout: 10000
                }
            );

            console.log('[KickBot] ✅ Mensaje enviado exitosamente:', response.data);
            return { 
                ok: true, 
                data: {
                    messageId: response.data.data?.message_id,
                    isSent: response.data.data?.is_sent === true,
                    raw: response.data
                }
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


