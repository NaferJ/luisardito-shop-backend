const { Op } = require('sequelize');
const logger = require('../utils/logger');
/**
 * Servicio de limpieza periodica de la base de datos.
 *
 * Elimina registros antiguos de tablas que crecen sin control
 * para mantener un tamano saludable de la BD y de los backups.
 *
 * Tablas objetivo:
 *  - kick_webhook_events  -> solo sirven para idempotencia (7 dias)
 *  - historial_puntos     -> registros de chat pesados (90 dias)
 *  - notificaciones       -> leidas (60 dias), no leidas (120 dias)
 *  - refresh_tokens       -> revocados Y expirados (7 dias)
 */
class DbCleanupService {
    // kick_webhook_events - eliminar eventos procesados > 7 dias
    static async cleanKickWebhookEvents() {
        const KickWebhookEvent = require('../models/kickWebhookEvent.model');
        const cutoff = new Date();
        cutoff.setDate(cutoff.getDate() - 7);
        const deleted = await KickWebhookEvent.destroy({
            where: {
                processed: true,
                message_timestamp: { [Op.lt]: cutoff }
            }
        });
        // Tambien eliminar eventos no procesados muy antiguos (> 30 dias)
        const cutoff30 = new Date();
        cutoff30.setDate(cutoff30.getDate() - 30);
        const deletedOld = await KickWebhookEvent.destroy({
            where: {
                message_timestamp: { [Op.lt]: cutoff30 }
            }
        });
        return { deleted_processed: deleted, deleted_very_old: deletedOld };
    }
    // historial_puntos - limpiar datos JSON y registros de chat viejos
    static async cleanHistorialPuntos() {
        const { sequelize } = require('../models/database');
        // 1. Nullificar kick_event_data en registros > 30 dias
        const [, nullifiedMeta] = await sequelize.query(
            "UPDATE historial_puntos SET kick_event_data = NULL WHERE kick_event_data IS NOT NULL AND fecha < DATE_SUB(NOW(), INTERVAL 30 DAY)"
        );
        const nullified = nullifiedMeta?.affectedRows || 0;
        // 2. Eliminar registros de tipo chat > 90 dias (son los mas numerosos)
        //    Los registros de subs, follows, canjes, rewards se mantienen
        const [, deletedMeta] = await sequelize.query(
            "DELETE FROM historial_puntos WHERE concepto LIKE 'Mensaje en chat%' AND fecha < DATE_SUB(NOW(), INTERVAL 90 DAY) LIMIT 50000"
        );
        const deletedChat = deletedMeta?.affectedRows || 0;
        return { nullified_json: nullified, deleted_chat_records: deletedChat };
    }
    // notificaciones - leidas > 60 dias, no leidas > 120 dias
    static async cleanNotificaciones() {
        const Notificacion = require('../models/notificacion.model');
        const cutoff60 = new Date();
        cutoff60.setDate(cutoff60.getDate() - 60);
        const deletedRead = await Notificacion.destroy({
            where: {
                estado: 'leida',
                fecha_creacion: { [Op.lt]: cutoff60 }
            }
        });
        const cutoff120 = new Date();
        cutoff120.setDate(cutoff120.getDate() - 120);
        const deletedUnread = await Notificacion.destroy({
            where: {
                fecha_creacion: { [Op.lt]: cutoff120 }
            }
        });
        return { deleted_read: deletedRead, deleted_old_unread: deletedUnread };
    }
    // refresh_tokens - SOLO revocados Y expirados > 7 dias
    // NUNCA toca tokens activos (no revocados y no expirados)
    static async cleanRefreshTokens() {
        const RefreshToken = require('../models/refreshToken.model');
        const cutoff = new Date();
        cutoff.setDate(cutoff.getDate() - 7);
        const deleted = await RefreshToken.destroy({
            where: {
                is_revoked: true,
                expires_at: { [Op.lt]: cutoff }
            }
        });
        return { deleted_revoked_expired: deleted };
    }
    // Ejecutar TODAS las limpiezas
    static async runAll() {
        const results = {};
        try {
            logger.info('🧹 [DB-CLEANUP] Iniciando limpieza de base de datos...');
            results.webhookEvents = await this.cleanKickWebhookEvents();
            logger.info('🧹 [DB-CLEANUP] kick_webhook_events: ' + results.webhookEvents.deleted_processed + ' procesados eliminados, ' + results.webhookEvents.deleted_very_old + ' muy antiguos eliminados');
            results.historialPuntos = await this.cleanHistorialPuntos();
            logger.info('🧹 [DB-CLEANUP] historial_puntos: ' + results.historialPuntos.nullified_json + ' JSONs limpiados, ' + results.historialPuntos.deleted_chat_records + ' registros de chat eliminados');
            results.notificaciones = await this.cleanNotificaciones();
            logger.info('🧹 [DB-CLEANUP] notificaciones: ' + results.notificaciones.deleted_read + ' leidas eliminadas, ' + results.notificaciones.deleted_old_unread + ' antiguas eliminadas');
            results.refreshTokens = await this.cleanRefreshTokens();
            logger.info('🧹 [DB-CLEANUP] refresh_tokens: ' + results.refreshTokens.deleted_revoked_expired + ' revocados/expirados eliminados');
            logger.info('✅ [DB-CLEANUP] Limpieza de base de datos completada');
        } catch (error) {
            logger.error('❌ [DB-CLEANUP] Error durante limpieza:', error);
            results.error = error.message;
        }
        return results;
    }
}
module.exports = DbCleanupService;
