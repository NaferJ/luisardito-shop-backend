"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    const defaultConfigs = [
      {
        id: 1,
        config_key: 'chat_points_regular',
        config_value: 10,
        description: 'Puntos por mensaje en chat (usuarios regulares)',
        enabled: true,
        created_at: new Date(),
        updated_at: new Date()
      },
      {
        id: 2,
        config_key: 'chat_points_subscriber',
        config_value: 20,
        description: 'Puntos por mensaje en chat (suscriptores)',
        enabled: true,
        created_at: new Date(),
        updated_at: new Date()
      },
      {
        id: 3,
        config_key: 'chat_points_vip',
        config_value: 30,
        description: 'Puntos por mensaje en chat (usuarios VIP)',
        enabled: true,
        created_at: new Date(),
        updated_at: new Date()
      },
      {
        id: 4,
        config_key: 'follow_points',
        config_value: 50,
        description: 'Puntos por seguir el canal (primera vez)',
        enabled: true,
        created_at: new Date(),
        updated_at: new Date()
      },
      {
        id: 5,
        config_key: 'subscription_new_points',
        config_value: 500,
        description: 'Puntos por nueva suscripción',
        enabled: true,
        created_at: new Date(),
        updated_at: new Date()
      },
      {
        id: 6,
        config_key: 'subscription_renewal_points',
        config_value: 300,
        description: 'Puntos por renovación de suscripción',
        enabled: true,
        created_at: new Date(),
        updated_at: new Date()
      },
      {
        id: 7,
        config_key: 'gift_given_points',
        config_value: 100,
        description: 'Puntos por cada suscripción regalada',
        enabled: true,
        created_at: new Date(),
        updated_at: new Date()
      },
      {
        id: 8,
        config_key: 'gift_received_points',
        config_value: 400,
        description: 'Puntos por recibir una suscripción regalada',
        enabled: true,
        created_at: new Date(),
        updated_at: new Date()
      },
      {
        id: 9,
        config_key: 'kicks_gifted_multiplier',
        config_value: 2,
        description: 'Multiplicador de puntos por kicks regalados',
        enabled: true,
        created_at: new Date(),
        updated_at: new Date()
      }
    ];

    // Usar ignoreDuplicates para evitar errores si ya existen
    await queryInterface.bulkInsert('kick_points_config', defaultConfigs, {
      ignoreDuplicates: true
    });

    console.log('✅ Seeder: Configuración de puntos Kick inicializada');
  },

  async down(queryInterface, Sequelize) {
    // Eliminar solo las configuraciones que insertamos
    await queryInterface.bulkDelete('kick_points_config', {
      id: [1, 2, 3, 4, 5, 6, 7, 8]
    }, {});

    console.log('❌ Seeder: Configuración de puntos Kick eliminada');
  }
};
