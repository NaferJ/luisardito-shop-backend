"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    // Seed roles first
    const roles = [
      { id: 1, nombre: 'usuario', descripcion: 'Usuario básico' },
      { id: 2, nombre: 'suscriptor', descripcion: 'Suscriptor del canal' },
      { id: 3, nombre: 'streamer', descripcion: 'Propietario del canal' },
      { id: 4, nombre: 'developer', descripcion: 'Desarrollador con acceso completo' },
      { id: 5, nombre: 'moderador', descripcion: 'Moderador con permisos administrativos completos' }
    ];

    // MySQL supports ignoreDuplicates
    await queryInterface.bulkInsert('roles', roles, { ignoreDuplicates: true });
  },

  async down(queryInterface, Sequelize) {
    // Remove seeded roles by id range
    await queryInterface.bulkDelete('roles', { id: [1,2,3,4,5] }, {});
  }
};
