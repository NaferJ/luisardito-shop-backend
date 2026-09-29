"use strict";

// Production deploys only run migrations (no seeders), so existing databases
// get the community permissions here. Name-based and INSERT IGNORE so it is
// safe to rerun. Fresh databases (empty permisos) are left to the seeders,
// which reuse this module after the base permissions are inserted.
const PERMISOS = [
  {
    nombre: "moderar_comunidad",
    descripcion:
      "Permite ocultar/mostrar posts y comentarios y ver la cola de moderación",
  },
  {
    nombre: "fijar_comunidad",
    descripcion: "Permite fijar posts de la comunidad",
  },
];

// Roles 3 (streamer), 4 (developer) y 5 (moderador)
const ROL_IDS = [3, 4, 5];

const NOMBRES = PERMISOS.map((p) => p.nombre);

module.exports = {
  up: async (queryInterface, Sequelize) => {
    const [[{ total }]] = await queryInterface.sequelize.query(
      "SELECT COUNT(*) AS total FROM permisos"
    );
    if (Number(total) === 0) return;

    for (const permiso of PERMISOS) {
      await queryInterface.sequelize.query(
        "INSERT IGNORE INTO permisos (nombre, descripcion) VALUES (:nombre, :descripcion)",
        { replacements: permiso }
      );
    }

    await queryInterface.sequelize.query(
      `INSERT IGNORE INTO rol_permisos (rol_id, permiso_id)
       SELECT r.id, p.id FROM roles r CROSS JOIN permisos p
       WHERE r.id IN (:rolIds) AND p.nombre IN (:nombres)`,
      { replacements: { rolIds: ROL_IDS, nombres: NOMBRES } }
    );
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.sequelize.query(
      `DELETE rp FROM rol_permisos rp
       JOIN permisos p ON p.id = rp.permiso_id
       WHERE p.nombre IN (:nombres)`,
      { replacements: { nombres: NOMBRES } }
    );
    await queryInterface.sequelize.query(
      "DELETE FROM permisos WHERE nombre IN (:nombres)",
      { replacements: { nombres: NOMBRES } }
    );
  },
};
