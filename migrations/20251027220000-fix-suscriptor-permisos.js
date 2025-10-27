'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    // 1. Agregar permiso ver_historial_puntos al rol 2 (suscriptor)
    await queryInterface.bulkInsert('rol_permisos', [
      { id: 39, rol_id: 2, permiso_id: 9 }
    ], { ignoreDuplicates: true });

    console.log('✅ Permiso ver_historial_puntos agregado al rol suscriptor');

    // 2. Opcional: Cambiar usuarios existentes con rol 2 a rol 1
    // (Comentado por seguridad - revisar caso por caso)
    /*
    const [usuarios] = await queryInterface.sequelize.query(
      'SELECT id, nickname FROM usuarios WHERE rol_id = 2'
    );

    if (usuarios.length > 0) {
      console.log('Usuarios con rol suscriptor encontrados:', usuarios.map(u => u.nickname));
      // await queryInterface.sequelize.query('UPDATE usuarios SET rol_id = 1 WHERE rol_id = 2');
      // console.log('✅ Usuarios migrados de suscriptor a usuario básico');
    }
    */
  },

  async down(queryInterface, Sequelize) {
    // Revertir cambios
    await queryInterface.bulkDelete('rol_permisos', { id: 39 }, {});
    console.log('✅ Permiso ver_historial_puntos removido del rol suscriptor');
  }
};
