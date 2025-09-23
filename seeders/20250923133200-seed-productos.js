"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    // Disabled by request: product seed data removed
    console.log('Seed disabled: productos (no data inserted)');
  },

  async down(queryInterface, Sequelize) {
    // Nothing to revert since no data seeded
  }
};
