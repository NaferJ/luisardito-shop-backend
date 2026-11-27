"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.changeColumn("kick_webhook_events", "payload", {
      type: Sequelize.JSON,
      allowNull: true,
      comment: "Event content (cleared after successful processing)",
    });

    await queryInterface.sequelize.query(
      "UPDATE kick_webhook_events SET payload = NULL WHERE processed = 1"
    );
  },

  async down(queryInterface, Sequelize) {
    // Cleared payloads cannot be restored. Use an empty JSON object so the
    // original NOT NULL constraint can be re-applied.
    await queryInterface.sequelize.query(
      "UPDATE kick_webhook_events SET payload = JSON_OBJECT() WHERE payload IS NULL"
    );

    await queryInterface.changeColumn("kick_webhook_events", "payload", {
      type: Sequelize.JSON,
      allowNull: false,
      comment: "Event content",
    });
  },
};
