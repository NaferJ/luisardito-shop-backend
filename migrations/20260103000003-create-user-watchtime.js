'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('user_watchtime', {
      id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true,
        allowNull: false
      },
      usuario_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: 'usuarios',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
        comment: 'ID del usuario'
      },
      kick_user_id: {
        type: Sequelize.STRING,
        allowNull: true,
        comment: 'ID de usuario en Kick (para auditoría)'
      },
      total_watchtime_minutes: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 0,
        comment: 'Total de minutos de watchtime acumulados'
      },
      message_count: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 0,
        comment: 'Total de mensajes registrados'
      },
      first_message_date: {
        type: Sequelize.DATE,
        allowNull: true,
        comment: 'Fecha del primer mensaje registrado'
      },
      last_message_at: {
        type: Sequelize.DATE,
        allowNull: true,
        comment: 'Fecha del último mensaje registrado'
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.fn('NOW'),
        comment: 'Fecha de creación del registro'
      },
      updated_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.fn('NOW'),
        onUpdate: Sequelize.fn('NOW'),
        comment: 'Última actualización'
      }
    });

    // Crear índices para mejorar performance
    await queryInterface.addIndex('user_watchtime', ['usuario_id'], { unique: true });
    await queryInterface.addIndex('user_watchtime', ['kick_user_id']);
    await queryInterface.addIndex('user_watchtime', ['total_watchtime_minutes'], { order: 'DESC' });

    console.log('✅ Tabla user_watchtime creada exitosamente');
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('user_watchtime');
    console.log('❌ Tabla user_watchtime eliminada');
  }
};

