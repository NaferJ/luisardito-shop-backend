"use strict";

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // Permisos de moderación para Comunidad
    await queryInterface.bulkInsert(
      "permisos",
      [
        {
          id: 12,
          nombre: "moderar_comunidad",
          descripcion:
            "Permite ocultar/mostrar posts y comentarios y ver la cola de moderación",
        },
        {
          id: 13,
          nombre: "fijar_comunidad",
          descripcion: "Permite fijar posts de la comunidad",
        },
      ],
      { ignoreDuplicates: true }
    );

    // Asignar a roles 3 (streamer), 4 (developer) y 5 (moderador)
    await queryInterface.bulkInsert(
      "rol_permisos",
      [
        { rol_id: 3, permiso_id: 12 },
        { rol_id: 3, permiso_id: 13 },
        { rol_id: 4, permiso_id: 12 },
        { rol_id: 4, permiso_id: 13 },
        { rol_id: 5, permiso_id: 12 },
        { rol_id: 5, permiso_id: 13 },
      ],
      { ignoreDuplicates: true }
    );
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.bulkDelete("rol_permisos", {
      permiso_id: [12, 13],
    });
    await queryInterface.bulkDelete("permisos", { id: [12, 13] });
  },
};
