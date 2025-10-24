'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // Crear tabla kick_points_config
    await queryInterface.createTable('kick_points_config', {
      id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true
      },
      config_key: {
        type: Sequelize.STRING,
        allowNull: false,
        unique: true,
        comment: 'Clave de configuración única'
      },
      config_value: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 0,
        comment: 'Valor de puntos'
      },
      description: {
        type: Sequelize.STRING,
        allowNull: true,
        comment: 'Descripción de la configuración'
      },
      enabled: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: true,
        comment: 'Si está habilitada esta configuración'
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false
      },
      updated_at: {
        type: Sequelize.DATE,
        allowNull: false
      }
    });

    // Crear tabla kick_broadcaster_tokens
    await queryInterface.createTable('kick_broadcaster_tokens', {
      id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true
      },
      kick_user_id: {
        type: Sequelize.STRING,
        allowNull: false,
        unique: true,
        comment: 'ID del broadcaster en Kick'
      },
      kick_username: {
        type: Sequelize.STRING,
        allowNull: false,
        comment: 'Username del broadcaster'
      },
      access_token: {
        type: Sequelize.TEXT,
        allowNull: false,
        comment: 'Token de acceso de Kick (encriptado en producción)'
      },
      refresh_token: {
        type: Sequelize.TEXT,
        allowNull: true,
        comment: 'Token de refresco (si está disponible)'
      },
      token_expires_at: {
        type: Sequelize.DATE,
        allowNull: true,
        comment: 'Cuándo expira el token'
      },
      scopes: {
        type: Sequelize.JSON,
        allowNull: true,
        comment: 'Scopes autorizados por el broadcaster'
      },
      is_active: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: true,
        comment: 'Si la conexión está activa'
      },
      auto_subscribed: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false,
        comment: 'Si se auto-suscribió a eventos exitosamente'
      },
      last_subscription_attempt: {
        type: Sequelize.DATE,
        allowNull: true,
        comment: 'Última vez que se intentó suscribir'
      },
      subscription_error: {
        type: Sequelize.TEXT,
        allowNull: true,
        comment: 'Error de la última suscripción (si hubo)'
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false
      },
      updated_at: {
        type: Sequelize.DATE,
        allowNull: false
      }
    });

    // Crear índices para kick_broadcaster_tokens
    await queryInterface.addIndex('kick_broadcaster_tokens', ['kick_user_id']);
    await queryInterface.addIndex('kick_broadcaster_tokens', ['is_active']);

    // Crear tabla kick_event_subscriptions
    await queryInterface.createTable('kick_event_subscriptions', {
      id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true
      },
      subscription_id: {
        type: Sequelize.STRING,
        allowNull: false,
        unique: true,
        comment: 'ID de la suscripción en Kick (ULID)'
      },
      app_id: {
        type: Sequelize.STRING,
        allowNull: true,
        comment: 'ID de la aplicación en Kick'
      },
      broadcaster_user_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        comment: 'ID del broadcaster (usuario de Kick)'
      },
      event_type: {
        type: Sequelize.STRING,
        allowNull: false,
        comment: 'Tipo de evento (ej: chat.message.sent, channel.followed)'
      },
      event_version: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 1,
        comment: 'Versión del evento'
      },
      method: {
        type: Sequelize.STRING,
        allowNull: false,
        defaultValue: 'webhook',
        comment: 'Método de entrega (webhook)'
      },
      status: {
        type: Sequelize.ENUM('active', 'inactive', 'error'),
        allowNull: false,
        defaultValue: 'active',
        comment: 'Estado de la suscripción'
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false
      },
      updated_at: {
        type: Sequelize.DATE,
        allowNull: false
      }
    });

    // Crear índices para kick_event_subscriptions
    await queryInterface.addIndex('kick_event_subscriptions', ['broadcaster_user_id']);
    await queryInterface.addIndex('kick_event_subscriptions', ['event_type']);
    await queryInterface.addIndex('kick_event_subscriptions', ['status']);
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('kick_event_subscriptions');
    await queryInterface.dropTable('kick_broadcaster_tokens');
    await queryInterface.dropTable('kick_points_config');
  }
};
