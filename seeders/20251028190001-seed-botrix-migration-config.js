"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    const defaultConfig = {
      id: 1,
      migration_enabled: true,
      vip_points_enabled: false,
      vip_chat_points: 5,
      vip_follow_points: 100,
      vip_sub_points: 300,
      created_at: new Date(),
      updated_at: new Date()
    };

    // Usar ignoreDuplicates para evitar errores si ya existe
    await queryInterface.bulkInsert('botrix_migration_config', [defaultConfig], {
      ignoreDuplicates: true
    });

    console.log('✅ Seeder: Configuración de migración Botrix inicializada');
  },

  async down(queryInterface, Sequelize) {
    // Eliminar la configuración
    await queryInterface.bulkDelete('botrix_migration_config', {
      id: 1
    }, {});

    console.log('❌ Seeder: Configuración de migración Botrix eliminada');
  }
};
