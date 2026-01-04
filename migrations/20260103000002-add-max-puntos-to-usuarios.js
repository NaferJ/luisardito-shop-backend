'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    // Agregar columna max_puntos a la tabla usuarios
    await queryInterface.addColumn('usuarios', 'max_puntos', {
      type: Sequelize.INTEGER,
      allowNull: false,
      defaultValue: 0,
      comment: 'Máximo de puntos que ha alcanzado el usuario en su historial'
    });

    console.log('✅ Columna max_puntos agregada a la tabla usuarios');
  },

  async down(queryInterface, Sequelize) {
    // Remover la columna max_puntos
    await queryInterface.removeColumn('usuarios', 'max_puntos');

    console.log('❌ Columna max_puntos removida de la tabla usuarios');
  }
};

