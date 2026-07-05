const { Op } = require('sequelize');
const logger = require('../utils/logger');
/**
 * Periodic database cleanup service.
 *
 * Removes old records from tables that grow without control
 * to maintain a healthy DB size and backups.
 *
 * Target tables:
 *  - kick_webhook_events  -> only used for idempotency (7 days)
 *  - historial_puntos     -> heavy chat records (90 days)
 *  - notificaciones       -> read (60 days), unread (120 days)
 *  - refresh_tokens       -> revoked AND expired (7 days)
 */
class DbCleanupService {
    // kick_webhook_events - delete processed events > 7 days
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
        // Also delete very old unprocessed events (> 30 days)
        const cutoff30 = new Date();
        cutoff30.setDate(cutoff30.getDate() - 30);
        const deletedOld = await KickWebhookEvent.destroy({
            where: {
                message_timestamp: { [Op.lt]: cutoff30 }
            }
        });
        return { deleted_processed: deleted, deleted_very_old: deletedOld };
    }
    // historial_puntos - clean JSON data and old chat records
    static async cleanHistorialPuntos() {
        const { sequelize } = require('../models/database');
        // 1. Nullify kick_event_data in records > 30 days
        const [, nullifiedMeta] = await sequelize.query(
            "UPDATE historial_puntos SET kick_event_data = NULL WHERE kick_event_data IS NOT NULL AND fecha < DATE_SUB(NOW(), INTERVAL 30 DAY)"
        );
        const nullified = nullifiedMeta?.affectedRows || 0;
        // 2. Delete chat-type records > 90 days (the most numerous)
        //    Subs, follows, redemptions, rewards records are kept
        const [, deletedMeta] = await sequelize.query(
            "DELETE FROM historial_puntos WHERE concepto LIKE 'Mensaje en chat%' AND fecha < DATE_SUB(NOW(), INTERVAL 90 DAY) LIMIT 50000"
        );
        const deletedChat = deletedMeta?.affectedRows || 0;
        return { nullified_json: nullified, deleted_chat_records: deletedChat };
    }
    // notificaciones - read > 60 days, unread > 120 days
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
    // refresh_tokens - ONLY revoked AND expired > 7 days
    // NEVER touches active tokens (not revoked and not expired)
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
    // Run ALL cleanups
    static async runAll() {
        const results = {};
        try {
            logger.info('[DB-CLEANUP] Starting database cleanup...');
            results.webhookEvents = await this.cleanKickWebhookEvents();
            logger.info('[DB-CLEANUP] kick_webhook_events: ' + results.webhookEvents.deleted_processed + ' processed deleted, ' + results.webhookEvents.deleted_very_old + ' very old deleted');
            results.historialPuntos = await this.cleanHistorialPuntos();
            logger.info('[DB-CLEANUP] historial_puntos: ' + results.historialPuntos.nullified_json + ' JSONs cleaned, ' + results.historialPuntos.deleted_chat_records + ' chat records deleted');
            results.notificaciones = await this.cleanNotificaciones();
            logger.info('[DB-CLEANUP] notificaciones: ' + results.notificaciones.deleted_read + ' read deleted, ' + results.notificaciones.deleted_old_unread + ' old deleted');
            results.refreshTokens = await this.cleanRefreshTokens();
            logger.info('[DB-CLEANUP] refresh_tokens: ' + results.refreshTokens.deleted_revoked_expired + ' revoked/expired deleted');
            logger.info('[DB-CLEANUP] Database cleanup completed');
        } catch (error) {
            logger.error('[DB-CLEANUP] Error during cleanup:', error);
            results.error = error.message;
        }
        return results;
    }
}
module.exports = DbCleanupService;
