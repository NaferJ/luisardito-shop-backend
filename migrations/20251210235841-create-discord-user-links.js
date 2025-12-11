'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up (queryInterface, Sequelize) {
    await queryInterface.createTable('discord_user_links', {
      id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true,
        allowNull: false
      },
      discord_user_id: {
        type: Sequelize.STRING(255),
        allowNull: false,
        unique: true,
        comment: 'ID único del usuario en Discord'
      },
      discord_username: {
        type: Sequelize.STRING(255),
        allowNull: true,
        comment: 'Username de Discord (puede cambiar)'
      },
      discord_discriminator: {
        type: Sequelize.STRING(10),
        allowNull: true,
        comment: 'Discriminator de Discord (ej: #1234)'
      },
      discord_avatar: {
        type: Sequelize.STRING(255),
        allowNull: true,
        comment: 'Hash del avatar de Discord'
      },
      tienda_user_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: 'usuarios',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
        comment: 'ID del usuario en la tienda'
      },
      kick_user_id: {
        type: Sequelize.STRING(255),
        allowNull: true,
        comment: 'ID del usuario en Kick (si está vinculado)'
      },
      access_token: {
        type: Sequelize.TEXT,
        allowNull: true,
        comment: 'Access token de Discord'
      },
      refresh_token: {
        type: Sequelize.TEXT,
        allowNull: true,
        comment: 'Refresh token de Discord'
      },
      token_expires_at: {
        type: Sequelize.DATE,
        allowNull: true,
        comment: 'Fecha de expiración del access token'
      },
      linked_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
        comment: 'Fecha de vinculación'
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      },
      updated_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP')
      }
    });

    // Crear índices
    await queryInterface.addIndex('discord_user_links', ['discord_user_id'], {
      unique: true,
      name: 'discord_user_links_discord_user_id_unique'
    });

    await queryInterface.addIndex('discord_user_links', ['tienda_user_id'], {
      name: 'discord_user_links_tienda_user_id_index'
    });

    await queryInterface.addIndex('discord_user_links', ['kick_user_id'], {
      name: 'discord_user_links_kick_user_id_index'
    });
  },

  async down (queryInterface, Sequelize) {
    await queryInterface.dropTable('discord_user_links');
  }
};
