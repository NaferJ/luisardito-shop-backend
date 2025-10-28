'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    try {
      // Verificar si el permiso ver_historial_puntos existe
      const [permisos] = await queryInterface.sequelize.query(
        "SELECT id FROM permisos WHERE nombre = 'ver_historial_puntos'"
      );

      if (permisos.length === 0) {
        console.log('❌ Permiso ver_historial_puntos no encontrado');
        return;
      }

      const permisoId = permisos[0].id;

      // Verificar si el rol 1 (usuario básico) ya tiene este permiso
      const [existeRelacion] = await queryInterface.sequelize.query(
        `SELECT * FROM rol_permisos WHERE rol_id = 1 AND permiso_id = ${permisoId}`
      );

      if (existeRelacion.length > 0) {
        console.log('✅ Rol usuario básico ya tiene permiso ver_historial_puntos');
        return;
      }

      // Insertar la relación rol-permiso
      await queryInterface.sequelize.query(
        `INSERT INTO rol_permisos (rol_id, permiso_id, created_at, updated_at) 
         VALUES (1, ${permisoId}, NOW(), NOW())`
      );

      console.log('✅ Permiso ver_historial_puntos agregado al rol usuario básico');

    } catch (error) {
      console.error('Error en seeder de permisos:', error);
      // No lanzar error para no bloquear el startup
    }
  },

  async down(queryInterface, Sequelize) {
    try {
      const [permisos] = await queryInterface.sequelize.query(
        "SELECT id FROM permisos WHERE nombre = 'ver_historial_puntos'"
      );

      if (permisos.length > 0) {
        const permisoId = permisos[0].id;
        await queryInterface.sequelize.query(
          `DELETE FROM rol_permisos WHERE rol_id = 1 AND permiso_id = ${permisoId}`
        );
        console.log('❌ Permiso ver_historial_puntos removido del rol usuario básico');
      }
    } catch (error) {
      console.error('Error en rollback de seeder:', error);
    }
  }
};
