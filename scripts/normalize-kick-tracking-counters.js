'use strict';

// Script seguro para normalizar contadores y flags en kick_user_tracking
// - Reemplaza NULL por 0 en total_subscriptions, total_gifts_received, total_gifts_given
// - Reemplaza NULL por false en is_subscribed
// - Opcionalmente corrige negativos a 0 (defensivo)
// - Muestra un resumen antes y después

const { sequelize, KickUserTracking } = require('../src/models');

async function getSummary() {
    const [[row]] = await sequelize.query(`
        SELECT
            COUNT(*) AS total,
            SUM(CASE WHEN total_subscriptions IS NULL THEN 1 ELSE 0 END) AS null_total_subscriptions,
            SUM(CASE WHEN total_gifts_received IS NULL THEN 1 ELSE 0 END) AS null_total_gifts_received,
            SUM(CASE WHEN total_gifts_given IS NULL THEN 1 ELSE 0 END) AS null_total_gifts_given,
            SUM(CASE WHEN is_subscribed IS NULL THEN 1 ELSE 0 END) AS null_is_subscribed,
            SUM(CASE WHEN total_subscriptions < 0 THEN 1 ELSE 0 END) AS neg_total_subscriptions,
            SUM(CASE WHEN total_gifts_received < 0 THEN 1 ELSE 0 END) AS neg_total_gifts_received,
            SUM(CASE WHEN total_gifts_given < 0 THEN 1 ELSE 0 END) AS neg_total_gifts_given
        FROM kick_user_tracking
    `);
    return row;
}

async function main() {
    console.log('🔧 Normalización de kick_user_tracking iniciada...');
    const before = await getSummary();
    console.log('📊 Antes:', before);

    const t = await sequelize.transaction();
    try {
        // Reemplazar NULL por 0 en contadores
        await sequelize.query(
            `UPDATE kick_user_tracking SET total_subscriptions = 0 WHERE total_subscriptions IS NULL`,
            { transaction: t }
        );
        await sequelize.query(
            `UPDATE kick_user_tracking SET total_gifts_received = 0 WHERE total_gifts_received IS NULL`,
            { transaction: t }
        );
        await sequelize.query(
            `UPDATE kick_user_tracking SET total_gifts_given = 0 WHERE total_gifts_given IS NULL`,
            { transaction: t }
        );

        // is_subscribed: NULL -> false
        await sequelize.query(
            `UPDATE kick_user_tracking SET is_subscribed = 0 WHERE is_subscribed IS NULL`,
            { transaction: t }
        );

        // Defensivo: negativos -> 0
        await sequelize.query(
            `UPDATE kick_user_tracking SET total_subscriptions = 0 WHERE total_subscriptions < 0`,
            { transaction: t }
        );
        await sequelize.query(
            `UPDATE kick_user_tracking SET total_gifts_received = 0 WHERE total_gifts_received < 0`,
            { transaction: t }
        );
        await sequelize.query(
            `UPDATE kick_user_tracking SET total_gifts_given = 0 WHERE total_gifts_given < 0`,
            { transaction: t }
        );

        await t.commit();
    } catch (err) {
        await t.rollback();
        console.error('❌ Error normalizando kick_user_tracking:', err);
        process.exitCode = 1;
        return;
    }

    const after = await getSummary();
    console.log('✅ Después:', after);

    // Mostrar preview de algunas filas con posibles problemas de expiración (diagnóstico ligero)
    const [rows] = await sequelize.query(`
        SELECT kick_user_id, kick_username, is_subscribed, subscription_expires_at,
               total_subscriptions, total_gifts_received, total_gifts_given
        FROM kick_user_tracking
        ORDER BY updated_at DESC
        LIMIT 10
    `);
    console.log('🔎 Muestra de registros:', rows);

    await sequelize.close();
    console.log('🎉 Normalización finalizada.');
}

main().catch((e) => {
    console.error('❌ Error inesperado:', e);
    process.exit(1);
});


