'use strict';
/**
 * Migracion de limpieza inicial de la base de datos.
 *
 * Purga datos acumulados durante ~6 meses que ya no son necesarios:
 *  - kick_webhook_events procesados > 7 dias
 *  - kick_event_data JSON en historial_puntos > 30 dias
 *  - Registros de chat en historial_puntos > 90 dias
 *  - Notificaciones leidas > 60 dias
 *  - Notificaciones no leidas > 120 dias
 *  - Refresh tokens revocados y expirados > 7 dias
 *
 * NOTA: Esta migracion es irreversible (down vacio). Los datos eliminados
 * son logs/registros temporales que no afectan la funcionalidad.
 */
module.exports = {
    async up(queryInterface, Sequelize) {
        console.log('\n🧹 [MIGRATION] Iniciando limpieza inicial de base de datos...');
        console.log('🧹 [MIGRATION] Esto puede tomar varios minutos si hay muchos registros.\n');
        // ═══════════════════════════════════════════════════════════
        // 1. kick_webhook_events - Eliminar procesados > 7 dias
        // ═══════════════════════════════════════════════════════════
        console.log('1/6 - Limpiando kick_webhook_events (procesados > 7 dias)...');
        let totalDeleted = 0;
        let batchDeleted;
        do {
            [, batchDeleted] = await queryInterface.sequelize.query(
                "DELETE FROM kick_webhook_events WHERE processed = 1 AND message_timestamp < DATE_SUB(NOW(), INTERVAL 7 DAY) LIMIT 10000"
            );
            totalDeleted += (batchDeleted?.affectedRows || 0);
        } while ((batchDeleted?.affectedRows || 0) === 10000);
        console.log('   -> ' + totalDeleted + ' eventos procesados eliminados');
        // Eliminar no procesados > 30 dias
        console.log('2/6 - Limpiando kick_webhook_events (no procesados > 30 dias)...');
        let totalOld = 0;
        do {
            [, batchDeleted] = await queryInterface.sequelize.query(
                "DELETE FROM kick_webhook_events WHERE message_timestamp < DATE_SUB(NOW(), INTERVAL 30 DAY) LIMIT 10000"
            );
            totalOld += (batchDeleted?.affectedRows || 0);
        } while ((batchDeleted?.affectedRows || 0) === 10000);
        console.log('   -> ' + totalOld + ' eventos muy antiguos eliminados');
        // ═══════════════════════════════════════════════════════════
        // 2. historial_puntos - Nullificar JSON > 30 dias
        // ═══════════════════════════════════════════════════════════
        console.log('3/6 - Limpiando kick_event_data JSON en historial_puntos (> 30 dias)...');
        const [, nullMeta] = await queryInterface.sequelize.query(
            "UPDATE historial_puntos SET kick_event_data = NULL WHERE kick_event_data IS NOT NULL AND fecha < DATE_SUB(NOW(), INTERVAL 30 DAY)"
        );
        console.log('   -> ' + (nullMeta?.affectedRows || 0) + ' registros con JSON limpiado');
        // Eliminar registros de chat > 90 dias (en batches)
        console.log('4/6 - Eliminando registros de chat en historial_puntos (> 90 dias)...');
        let totalChat = 0;
        do {
            [, batchDeleted] = await queryInterface.sequelize.query(
                "DELETE FROM historial_puntos WHERE concepto LIKE 'Mensaje en chat%' AND fecha < DATE_SUB(NOW(), INTERVAL 90 DAY) LIMIT 10000"
            );
            totalChat += (batchDeleted?.affectedRows || 0);
        } while ((batchDeleted?.affectedRows || 0) === 10000);
        console.log('   -> ' + totalChat + ' registros de chat eliminados');
        // ═══════════════════════════════════════════════════════════
        // 3. notificaciones - Leidas > 60 dias, no leidas > 120 dias
        // ═══════════════════════════════════════════════════════════
        console.log('5/6 - Limpiando notificaciones antiguas...');
        const [, readMeta] = await queryInterface.sequelize.query(
            "DELETE FROM notificaciones WHERE estado = 'leida' AND fecha_creacion < DATE_SUB(NOW(), INTERVAL 60 DAY)"
        );
        const [, unreadMeta] = await queryInterface.sequelize.query(
            "DELETE FROM notificaciones WHERE fecha_creacion < DATE_SUB(NOW(), INTERVAL 120 DAY)"
        );
        console.log('   -> ' + (readMeta?.affectedRows || 0) + ' leidas + ' + (unreadMeta?.affectedRows || 0) + ' antiguas eliminadas');
        // ═══════════════════════════════════════════════════════════
        // 4. refresh_tokens - Revocados Y expirados > 7 dias
        // ═══════════════════════════════════════════════════════════
        console.log('6/6 - Limpiando refresh_tokens revocados y expirados...');
        const [, tokenMeta] = await queryInterface.sequelize.query(
            "DELETE FROM refresh_tokens WHERE is_revoked = 1 AND expires_at < DATE_SUB(NOW(), INTERVAL 7 DAY)"
        );
        console.log('   -> ' + (tokenMeta?.affectedRows || 0) + ' tokens eliminados');
        console.log('\n✅ [MIGRATION] Limpieza inicial completada exitosamente!\n');
    },
    async down(queryInterface, Sequelize) {
        // Limpieza irreversible - los datos eliminados son logs temporales
        console.log('Esta migracion no es reversible (limpieza de datos temporales)');
    }
};
