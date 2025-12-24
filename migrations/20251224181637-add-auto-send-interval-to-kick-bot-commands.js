'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up (queryInterface, Sequelize) {
    await queryInterface.addColumn('kick_bot_commands', 'auto_send_interval_seconds', {
      type: Sequelize.INTEGER,
      allowNull: false,
      defaultValue: 0,
      comment: "Intervalo en segundos para envío automático (0 = no enviar automáticamente)"
    });
  },

  async down (queryInterface, Sequelize) {
    await queryInterface.removeColumn('kick_bot_commands', 'auto_send_interval_seconds');
  }
};
