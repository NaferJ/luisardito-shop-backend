"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    // Disabled by request: historial_puntos seed data removed
    console.log('Seed disabled: historial_puntos (no data inserted)');
  },

  async down(queryInterface, Sequelize) {
    // Nothing to revert since no data seeded
  }
};
