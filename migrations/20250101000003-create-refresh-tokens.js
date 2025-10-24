'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // Crear tabla refresh_tokens
    await queryInterface.createTable('refresh_tokens', {
      id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true
      },
      usuario_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        comment: 'ID del usuario en nuestra BD',
        references: {
          model: 'usuarios',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
      },
      token: {
        type: Sequelize.STRING(500),
        allowNull: false,
        unique: true,
        comment: 'Refresh token (UUID o JWT)'
      },
      expires_at: {
        type: Sequelize.DATE,
        allowNull: false,
        comment: 'Fecha de expiración del refresh token'
      },
      is_revoked: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false,
        comment: 'Si el token fue revocado (logout)'
      },
      revoked_at: {
        type: Sequelize.DATE,
        allowNull: true,
        comment: 'Cuándo se revocó el token'
      },
      ip_address: {
        type: Sequelize.STRING,
        allowNull: true,
        comment: 'IP desde donde se creó'
      },
      user_agent: {
        type: Sequelize.TEXT,
        allowNull: true,
        comment: 'User agent del navegador'
      },
      replaced_by_token: {
        type: Sequelize.STRING(500),
        allowNull: true,
        comment: 'Token que reemplazó a este (para rotación)'
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

    // Crear índices para refresh_tokens
    await queryInterface.addIndex('refresh_tokens', ['token']);
    await queryInterface.addIndex('refresh_tokens', ['usuario_id']);
    await queryInterface.addIndex('refresh_tokens', ['expires_at']);
    await queryInterface.addIndex('refresh_tokens', ['is_revoked']);
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('refresh_tokens');
  }
};
