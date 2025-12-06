'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // 1. Agregar nuevo permiso 'gestionar_productos'
    await queryInterface.bulkInsert('permisos', [
      {
        id: 11,
        nombre: 'gestionar_productos',
        descripcion: 'Permite gestionar productos y promociones completamente'
      }
    ], { ignoreDuplicates: true });

    // 2. Asignar el permiso a los roles que deben tenerlo
    await queryInterface.bulkInsert('rol_permisos', [
      // Rol 3 (Luisardito - Streamer)
      { rol_id: 3, permiso_id: 11 },
      // Rol 4 (Moderador/Admin)
      { rol_id: 4, permiso_id: 11 },
      // Rol 5 (Super Admin)
      { rol_id: 5, permiso_id: 11 }
    ], { ignoreDuplicates: true });

    console.log('✅ Permiso gestionar_productos creado y asignado correctamente');
  },

  down: async (queryInterface, Sequelize) => {
    // Eliminar asignaciones del permiso
    await queryInterface.bulkDelete('rol_permisos', {
      permiso_id: 11
    });

    // Eliminar el permiso
    await queryInterface.bulkDelete('permisos', {
      id: 11
    });
  }
};
