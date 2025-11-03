const axios = require('axios');
const config = require('../../config');
const KickBotToken = require('../models/kickBotToken.model');
const fs = require('fs').promises;
const path = require('path');
const logger = require('../utils/logger');

/**
 * Servicio para enviar mensajes al chat de Kick usando el BOT
 * Requiere un access token de usuario del bot (KICK_BOT_ACCESS_TOKEN)
 */
class KickBotService {
    constructor() {
        this.apiBase = String(config.kick.apiBaseUrl || '').replace(/\/$/, '');
        this.accessToken = config.kickBot?.accessToken;
        this.botUsername = config.kickBot?.username || 'Bot';
        this.tokensFile = path.join(__dirname, '../../tokens/tokens.json');

        // Iniciar refresh automático en background
        this.startAutoRefresh();
    }

    /**
     * Renueva un token de acceso usando el refresh token
     * @param {Object} tokenRecord - Instancia del modelo KickBotToken
     * @returns {Promise<Object>} - Token actualizado
     */
    async refreshToken(tokenRecord) {
        try {
            logger.info(`[KickBot] 🔄 Intentando renovar token para ${tokenRecord.kick_username}`);

            const response = await axios.post('https://id.kick.com/oauth/token',
                new URLSearchParams({
                    grant_type: 'refresh_token',
                    refresh_token: tokenRecord.refresh_token,
                    client_id: config.kickBot.clientId,
                    client_secret: config.kickBot.clientSecret
                    // NO incluir scope al renovar - el refresh token ya tiene los scopes
                }), {
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
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

            // También actualizar tokens.json para mantener sincronizado
            try {
                const tokensForFile = {
                    accessToken: access_token,
                    refreshToken: refresh_token || tokenRecord.refresh_token,
                    expiresAt: Date.now() + (expires_in * 1000),
                    refreshExpiresAt: Date.now() + (365 * 24 * 60 * 60 * 1000), // 1 año aprox
                    username: tokenRecord.kick_username
                };
                await this.writeTokensToFile(tokensForFile);
                logger.info(`[KickBot] 💾 tokens.json actualizado para ${tokenRecord.kick_username}`);
            } catch (fileError) {
                logger.warn(`[KickBot] ⚠️ No se pudo actualizar tokens.json (no crítico):`, fileError.message);
            }

            logger.info(`[KickBot] ✅ Token renovado exitosamente para ${tokenRecord.kick_username}`);
            return tokenRecord;

        } catch (error) {
            const errorData = error.response?.data;
            const errorStatus = error.response?.status;

            logger.error('[KickBot] ❌ Error renovando token:', {
                status: errorStatus,
                data: errorData,
                message: error.message
            });

            // Si el error es de autenticación o refresh token inválido
            if (errorStatus === 400 || errorStatus === 401) {
                logger.info(`[KickBot] ⚠️ Refresh token inválido o expirado para ${tokenRecord.kick_username}`);
                await tokenRecord.update({
                    is_active: false,
                    updated_at: new Date()
                });

                // Crear un error más descriptivo
                const refreshTokenError = new Error(
                    errorStatus === 400
                        ? 'Refresh token expirado o inválido'
                        : 'Token de renovación no autorizado'
                );
                refreshTokenError.code = 'REFRESH_TOKEN_EXPIRED';
                refreshTokenError.originalError = error;

                // 🚨 ALERTA: Refresh token expirado - requiere re-autorización manual
                logger.error(`🚨 [ALERTA CRÍTICA] Refresh token expirado para ${tokenRecord.kick_username}!`);
                logger.error(`🚨 Requiere re-autorización manual en: https://id.kick.com/oauth/authorize?client_id=${config.kickBot.clientId}&redirect_uri=${encodeURIComponent(config.kickBot.redirectUri)}&response_type=code&scope=user:read%20chat:write%20channel:read%20channel:write`);
                logger.error(`🚨 Una vez autorizado, guardar el nuevo código en la DB.`);

                throw refreshTokenError;
            }
            
            throw error;
        }
    }

    /**
     * Renueva un token específico (usado por mantenimiento)
     * @param {Object} tokenRecord - Instancia del modelo KickBotToken
     * @returns {Promise<boolean>} - True si se renovó exitosamente
     */
    async renewAccessToken(tokenRecord) {
        try {
            logger.info(`[KickBot] 🔄 Renovando token para ${tokenRecord.kick_username}...`);
            const updatedRecord = await this.refreshToken(tokenRecord);
            return true;
        } catch (error) {
            logger.error(`[KickBot] ❌ Error renovando token para ${tokenRecord.kick_username}:`, error.message);
            return false;
        }
    }

    /**
     * Resuelve el token de acceso, renovándolo si es necesario
     * @returns {Promise<string>} - Token de acceso
     */
    async resolveAccessToken() {
        logger.info('[KickBot] 🔍 Resolviendo access token...');
        
        // Si hay un token en la configuración, usarlo (para desarrollo)
        if (this.accessToken && String(this.accessToken).length > 10) {
            logger.info('[KickBot] ✅ Usando token de configuración');
            return this.accessToken;
        }

        // Primero intentar con tokens.json
        try {
            const tokens = await this.readTokensFromFile();
            if (tokens && tokens.accessToken) {
                // Verificar si el token está por expirar (en menos de 5 minutos)
                if (tokens.expiresAt > Date.now() + 5 * 60 * 1000) {
                    logger.info('[KickBot] ✅ Token válido desde archivo');
                    return tokens.accessToken;
                } else {
                    logger.info('[KickBot] ⏳ Token expirado o por expirar, renovando desde archivo...');
                    return await this.refreshAccessToken();
                }
            }
        } catch (error) {
            logger.info('[KickBot] ⚠️ Error leyendo tokens.json, intentando con DB:', error.message);
        }

        // Fallback a DB si no hay archivo o falla
        try {
            const where = this.botUsername ? { 
                kick_username: this.botUsername, 
                is_active: true 
            } : { 
                is_active: true 
            };
            
            logger.info('[KickBot] 🔍 Buscando tokens en DB...');
            const records = await KickBotToken.findAll({
                where,
                order: [['updated_at', 'DESC']] 
            });
            
            if (!records || records.length === 0) {
                logger.info('[KickBot] ❌ No se encontraron tokens activos en la base de datos');
                return null;
            }

            logger.info(`[KickBot] 🔍 Encontrados ${records.length} tokens activos`);

            // Probar cada token hasta encontrar uno válido
            for (const record of records) {
                logger.info(`[KickBot] 🔍 Probando token para ${record.kick_username}`, {
                    expira_en: record.token_expires_at,
                    activo: record.is_active,
                    tiene_refresh: !!record.refresh_token
                });

                // Verificar si el token está por expirar (en menos de 30 minutos) o ya expiró
                const now = new Date();
                const expiresAt = new Date(record.token_expires_at);
                const expiresIn = expiresAt - now;
                const thirtyMinutes = 30 * 60 * 1000;
                if (expiresIn < thirtyMinutes) {
                    const isExpired = expiresIn < 0;
                    const minutesUntilExpiry = Math.round(expiresIn / 1000 / 60);

                    if (isExpired) {
                        logger.info(`[KickBot] ⚠️ Token expiró hace ${Math.abs(minutesUntilExpiry)} minutos, intentando renovar...`);
                    } else {
                        logger.info(`[KickBot] ⏳ Token expira pronto (en ${minutesUntilExpiry} minutos), renovando...`);
                    }

                    try {
                        const updatedRecord = await this.refreshToken(record);
                        this.accessToken = updatedRecord.access_token;
                        logger.info(`[KickBot] ✅ Token renovado y seleccionado para ${record.kick_username}`);
                        return this.accessToken;
                    } catch (error) {
                        logger.error(`[KickBot] ❌ Renovación falló para ${record.kick_username}:`, error.message);
                        // Continuar con el siguiente token
                        continue;
                    }
                } else {
                    // Token válido, usarlo
                    this.accessToken = record.access_token;
                    logger.info(`[KickBot] ✅ Token válido seleccionado para ${record.kick_username}`);
                    return this.accessToken;
                }
            }

            // Si ningún token funcionó
            logger.info('[KickBot] ❌ Ningún token pudo ser renovado o es válido');
            return null;

        } catch (e) {
            logger.error('[KickBot] ❌ Error resolviendo token desde DB:', e.message);
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
            logger.error('[KickBot] ❌ No hay access token disponible (config ni DB)');
            return { ok: false, error: 'missing_access_token' };
        }
        
        if (!message || !String(message).trim()) {
            return { ok: false, error: 'empty_message' };
        }

        const url = `${this.apiBase}/public/v1/chat`;
        const broadcasterId = parseInt(config.kick.broadcasterId || '2771761'); // ID del canal de Luisardito
        const payload = {
            type: 'user',  // Usar 'user' en lugar de 'bot' para mejor compatibilidad
            content: String(message).trim().substring(0, 500),  // Asegura que no exceda el límite
            broadcaster_user_id: broadcasterId  // Necesario cuando type es 'user'
        };

        logger.info('[KickBot] 🔍 Detalles del envío:', {
            url,
            payload,
            tokenPreview: token ? `${token.substring(0, 10)}...${token.slice(-5)}` : 'NO TOKEN',
            botUsername: this.botUsername,
            broadcasterId,
            timestamp: new Date().toISOString()
        });

        try {
            logger.info(`[KickBot] 📤 Enviando mensaje: "${payload.content}"`);
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

            logger.info('[KickBot] ✅ Respuesta de la API:', {
                status: response.status,
                statusText: response.statusText,
                data: response.data,
                headers: response.headers
            });

            if (response.status >= 400) {
                logger.error('[KickBot] ❌ Error en la respuesta de la API:', {
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
            logger.error('[KickBot] ❌ Error enviando mensaje:', errorData);
            return { 
                ok: false, 
                error: typeof errorData === 'object' ? JSON.stringify(errorData) : errorData,
                status: error.response?.status
            };
        }
    }

    /**
     * Genera URL de autorización para obtener nuevos tokens
     * @returns {string} URL de autorización
     */
    generateAuthUrl() {
        const scopes = 'user:read chat:write channel:read channel:write';
        const url = `https://id.kick.com/oauth/authorize?client_id=${config.kickBot.clientId}&redirect_uri=${encodeURIComponent(config.kickBot.redirectUri)}&response_type=code&scope=${encodeURIComponent(scopes)}`;
        return url;
    }

    /**
     * Intercambia código de autorización por tokens (para re-autorización manual)
     * @param {string} code - Código de autorización
     * @param {string} username - Username del bot
     * @returns {Promise<Object>} Tokens obtenidos
     */
    async exchangeCodeForTokens(code, username) {
        try {
            logger.info(`[KickBot] 🔄 Intercambiando código por tokens para ${username}...`);

            const response = await axios.post('https://id.kick.com/oauth/token', {
                grant_type: 'authorization_code',
                code: code,
                client_id: config.kickBot.clientId,
                client_secret: config.kickBot.clientSecret,
                redirect_uri: config.kickBot.redirectUri
            }, {
                headers: { 'Content-Type': 'application/json' }
            });

            const { access_token, refresh_token, expires_in } = response.data;
            const tokenExpiresAt = new Date(Date.now() + (expires_in * 1000));

            // Guardar en tokens.json para auto-refresh
            const tokensForFile = {
                accessToken: access_token,
                refreshToken: refresh_token,
                expiresAt: Date.now() + (expires_in * 1000),
                refreshExpiresAt: Date.now() + (365 * 24 * 60 * 60 * 1000), // 1 año aprox
                username: username
            };
            await this.writeTokensToFile(tokensForFile);

            // También guardar en DB como backup
            let tokenRecord = await KickBotToken.findOne({ where: { kick_username: username } });
            if (tokenRecord) {
                await tokenRecord.update({
                    access_token,
                    refresh_token,
                    token_expires_at: tokenExpiresAt,
                    is_active: true,
                    updated_at: new Date()
                });
            } else {
                tokenRecord = await KickBotToken.create({
                    kick_username: username,
                    access_token,
                    refresh_token,
                    token_expires_at: tokenExpiresAt,
                    is_active: true
                });
            }

            logger.info(`[KickBot] ✅ Nuevos tokens guardados para ${username}`);
            return tokenRecord;

        } catch (error) {
            logger.error('[KickBot] ❌ Error intercambiando código:', error.message);
            throw error;
        }
    }

    /**
     * Inicia el proceso de auto-refresh de tokens en segundo plano
     */
    startAutoRefresh() {
        logger.info('[KickBot] ⏰ Iniciando refresh automático de tokens cada 15 minutos (con delay inicial de 30 minutos)');

        // Esperar 30 minutos antes de iniciar el refresh automático para evitar problemas con tokens recién obtenidos
        setTimeout(() => {
            logger.info('[KickBot] ⏰ Delay inicial completado, iniciando refresh automático');

            setInterval(async () => {
                try {
                    logger.info('[KickBot] 🔄 Verificando si el token necesita refresh...');
                    const needsRefresh = await this.checkIfTokenNeedsRefresh();
                    if (needsRefresh) {
                        logger.info('[KickBot] 🔄 Token necesita refresh, ejecutando...');
                        await this.refreshAccessToken();
                        logger.info('[KickBot] ✅ Refresh automático completado');
                    } else {
                        logger.info('[KickBot] ✅ Token aún válido, no se refresca');
                    }
                } catch (error) {
                    logger.error('[KickBot] ❌ Error en el refresh automático:', error.message);
                }
            }, 15 * 60 * 1000); // Cada 15 minutos
        }, 30 * 60 * 1000); // Delay inicial de 30 minutos
    }

    /**
     * Verifica si el token actual necesita ser renovado
     * @returns {Promise<boolean>} True si necesita refresh
     */
    async checkIfTokenNeedsRefresh() {
        try {
            const tokens = await this.readTokensFromFile();
            if (!tokens || !tokens.expiresAt) {
                logger.info('[KickBot] ⚠️ No hay tokens guardados o sin fecha de expiración');
                return true; // Necesita refresh si no hay tokens
            }

            const now = new Date();
            const expiresAt = new Date(tokens.expiresAt);
            const expiresIn = expiresAt - now;
            const thirtyMinutes = 30 * 60 * 1000;

            if (expiresIn < thirtyMinutes) {
                const isExpired = expiresIn < 0;
                const minutesUntilExpiry = Math.round(expiresIn / 1000 / 60);

                if (isExpired) {
                    logger.info(`[KickBot] ⚠️ Token expiró hace ${Math.abs(minutesUntilExpiry)} minutos`);
                } else {
                    logger.info(`[KickBot] ⏳ Token expira pronto (en ${minutesUntilExpiry} minutos)`);
                }
                return true;
            }

            return false; // No necesita refresh
        } catch (error) {
            logger.error('[KickBot] ❌ Error verificando si necesita refresh:', error.message);
            return true; // En caso de error, intentar refresh
        }
    }

    /**
     * Lee tokens desde el archivo tokens.json
     * @returns {Promise<Object|null>} Tokens o null si no existe
     */
    async readTokensFromFile() {
        try {
            const data = await fs.readFile(this.tokensFile, 'utf8');
            return JSON.parse(data);
        } catch (error) {
            if (error.code === 'ENOENT') {
                logger.info('[KickBot] 📄 Archivo tokens.json no existe aún');
                return null;
            }
            throw error;
        }
    }

    /**
     * Escribe tokens al archivo tokens.json
     * @param {Object} tokens - Tokens a guardar
     */
    async writeTokensToFile(tokens) {
        const fullPath = path.resolve(this.tokensFile);
        logger.info('[KickBot] 📁 Intentando guardar tokens en:', fullPath);
        await fs.writeFile(this.tokensFile, JSON.stringify(tokens, null, 2));
        logger.info('[KickBot] 💾 Tokens guardados exitosamente en:', fullPath);
    }

    /**
     * Renueva el access token usando el refresh token del archivo
     * @returns {Promise<string>} Nuevo access token
     */
    async refreshAccessToken() {
        try {
            const tokens = await this.readTokensFromFile();
            if (!tokens || !tokens.refreshToken) {
                throw new Error('No hay refresh token disponible en tokens.json');
            }

            logger.info('[KickBot] 🔄 Renovando access token...');

            const response = await axios.post('https://id.kick.com/oauth/token',
                new URLSearchParams({
                    grant_type: 'refresh_token',
                    refresh_token: tokens.refreshToken,
                    client_id: config.kickBot.clientId,
                    client_secret: config.kickBot.clientSecret
                    // NO incluir scope al renovar
                }), {
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
            });

            const { access_token, refresh_token, expires_in } = response.data;

            // Validar que tenemos el refresh token (Kick rota los refresh tokens)
            if (!refresh_token) {
                throw new Error('Kick no devolvió refresh_token en la respuesta. El refresh token anterior ya no es válido.');
            }

            // Actualizar tokens (Kick rota el refresh token)
            const updatedTokens = {
                accessToken: access_token,
                refreshToken: refresh_token, // Siempre usar el nuevo
                expiresAt: Date.now() + (expires_in * 1000),
                refreshExpiresAt: tokens.refreshExpiresAt || (Date.now() + (365 * 24 * 60 * 60 * 1000)) // 1 año aprox
            };

            await this.writeTokensToFile(updatedTokens);
            logger.info('[KickBot] ✅ Access token renovado exitosamente');

            return updatedTokens.accessToken;

        } catch (error) {
            logger.error('[KickBot] ❌ Error renovando access token:', error.message);
            throw error;
        }
    }
}

module.exports = new KickBotService();
