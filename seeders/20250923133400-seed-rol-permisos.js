"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    const rolPermisos = [
      { id: 37, rol_id: 1, permiso_id: 4 },
      { id: 36, rol_id: 1, permiso_id: 5 },
      { id: 38, rol_id: 1, permiso_id: 9 },
      { id: 8,  rol_id: 2, permiso_id: 4 },
      { id: 9,  rol_id: 2, permiso_id: 5 },
      { id: 15, rol_id: 3, permiso_id: 7 },
      { id: 12, rol_id: 3, permiso_id: 8 },
      { id: 14, rol_id: 3, permiso_id: 9 },
      { id: 13, rol_id: 3, permiso_id: 10 },
      { id: 2,  rol_id: 4, permiso_id: 1 },
      { id: 3,  rol_id: 4, permiso_id: 2 },
      { id: 4,  rol_id: 4, permiso_id: 3 },
      { id: 1,  rol_id: 4, permiso_id: 4 },
      { id: 6,  rol_id: 4, permiso_id: 5 },
      { id: 5,  rol_id: 4, permiso_id: 6 },
      { id: 22, rol_id: 4, permiso_id: 7 },
      { id: 19, rol_id: 4, permiso_id: 8 },
      { id: 21, rol_id: 4, permiso_id: 9 },
      { id: 20, rol_id: 4, permiso_id: 10 },
      { id: 27, rol_id: 5, permiso_id: 1 },
      { id: 28, rol_id: 5, permiso_id: 2 },
      { id: 30, rol_id: 5, permiso_id: 3 },
      { id: 26, rol_id: 5, permiso_id: 4 },
      { id: 33, rol_id: 5, permiso_id: 5 },
      { id: 32, rol_id: 5, permiso_id: 6 },
      { id: 35, rol_id: 5, permiso_id: 7 },
      { id: 29, rol_id: 5, permiso_id: 8 },
      { id: 34, rol_id: 5, permiso_id: 9 },
      { id: 31, rol_id: 5, permiso_id: 10 }
    ];

    await queryInterface.bulkInsert('rol_permisos', rolPermisos, { ignoreDuplicates: true });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.bulkDelete('rol_permisos', {
      id: [1,2,3,4,5,6,8,9,12,13,14,15,19,20,21,22,26,27,28,29,30,31,32,33,34,35,36,37,38]
    }, {});
  }
};
