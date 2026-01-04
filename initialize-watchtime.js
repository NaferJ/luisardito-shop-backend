#!/usr/bin/env node

/**
 * Script para inicializar datos de watchtime y max_puntos
 * Ejecutar después de aplicar las migraciones
 */

const { sequelize, Usuario, UserWatchtime } = require('./src/models');
const logger = require('./src/utils/logger');

async function initializeWatchtimeAndMaxPoints() {
  try {
    logger.info('🚀 Iniciando inicialización de watchtime y max_puntos...');

    // 1. Actualizar max_puntos para usuarios existentes
    logger.info('📊 Actualizando max_puntos para usuarios existentes...');
    const usuariosActualizados = await sequelize.query(
      `UPDATE usuarios SET max_puntos = puntos WHERE puntos > 0 AND max_puntos = 0`,
      { type: sequelize.QueryTypes.UPDATE }
    );
    logger.info(`✅ ${usuariosActualizados[1]} usuarios actualizados con max_puntos`);

    // 2. Crear registros de watchtime para usuarios con puntos
    logger.info('📝 Creando registros de watchtime para usuarios con puntos...');
    const usuariosConPuntos = await Usuario.findAll({
      where: { puntos: { [sequelize.Op.gt]: 0 } },
      attributes: ['id', 'user_id_ext'],
      raw: true
    });

    let creatdos = 0;
    for (const usuario of usuariosConPuntos) {
      const existe = await UserWatchtime.findOne({
        where: { usuario_id: usuario.id },
        raw: true
      });

      if (!existe) {
        await UserWatchtime.create({
          usuario_id: usuario.id,
          kick_user_id: usuario.user_id_ext,
          total_watchtime_minutes: 0,
          message_count: 0,
          first_message_date: null,
          last_message_at: null
        });
        creatdos++;
      }
    }
    logger.info(`✅ ${creatdos} registros de watchtime creados`);

    logger.info('✅ Inicialización completada exitosamente');
    process.exit(0);
  } catch (error) {
    logger.error('❌ Error durante la inicialización:', error);
    process.exit(1);
  }
}

// Ejecutar si se llama directamente
if (require.main === module) {
  initializeWatchtimeAndMaxPoints();
}

module.exports = { initializeWatchtimeAndMaxPoints };

