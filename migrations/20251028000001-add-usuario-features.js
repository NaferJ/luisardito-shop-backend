'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    // Agregar campos VIP a la tabla usuarios
    await queryInterface.addColumn('usuarios', 'is_vip', {
      type: Sequelize.BOOLEAN,
      allowNull: false,
      defaultValue: false
    });

    await queryInterface.addColumn('usuarios', 'vip_granted_at', {
      type: Sequelize.DATE,
      allowNull: true
    });

    await queryInterface.addColumn('usuarios', 'vip_expires_at', {
      type: Sequelize.DATE,
      allowNull: true
    });

    await queryInterface.addColumn('usuarios', 'vip_granted_by_canje_id', {
      type: Sequelize.INTEGER,
      allowNull: true
    });

    // Agregar campos de migración Botrix a la tabla usuarios
    await queryInterface.addColumn('usuarios', 'botrix_migrated', {
      type: Sequelize.BOOLEAN,
      allowNull: false,
      defaultValue: false
    });

    await queryInterface.addColumn('usuarios', 'botrix_migrated_at', {
      type: Sequelize.DATE,
      allowNull: true
    });

    await queryInterface.addColumn('usuarios', 'botrix_points_migrated', {
      type: Sequelize.INTEGER,
      allowNull: true
    });

    // Agregar campo Discord a la tabla usuarios
    await queryInterface.addColumn('usuarios', 'discord_username', {
      type: Sequelize.STRING,
      allowNull: true
    });

    console.log('✅ Campos VIP, Botrix y Discord agregados a la tabla usuarios');
  },

  async down(queryInterface, Sequelize) {
    // Remover campos en orden inverso
    await queryInterface.removeColumn('usuarios', 'discord_username');
    await queryInterface.removeColumn('usuarios', 'botrix_points_migrated');
    await queryInterface.removeColumn('usuarios', 'botrix_migrated_at');
    await queryInterface.removeColumn('usuarios', 'botrix_migrated');
    await queryInterface.removeColumn('usuarios', 'vip_granted_by_canje_id');
    await queryInterface.removeColumn('usuarios', 'vip_expires_at');
    await queryInterface.removeColumn('usuarios', 'vip_granted_at');
    await queryInterface.removeColumn('usuarios', 'is_vip');

    console.log('❌ Campos VIP, Botrix y Discord removidos de la tabla usuarios');
  }
};
