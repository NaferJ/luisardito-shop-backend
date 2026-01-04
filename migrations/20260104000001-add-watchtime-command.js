'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    // Agregar comando !watchtime a la tabla kick_bot_commands
    await queryInterface.sequelize.query(`
      INSERT INTO kick_bot_commands (
        command,
        description,
        response_message,
        command_type,
        dynamic_handler,
        requires_permission,
        cooldown_seconds,
        enabled,
        created_at,
        updated_at
      ) VALUES (
        'watchtime',
        'Muestra el watchtime (tiempo viendo el stream) del usuario. Uso: !watchtime [@usuario]',
        '@{target_user} ha pasado {watchtime} viendo el stream',
        'dynamic',
        'watchtime_handler',
        0,
        5,
        1,
        NOW(),
        NOW()
      )
      ON DUPLICATE KEY UPDATE
        description = 'Muestra el watchtime (tiempo viendo el stream) del usuario. Uso: !watchtime [@usuario]',
        response_message = '@{target_user} ha pasado {watchtime} viendo el stream',
        command_type = 'dynamic',
        dynamic_handler = 'watchtime_handler',
        cooldown_seconds = 5,
        enabled = 1,
        updated_at = NOW()
    `, { raw: true });

    console.log('✅ Comando !watchtime agregado a la base de datos');
  },

  async down(queryInterface, Sequelize) {
    // Remover comando !watchtime de la tabla kick_bot_commands
    await queryInterface.sequelize.query(`
      DELETE FROM kick_bot_commands WHERE command = 'watchtime'
    `, { raw: true });

    console.log('❌ Comando !watchtime removido de la base de datos');
  }
};

