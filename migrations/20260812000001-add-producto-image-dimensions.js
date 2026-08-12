"use strict";

/**
 * Migration: Add imagen_width / imagen_height columns to productos.
 *
 * Purpose: Store the real pixel dimensions of each product image so the
 * frontend can render true masonry cards (aspect-ratio per image) instead of
 * cycling fake ratios by index.
 *
 * Zero-downtime strategy:
 * - Both columns are nullable and default to NULL.
 * - Existing rows keep working; the frontend falls back to a default ratio
 *   when dimensions are absent.
 * - Dimensions are populated on product create/edit (see productos controller).
 */

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn("productos", "imagen_width", {
      type: Sequelize.INTEGER,
      allowNull: true,
      defaultValue: null,
      comment:
        "Original pixel width of the product image. NULL until populated.",
      after: "imagen_url",
    });

    await queryInterface.addColumn("productos", "imagen_height", {
      type: Sequelize.INTEGER,
      allowNull: true,
      defaultValue: null,
      comment:
        "Original pixel height of the product image. NULL until populated.",
      after: "imagen_width",
    });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn("productos", "imagen_height");
    await queryInterface.removeColumn("productos", "imagen_width");
  },
};
