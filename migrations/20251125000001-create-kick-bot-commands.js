"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable("kick_bot_commands", {
      id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true,
        allowNull: false,
      },
      command: {
        type: Sequelize.STRING(50),
        allowNull: false,
        unique: true,
        comment: "Nombre del comando sin el símbolo ! (ej: tienda, puntos)",
      },
      aliases: {
        type: Sequelize.JSON,
        allowNull: true,
        defaultValue: null,
        comment: 'Array de aliases del comando (ej: ["shop"] para tienda)',
      },
      response_message: {
        type: Sequelize.TEXT,
        allowNull: false,
        comment:
          "Mensaje de respuesta. Soporta variables: {username}, {channel}, {args}, {target_user}, {points}",
      },
      description: {
        type: Sequelize.STRING(255),
        allowNull: true,
        comment: "Descripción del comando para el administrador",
      },
      command_type: {
        type: Sequelize.STRING(20),
        allowNull: false,
        defaultValue: "simple",
        comment:
          "simple: respuesta estática, dynamic: lógica especial programada",
      },
      dynamic_handler: {
        type: Sequelize.STRING(100),
        allowNull: true,
        comment:
          "Nombre del handler especial para comandos dynamic (ej: puntos_handler, tienda_handler)",
      },
      enabled: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: true,
        comment:
          "Si el comando está habilitado (false = borrador/deshabilitado)",
      },
      requires_permission: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false,
        comment: "Si requiere permisos especiales (moderador, admin, etc)",
      },
      permission_level: {
        type: Sequelize.STRING(20),
        allowNull: true,
        defaultValue: "viewer",
        comment: "Nivel de permiso requerido para usar el comando",
      },
      cooldown_seconds: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 0,
        comment: "Cooldown en segundos para este comando (0 = sin cooldown)",
      },
      usage_count: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 0,
        comment: "Contador de veces que se ha usado el comando",
      },
      last_used_at: {
        type: Sequelize.DATE,
        allowNull: true,
        comment: "Última vez que se usó el comando",
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

    // Índices para mejorar el rendimiento
    await queryInterface.addIndex("kick_bot_commands", ["command"], {
      name: "idx_kick_bot_commands_command",
    });

    await queryInterface.addIndex("kick_bot_commands", ["enabled"], {
      name: "idx_kick_bot_commands_enabled",
    });

    await queryInterface.addIndex("kick_bot_commands", ["command_type"], {
      name: "idx_kick_bot_commands_type",
    });

    // Insertar los comandos existentes (migración de hardcoded a DB)
    await queryInterface.bulkInsert("kick_bot_commands", [
      {
        command: "tienda",
        aliases: JSON.stringify(["shop"]),
        response_message:
          "{channel} tienda del canal: https://shop.luisardito.com/",
        description: "Muestra el enlace de la tienda del canal",
        command_type: "simple",
        dynamic_handler: null,
        enabled: true,
        requires_permission: false,
        permission_level: "viewer",
        cooldown_seconds: 0,
        usage_count: 0,
        last_used_at: null,
        created_at: new Date(),
        updated_at: new Date(),
      },
      {
        command: "puntos",
        aliases: JSON.stringify([]),
        response_message: "{target_user} tiene {points} puntos.",
        description: "Muestra los puntos del usuario. Uso: !puntos [@usuario]",
        command_type: "dynamic",
        dynamic_handler: "puntos_handler",
        enabled: true,
        requires_permission: false,
        permission_level: "viewer",
        cooldown_seconds: 3,
        usage_count: 0,
        last_used_at: null,
        created_at: new Date(),
        updated_at: new Date(),
      },
    ]);
  },

  async down(queryInterface, Sequelize) {
    // Eliminar índices
    await queryInterface.removeIndex(
      "kick_bot_commands",
      "idx_kick_bot_commands_command",
    );
    await queryInterface.removeIndex(
      "kick_bot_commands",
      "idx_kick_bot_commands_enabled",
    );
    await queryInterface.removeIndex(
      "kick_bot_commands",
      "idx_kick_bot_commands_type",
    );

    // Eliminar tabla
    await queryInterface.dropTable("kick_bot_commands");
  },
};
