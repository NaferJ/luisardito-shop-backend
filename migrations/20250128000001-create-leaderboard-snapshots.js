"use strict";

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable("leaderboard_snapshots", {
      id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true,
      },
      usuario_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        comment: "ID del usuario en el ranking",
        references: {
          model: "usuarios",
          key: "id",
        },
        onUpdate: "CASCADE",
        onDelete: "CASCADE",
      },
      nickname: {
        type: Sequelize.STRING,
        allowNull: false,
        comment: "Nickname del usuario en ese momento",
      },
      puntos: {
        type: Sequelize.INTEGER,
        allowNull: false,
        comment: "Puntos totales del usuario",
      },
      position: {
        type: Sequelize.INTEGER,
        allowNull: false,
        comment: "Posición en el ranking (1 = primero)",
      },
      snapshot_date: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal("CURRENT_TIMESTAMP"),
        comment: "Fecha y hora del snapshot",
      },
      is_vip: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false,
        comment: "Si el usuario era VIP en ese momento",
      },
      is_subscriber: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false,
        comment: "Si el usuario era suscriptor en ese momento",
      },
      kick_data: {
        type: Sequelize.JSON,
        allowNull: true,
        comment: "Datos adicionales de Kick (avatar, etc.)",
      },
      creado: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal("CURRENT_TIMESTAMP"),
      },
    });

    // Índices para optimizar consultas
    await queryInterface.addIndex(
      "leaderboard_snapshots",
      ["usuario_id", "snapshot_date"],
      {
        name: "idx_leaderboard_usuario_date",
      },
    );

    await queryInterface.addIndex("leaderboard_snapshots", ["snapshot_date"], {
      name: "idx_leaderboard_snapshot_date",
    });

    await queryInterface.addIndex(
      "leaderboard_snapshots",
      ["position", "snapshot_date"],
      {
        name: "idx_leaderboard_position_date",
      },
    );
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.dropTable("leaderboard_snapshots");
  },
};
