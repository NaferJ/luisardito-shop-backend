"use strict";

/**
 * Migración: Agregar columna precio_al_canje a tabla canjes
 *
 * Propósito: Mantener registro histórico del precio exacto que se pagó
 * por cada canje, permitiendo cambios de precio en productos sin afectar
 * la integridad de los datos históricos.
 *
 * Estrategia Zero-Downtime:
 * - Columna nullable inicialmente
 * - Valor por defecto NULL permite operación continua
 * - Backfill posterior actualiza datos históricos
 * - Controladores usan fallback durante transición
 */

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn("canjes", "precio_al_canje", {
      type: Sequelize.INTEGER,
      allowNull: true,
      defaultValue: null,
      comment:
        "Precio en puntos al momento del canje. NULL para canjes históricos pre-migración.",
      after: "producto_id",
    });

    // Crear índice para optimizar queries que filtren por precio
    await queryInterface.addIndex("canjes", ["precio_al_canje"], {
      name: "idx_canjes_precio_al_canje",
    });

    console.log("✅ Columna precio_al_canje agregada exitosamente");
    console.log(
      "📝 Ejecuta el script backfill-precios-canjes.js para actualizar canjes históricos"
    );
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.removeIndex("canjes", "idx_canjes_precio_al_canje");
    await queryInterface.removeColumn("canjes", "precio_al_canje");
    console.log("✅ Rollback completado: columna precio_al_canje eliminada");
  },
};
