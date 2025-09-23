"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    const productos = [
      {
        id: 999,
        nombre: 'Producto Plantilla',
        descripcion: 'Producto de prueba (plantilla) para desarrollo',
        precio: 0,
        stock: 0,
        estado: 'borrador',
        imagen_url: null,
        creado: new Date(),
        actualizado: new Date()
      }
    ];

    await queryInterface.bulkInsert('productos', productos, { ignoreDuplicates: true });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.bulkDelete('productos', { id: [999] }, {});
  }
};
