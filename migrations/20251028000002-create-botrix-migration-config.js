'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('botrix_migration_config', {
      id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true
      },
      migration_enabled: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: true,
        comment: 'Activar/desactivar la migración automática de puntos de Botrix'
      },
      vip_points_enabled: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false,
        comment: 'Activar recompensas especiales para VIPs'
      },
      vip_chat_points: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 5,
        comment: 'Puntos por mensaje de chat para VIPs'
      },
      vip_follow_points: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 100,
        comment: 'Puntos por follow para VIPs'
      },
      vip_sub_points: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 300,
        comment: 'Puntos por suscripción para VIPs'
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

    // Insertar configuración por defecto
    await queryInterface.bulkInsert('botrix_migration_config', [{
      migration_enabled: true,
      vip_points_enabled: false,
      vip_chat_points: 5,
      vip_follow_points: 100,
      vip_sub_points: 300,
      created_at: new Date(),
      updated_at: new Date()
    }]);
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('botrix_migration_config');
  }
};
