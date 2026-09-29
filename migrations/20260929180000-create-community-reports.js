"use strict";

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable("community_reports", {
      id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true,
      },
      reporter_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: "usuarios", key: "id" },
        onDelete: "CASCADE",
        comment: "User who filed the report",
      },
      target_type: {
        type: Sequelize.ENUM("post", "comment"),
        allowNull: false,
      },
      target_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        comment: "Post or comment id (polymorphic, no FK)",
      },
      reason: {
        type: Sequelize.ENUM(
          "spam",
          "harassment",
          "hate",
          "sexual",
          "violence",
          "other"
        ),
        allowNull: false,
      },
      details: {
        type: Sequelize.STRING(500),
        allowNull: true,
        comment: "Optional free-text context from the reporter",
      },
      status: {
        type: Sequelize.ENUM("open", "resolved", "dismissed"),
        allowNull: false,
        defaultValue: "open",
        comment: "Moderation state of the report",
      },
      resolved_by: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: { model: "usuarios", key: "id" },
        onDelete: "SET NULL",
        comment: "Moderator who closed the report",
      },
      resolved_at: {
        type: Sequelize.DATE,
        allowNull: true,
      },
      creado: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal("CURRENT_TIMESTAMP"),
      },
      actualizado: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal(
          "CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP"
        ),
      },
    });

    // One report per reporter per target keeps POST /report idempotent.
    await queryInterface.addIndex(
      "community_reports",
      ["reporter_id", "target_type", "target_id"],
      { unique: true, name: "community_reports_reporter_target_unique" }
    );
    await queryInterface.addIndex(
      "community_reports",
      ["target_type", "target_id", "status"],
      { name: "idx_community_reports_target_status" }
    );
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.dropTable("community_reports");
  },
};
