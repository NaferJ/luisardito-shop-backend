'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    // Agregar campos al modelo Usuario
    await queryInterface.addColumn('usuarios', 'discord_username', {
      type: Sequelize.STRING,
      allowNull: true,
      comment: 'Nombre de usuario en Discord'
    });

    await queryInterface.addColumn('usuarios', 'botrix_migrated', {
      type: Sequelize.BOOLEAN,
      allowNull: false,
      defaultValue: false,
      comment: 'Indica si ya migró los puntos de Botrix'
    });

    await queryInterface.addColumn('usuarios', 'botrix_migrated_at', {
      type: Sequelize.DATE,
      allowNull: true,
      comment: 'Fecha de migración de puntos de Botrix'
    });

    await queryInterface.addColumn('usuarios', 'botrix_points_migrated', {
      type: Sequelize.INTEGER,
      allowNull: true,
      comment: 'Cantidad de puntos migrados desde Botrix'
    });

    await queryInterface.addColumn('usuarios', 'is_vip', {
      type: Sequelize.BOOLEAN,
      allowNull: false,
      defaultValue: false,
      comment: 'Indica si el usuario es VIP'
    });

    await queryInterface.addColumn('usuarios', 'vip_granted_at', {
      type: Sequelize.DATE,
      allowNull: true,
      comment: 'Fecha cuando se otorgó el VIP'
    });

    await queryInterface.addColumn('usuarios', 'vip_expires_at', {
      type: Sequelize.DATE,
      allowNull: true,
      comment: 'Fecha de expiración del VIP (null = permanente)'
    });

    await queryInterface.addColumn('usuarios', 'vip_granted_by_canje_id', {
      type: Sequelize.INTEGER,
      allowNull: true,
      comment: 'ID del canje que otorgó el VIP'
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.removeColumn('usuarios', 'discord_username');
    await queryInterface.removeColumn('usuarios', 'botrix_migrated');
    await queryInterface.removeColumn('usuarios', 'botrix_migrated_at');
    await queryInterface.removeColumn('usuarios', 'botrix_points_migrated');
    await queryInterface.removeColumn('usuarios', 'is_vip');
    await queryInterface.removeColumn('usuarios', 'vip_granted_at');
    await queryInterface.removeColumn('usuarios', 'vip_expires_at');
    await queryInterface.removeColumn('usuarios', 'vip_granted_by_canje_id');
  }
};
