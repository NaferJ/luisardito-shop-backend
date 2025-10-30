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
        if (this.accessToken && String(this.accessToken).length > 10) return this.accessToken;

        // Buscar token almacenado del bot en la tabla kick_bot_tokens
        try {
            const where = this.botUsername ? { kick_username: this.botUsername, is_active: true } : { is_active: true };
            const record = await KickBotToken.findOne({ where, order: [['updated_at', 'DESC']] });
            if (record?.access_token) {
                this.accessToken = record.access_token;
                return this.accessToken;
            }
        } catch (e) {
            console.error('[KickBot] Error resolviendo token desde DB:', e.message);
        }

        return null;
    }

    async sendMessage(channelId, message) {
        const token = await this.resolveAccessToken();
        if (!token) {
            console.error('[KickBot] ❌ No hay access token disponible (config ni DB)');
            return { ok: false, error: 'missing_access_token' };
        }
        if (!channelId) {
            console.error('[KickBot] ❌ channelId requerido para enviar mensajes');
            return { ok: false, error: 'missing_channel_id' };
        }
        if (!message || !String(message).trim()) {
            return { ok: false, error: 'empty_message' };
        }

        // Endpoint tentativo para mensajes de chat
        // Nota: Ajustar si Kick cambia/expone otro endpoint público
        const url = `${this.apiBase}/public/v1/channels/${channelId}/messages`;

        try {
            const response = await axios.post(
                url,
                { content: message, type: 'message' },
                {
                    headers: {
                        'Authorization': `Bearer ${token}`,
                        'Content-Type': 'application/json'
                    },
                    timeout: 10000
                }
            );

            return { ok: true, data: response.data };
        } catch (error) {
            console.error('[KickBot] ❌ Error enviando mensaje:', error.response?.data || error.message);
            return { ok: false, error: error.response?.data || error.message };
        }
    }
}

module.exports = new KickBotService();


