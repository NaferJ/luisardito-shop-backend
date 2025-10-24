'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // Crear tabla kick_webhook_events
    await queryInterface.createTable('kick_webhook_events', {
      id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true
      },
      message_id: {
        type: Sequelize.STRING,
        allowNull: false,
        unique: true,
        comment: 'ID único del mensaje (ULID) - clave de idempotencia'
      },
      subscription_id: {
        type: Sequelize.STRING,
        allowNull: true,
        comment: 'ID de la suscripción asociada al evento'
      },
      event_type: {
        type: Sequelize.STRING,
        allowNull: false,
        comment: 'Tipo de evento (ej: chat.message.sent)'
      },
      event_version: {
        type: Sequelize.STRING,
        allowNull: false,
        comment: 'Versión del evento'
      },
      message_timestamp: {
        type: Sequelize.DATE,
        allowNull: false,
        comment: 'Timestamp de cuándo se envió el mensaje'
      },
      payload: {
        type: Sequelize.JSON,
        allowNull: false,
        comment: 'Contenido del evento'
      },
      processed: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false,
        comment: 'Indica si el evento ha sido procesado'
      },
      processed_at: {
        type: Sequelize.DATE,
        allowNull: true,
        comment: 'Timestamp de cuándo se procesó el evento'
      },
      received_at: {
        type: Sequelize.DATE,
        allowNull: false
      },
      updated_at: {
        type: Sequelize.DATE,
        allowNull: false
      }
    });

    // Crear índices para kick_webhook_events
    await queryInterface.addIndex('kick_webhook_events', ['message_id']);
    await queryInterface.addIndex('kick_webhook_events', ['event_type']);
    await queryInterface.addIndex('kick_webhook_events', ['processed']);
    await queryInterface.addIndex('kick_webhook_events', ['message_timestamp']);

    // Crear tabla kick_user_tracking
    await queryInterface.createTable('kick_user_tracking', {
      id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true
      },
      kick_user_id: {
        type: Sequelize.STRING,
        allowNull: false,
        unique: true,
        comment: 'ID del usuario de Kick'
      },
      kick_username: {
        type: Sequelize.STRING,
        allowNull: false,
        comment: 'Username del usuario de Kick'
      },
      has_followed: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false,
        comment: 'Si ya siguió al canal alguna vez'
      },
      first_follow_at: {
        type: Sequelize.DATE,
        allowNull: true,
        comment: 'Primera vez que siguió al canal'
      },
      follow_points_awarded: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false,
        comment: 'Si ya se le otorgaron puntos por follow'
      },
      is_subscribed: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false,
        comment: 'Si está actualmente suscrito'
      },
      subscription_expires_at: {
        type: Sequelize.DATE,
        allowNull: true,
        comment: 'Cuándo expira su suscripción actual'
      },
      subscription_duration_months: {
        type: Sequelize.INTEGER,
        allowNull: true,
        comment: 'Duración de la suscripción en meses'
      },
      total_subscriptions: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 0,
        comment: 'Cantidad total de suscripciones (new + renewal)'
      },
      total_gifts_received: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 0,
        comment: 'Cantidad de subs regaladas recibidas'
      },
      total_gifts_given: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 0,
        comment: 'Cantidad de subs que ha regalado'
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

    // Crear índices para kick_user_tracking
    await queryInterface.addIndex('kick_user_tracking', ['kick_user_id']);
    await queryInterface.addIndex('kick_user_tracking', ['kick_username']);
    await queryInterface.addIndex('kick_user_tracking', ['is_subscribed']);

    // Crear tabla kick_chat_cooldowns
    await queryInterface.createTable('kick_chat_cooldowns', {
      id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true
      },
      kick_user_id: {
        type: Sequelize.STRING,
        allowNull: false,
        comment: 'ID del usuario de Kick'
      },
      kick_username: {
        type: Sequelize.STRING,
        allowNull: false,
        comment: 'Username del usuario de Kick'
      },
      last_message_at: {
        type: Sequelize.DATE,
        allowNull: false,
        comment: 'Última vez que escribió y recibió puntos'
      },
      cooldown_expires_at: {
        type: Sequelize.DATE,
        allowNull: false,
        comment: 'Cuándo expira el cooldown (5 min después)'
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

    // Crear índices para kick_chat_cooldowns
    await queryInterface.addIndex('kick_chat_cooldowns', ['kick_user_id']);
    await queryInterface.addIndex('kick_chat_cooldowns', ['cooldown_expires_at']);
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('kick_chat_cooldowns');
    await queryInterface.dropTable('kick_user_tracking');
    await queryInterface.dropTable('kick_webhook_events');
  }
};
