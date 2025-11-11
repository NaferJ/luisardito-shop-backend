'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('kick_user_tracking', 'total_kicks_gifted', {
      type: Sequelize.INTEGER,
      allowNull: false,
      defaultValue: 0,
      comment: 'Cantidad total de kicks regalados por el usuario'
    });

    console.log('✅ Columna total_kicks_gifted agregada a kick_user_tracking');
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.removeColumn('kick_user_tracking', 'total_kicks_gifted');
    console.log('❌ Columna total_kicks_gifted eliminada de kick_user_tracking');
  }
};

