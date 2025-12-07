"use strict";

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable("kick_rewards", {
      id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true,
      },
      kick_reward_id: {
        type: Sequelize.STRING,
        allowNull: false,
        unique: true,
        comment: "ID de la recompensa en Kick (ULID)",
      },
      title: {
        type: Sequelize.STRING(50),
        allowNull: false,
        comment: "Título de la recompensa en Kick",
      },
      description: {
        type: Sequelize.STRING(200),
        allowNull: true,
        comment: "Descripción de la recompensa",
      },
      cost: {
        type: Sequelize.INTEGER,
        allowNull: false,
        comment: "Costo en puntos de Kick",
      },
      background_color: {
        type: Sequelize.STRING(7),
        allowNull: true,
        defaultValue: "#00e701",
        comment: "Color de fondo en formato hex",
      },
      puntos_a_otorgar: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 0,
        comment: "Puntos a otorgar en nuestra app cuando se canjee",
      },
      is_enabled: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: true,
        comment: "Si está habilitada en Kick",
      },
      is_paused: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false,
        comment: "Si está pausada en Kick",
      },
      is_user_input_required: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false,
        comment: "Si requiere input del usuario",
      },
      should_redemptions_skip_request_queue: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false,
        comment: "Si los canjeos saltan la cola de solicitudes",
      },
      auto_accept: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: true,
        comment: "Si se acepta automáticamente al canjear",
      },
      total_redemptions: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 0,
        comment: "Total de veces que se ha canjeado",
      },
      last_synced_at: {
        type: Sequelize.DATE,
        allowNull: true,
        comment: "Última vez que se sincronizó con Kick",
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal("CURRENT_TIMESTAMP"),
      },
      updated_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal("CURRENT_TIMESTAMP"),
      },
    });

    // Índices para optimizar consultas
    await queryInterface.addIndex("kick_rewards", ["kick_reward_id"], {
      unique: true,
      name: "idx_kick_rewards_kick_reward_id",
    });

    await queryInterface.addIndex("kick_rewards", ["is_enabled"], {
      name: "idx_kick_rewards_is_enabled",
    });

    await queryInterface.addIndex("kick_rewards", ["title"], {
      name: "idx_kick_rewards_title",
    });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.dropTable("kick_rewards");
  },
};
