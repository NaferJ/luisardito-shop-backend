const { ensureValidToken, refreshAccessToken } = require('./kickAutoSubscribe.service');
const { KickBroadcasterToken } = require('../models');
const logger = require('../utils/logger');

class TokenRefreshService {
    constructor() {
        this.isRunning = false;
        this.intervalId = null;
        this.intervalMs = 30 * 60 * 1000; // 30 minutos en milisegundos
    }

    /**
     * Inicia el servicio de refresh automático de tokens
     */
    start() {
        if (this.isRunning) {
            logger.info('[Token Refresh Service] Ya está en ejecución');
            return;
        }

        logger.info('[Token Refresh Service] Iniciando servicio...');

        // Ejecutar inmediatamente al iniciar
        this.checkAndRefreshTokens();

        // Programar ejecución cada 30 minutos
        this.intervalId = setInterval(() => {
            this.checkAndRefreshTokens();
        }, this.intervalMs);

        this.isRunning = true;

        logger.info('[Token Refresh Service] ✅ Servicio iniciado - verificará tokens cada 30 minutos');
    }

    /**
     * Detiene el servicio
     */
    stop() {
        if (this.intervalId) {
            clearInterval(this.intervalId);
            this.intervalId = null;
        }
        this.isRunning = false;
        logger.info('[Token Refresh Service] ❌ Servicio detenido');
    }

    /**
     * Verifica y refresca tokens que están por expirar
     */
    async checkAndRefreshTokens() {
        try {
            logger.info('[Token Refresh Service] Verificando tokens...');

            const activeTokens = await KickBroadcasterToken.findAll({
                where: { is_active: true }
            });

            if (activeTokens.length === 0) {
                logger.info('[Token Refresh Service] No hay tokens activos');
                return;
            }

            for (const token of activeTokens) {
                await this.checkTokenExpiration(token);
            }

        } catch (error) {
            logger.error('[Token Refresh Service] Error verificando tokens:', error.message);
        }
    }

    /**
     * Verifica si un token específico necesita ser refrescado
     */
    async checkTokenExpiration(broadcasterToken) {
        try {
            const now = new Date();
            const bufferTime = 60 * 60 * 1000; // 1 hora de buffer
            const expiresAt = new Date(broadcasterToken.token_expires_at);

            logger.info(`[Token Refresh Service] Verificando token de ${broadcasterToken.kick_username}`);
            logger.info(`[Token Refresh Service] Expira: ${expiresAt}, Ahora: ${now}`);

            // Si el token expira en menos de 1 hora, refrescarlo
            if (expiresAt.getTime() - now.getTime() < bufferTime) {
                logger.info(`[Token Refresh Service] Token de ${broadcasterToken.kick_username} expira pronto, refrescando...`);

                const refreshed = await refreshAccessToken(broadcasterToken);

                if (refreshed) {
                    logger.info(`[Token Refresh Service] ✅ Token de ${broadcasterToken.kick_username} refrescado exitosamente`);
                } else {
                    logger.error(`[Token Refresh Service] ❌ No se pudo refrescar el token de ${broadcasterToken.kick_username}`);

                    // Marcar como inactivo si no se puede refrescar
                    await broadcasterToken.update({
                        is_active: false,
                        subscription_error: 'Token expirado y no se pudo refrescar'
                    });
                }
            } else {
                logger.info(`[Token Refresh Service] Token de ${broadcasterToken.kick_username} aún válido`);
            }

        } catch (error) {
            logger.error(`[Token Refresh Service] Error verificando token de ${broadcasterToken.kick_username}:`, error.message);
        }
    }

    /**
     * Fuerza el refresh de un token específico
     */
    async forceRefresh(kickUserId) {
        try {
            const token = await KickBroadcasterToken.findOne({
                where: {
                    kick_user_id: kickUserId,
                    is_active: true
                }
            });

            if (!token) {
                throw new Error('Token no encontrado');
            }

            logger.info(`[Token Refresh Service] Forzando refresh del token de ${token.kick_username}`);
            const success = await refreshAccessToken(token);

            if (success) {
                logger.info(`[Token Refresh Service] ✅ Refresh forzado exitoso para ${token.kick_username}`);
                return { success: true, message: 'Token refrescado exitosamente' };
            } else {
                throw new Error('No se pudo refrescar el token');
            }

        } catch (error) {
            logger.error('[Token Refresh Service] Error en refresh forzado:', error.message);
            return { success: false, error: error.message };
        }
    }

    /**
     * Obtiene el estado del servicio
     */
    getStatus() {
        const nextExecution = this.isRunning ? new Date(Date.now() + this.intervalMs) : null;

        return {
            isRunning: this.isRunning,
            intervalMinutes: this.intervalMs / (60 * 1000),
            nextExecution: nextExecution,
            lastCheck: new Date()
        };
    }
}

// Instancia singleton
const tokenRefreshService = new TokenRefreshService();

module.exports = tokenRefreshService;
