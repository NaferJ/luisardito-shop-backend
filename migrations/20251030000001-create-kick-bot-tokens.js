'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // Crear tabla kick_bot_tokens
    await queryInterface.createTable('kick_bot_tokens', {
      id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true
      },
      kick_user_id: {
        type: Sequelize.STRING,
        allowNull: false,
        unique: true,
        comment: 'ID del usuario bot en Kick'
      },
      kick_username: {
        type: Sequelize.STRING,
        allowNull: false,
        comment: 'Username del bot en Kick'
      },
      access_token: {
        type: Sequelize.TEXT,
        allowNull: false,
        comment: 'Token de acceso del bot'
      },
      refresh_token: {
        type: Sequelize.TEXT,
        allowNull: true,
        comment: 'Token de refresco del bot'
      },
      token_expires_at: {
        type: Sequelize.DATE,
        allowNull: false,
        comment: 'Fecha de expiración del token'
      },
      is_active: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: true,
        comment: 'Si el token está activo'
      },
      scopes: {
        type: Sequelize.JSON,
        allowNull: true,
        comment: 'Scopes autorizados para el bot'
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      },
      updated_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      }
    });

    // Crear índices para kick_bot_tokens
    await queryInterface.addIndex('kick_bot_tokens', ['kick_user_id'], {
      name: 'idx_kick_bot_tokens_user_id'
    });
    await queryInterface.addIndex('kick_bot_tokens', ['is_active'], {
      name: 'idx_kick_bot_tokens_is_active'
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('kick_bot_tokens');
  }
};
