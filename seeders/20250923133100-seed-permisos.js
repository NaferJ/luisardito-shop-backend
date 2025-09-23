"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    const permisos = [
      { id: 1, nombre: 'crear_producto', descripcion: 'Permite crear productos' },
      { id: 2, nombre: 'editar_producto', descripcion: 'Permite editar productos' },
      { id: 3, nombre: 'eliminar_producto', descripcion: 'Permite eliminar productos' },
      { id: 4, nombre: 'canjear_productos', descripcion: 'Permite canjear productos' },
      { id: 5, nombre: 'ver_canjes', descripcion: 'Permite listar canjes' },
      { id: 6, nombre: 'gestionar_usuarios', descripcion: 'Permite actualizar estado de canjes' },
      { id: 7, nombre: 'ver_usuarios', descripcion: 'Ver lista de todos los usuarios registrados' },
      { id: 8, nombre: 'editar_puntos', descripcion: 'Modificar puntos de cualquier usuario' },
      { id: 9, nombre: 'ver_historial_puntos', descripcion: 'Ver historial de puntos de usuarios' },
      { id: 10, nombre: 'gestionar_canjes', descripcion: 'Gestionar estados de canjes (pendiente/entregado/cancelado)' }
    ];

    await queryInterface.bulkInsert('permisos', permisos, { ignoreDuplicates: true });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.bulkDelete('permisos', { id: [1,2,3,4,5,6,7,8,9,10] }, {});
  }
};
