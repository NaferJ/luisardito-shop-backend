'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('botrix_migration_config', {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER
      },
      config_key: {
        type: Sequelize.STRING,
        allowNull: false,
        unique: true
      },
      config_value: {
        type: Sequelize.TEXT,
        allowNull: true
      },
      description: {
        type: Sequelize.STRING,
        allowNull: true
      },
      created_at: {
        allowNull: false,
        type: Sequelize.DATE
      },
      updated_at: {
        allowNull: false,
        type: Sequelize.DATE
      }
    });

    // Insertar configuraciones por defecto
    await queryInterface.bulkInsert('botrix_migration_config', [
      {
        config_key: 'migration_enabled',
        config_value: 'true',
        description: 'Activar/desactivar migración automática de puntos Botrix',
        created_at: new Date(),
        updated_at: new Date()
      },
      {
        config_key: 'vip_points_enabled',
        config_value: 'false',
        description: 'Activar/desactivar puntos especiales para VIPs',
        created_at: new Date(),
        updated_at: new Date()
      },
      {
        config_key: 'vip_chat_points',
        config_value: '5',
        description: 'Puntos extra por mensaje de chat para VIPs',
        created_at: new Date(),
        updated_at: new Date()
      },
      {
        config_key: 'vip_follow_points',
        config_value: '100',
        description: 'Puntos extra por follow para VIPs',
        created_at: new Date(),
        updated_at: new Date()
      },
      {
        config_key: 'vip_sub_points',
        config_value: '300',
        description: 'Puntos extra por suscripción para VIPs',
        created_at: new Date(),
        updated_at: new Date()
      }
    ]);

    console.log('✅ Tabla botrix_migration_config creada con configuraciones por defecto');
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('botrix_migration_config');
    console.log('❌ Tabla botrix_migration_config eliminada');
  }
};
