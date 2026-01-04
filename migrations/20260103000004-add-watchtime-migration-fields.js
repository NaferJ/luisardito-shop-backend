'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    // Agregar campos de migración de Watchtime a la tabla usuarios
    await queryInterface.addColumn('usuarios', 'botrix_watchtime_migrated', {
      type: Sequelize.BOOLEAN,
      allowNull: false,
      defaultValue: false,
      comment: 'Indica si el usuario ya migró su watchtime desde Botrix'
    });

    await queryInterface.addColumn('usuarios', 'botrix_watchtime_migrated_at', {
      type: Sequelize.DATE,
      allowNull: true,
      comment: 'Fecha en que se realizó la migración de watchtime'
    });

    await queryInterface.addColumn('usuarios', 'botrix_watchtime_minutes_migrated', {
      type: Sequelize.INTEGER,
      allowNull: true,
      comment: 'Minutos totales de watchtime migrados desde Botrix'
    });

    // Agregar campo de configuración a botrix_migration_config
    await queryInterface.addColumn('botrix_migration_config', 'watchtime_migration_enabled', {
      type: Sequelize.BOOLEAN,
      allowNull: false,
      defaultValue: true,
      comment: 'Habilita/deshabilita la migración de watchtime desde Botrix'
    });

    console.log('✅ Campos de migración de watchtime agregados');
  },

  async down(queryInterface, Sequelize) {
    // Remover campos en orden inverso
    await queryInterface.removeColumn('botrix_migration_config', 'watchtime_migration_enabled');
    await queryInterface.removeColumn('usuarios', 'botrix_watchtime_minutes_migrated');
    await queryInterface.removeColumn('usuarios', 'botrix_watchtime_migrated_at');
    await queryInterface.removeColumn('usuarios', 'botrix_watchtime_migrated');

    console.log('❌ Campos de migración de watchtime removidos');
  }
};

