/**
 * Script de prueba para el sistema de Leaderboard
 *
 * Este script permite probar las funcionalidades del leaderboard:
 * - Crear snapshots manuales
 * - Consultar el ranking actual
 * - Ver estadísticas
 * - Ver historial de usuarios
 *
 * Uso:
 *   node test-leaderboard.js
 */

const leaderboardService = require('./src/services/leaderboard.service');
const Usuario = require('./src/models/usuario.model');
const { sequelize } = require('./src/models/database');

const logger = {
  info: (...args) => console.log('ℹ️ ', ...args),
  success: (...args) => console.log('✅', ...args),
  error: (...args) => console.error('❌', ...args),
  warn: (...args) => console.warn('⚠️ ', ...args)
};

async function testLeaderboard() {
  try {
    await sequelize.authenticate();
    logger.success('Conectado a la base de datos');

    // Test 1: Obtener estadísticas generales
    logger.info('\n📊 TEST 1: Estadísticas Generales');
    logger.info('═'.repeat(60));
    const stats = await leaderboardService.getLeaderboardStats();
    console.log(JSON.stringify(stats, null, 2));

    // Test 2: Crear un snapshot
    logger.info('\n📸 TEST 2: Crear Snapshot');
    logger.info('═'.repeat(60));
    const snapshot = await leaderboardService.createSnapshot();
    console.log(JSON.stringify(snapshot, null, 2));

    // Test 3: Obtener el top 10
    logger.info('\n🏆 TEST 3: Top 10 del Leaderboard');
    logger.info('═'.repeat(60));
    const top10 = await leaderboardService.getLeaderboard({ limit: 10 });

    console.log('\nPosición | Nickname | Puntos | Cambio | VIP');
    console.log('─'.repeat(60));
    top10.data.forEach(user => {
      const indicator =
        user.change_indicator === 'up' ? `↑${user.position_change}` :
        user.change_indicator === 'down' ? `↓${user.position_change}` :
        user.change_indicator === 'new' ? '⭐ NUEVO' :
        '—';

      const vip = user.is_vip ? '👑' : '';

      console.log(
        `#${user.position.toString().padEnd(8)} | ` +
        `${user.nickname.padEnd(15)} | ` +
        `${user.puntos.toString().padEnd(10)} | ` +
        `${indicator.padEnd(10)} | ` +
        `${vip}`
      );
    });

    // Test 4: Obtener leaderboard completo con paginación
    logger.info('\n📋 TEST 4: Leaderboard Completo (primeros 50)');
    logger.info('═'.repeat(60));
    const fullLeaderboard = await leaderboardService.getLeaderboard({
      limit: 50,
      offset: 0
    });
    logger.success(`Total de usuarios en el ranking: ${fullLeaderboard.meta.total}`);
    logger.info(`Mostrando: ${fullLeaderboard.data.length} usuarios`);
    logger.info(`Última actualización: ${fullLeaderboard.meta.last_update}`);

    // Test 5: Obtener historial de un usuario específico
    logger.info('\n📈 TEST 5: Historial de Usuario');
    logger.info('═'.repeat(60));

    // Obtener el primer usuario del ranking para el ejemplo
    if (top10.data.length > 0) {
      const firstUser = top10.data[0];
      logger.info(`Consultando historial de: ${firstUser.nickname} (ID: ${firstUser.usuario_id})`);

      const history = await leaderboardService.getUserPositionHistory(
        firstUser.usuario_id,
        7
      );

      if (history.history.length > 0) {
        console.log('\nFecha | Posición | Puntos');
        console.log('─'.repeat(60));
        history.history.forEach(record => {
          const date = new Date(record.snapshot_date).toLocaleString('es-ES');
          console.log(
            `${date.padEnd(25)} | ` +
            `#${record.position.toString().padEnd(8)} | ` +
            `${record.puntos}`
          );
        });
      } else {
        logger.warn('No hay historial disponible para este usuario');
      }
    }

    // Test 6: Obtener usuarios con cambios más significativos
    logger.info('\n🔥 TEST 6: Mayores Cambios de Posición');
    logger.info('═'.repeat(60));

    const biggestChanges = fullLeaderboard.data
      .filter(u => u.change_indicator === 'up' || u.change_indicator === 'down')
      .sort((a, b) => b.position_change - a.position_change)
      .slice(0, 5);

    if (biggestChanges.length > 0) {
      console.log('\nUsuario | Cambio | Posición Actual → Anterior');
      console.log('─'.repeat(60));
      biggestChanges.forEach(user => {
        const arrow = user.change_indicator === 'up' ? '↑' : '↓';
        console.log(
          `${user.nickname.padEnd(20)} | ` +
          `${arrow}${user.position_change.toString().padEnd(6)} | ` +
          `#${user.position} → #${user.previous_position}`
        );
      });
    } else {
      logger.info('No hay cambios significativos de posición aún');
      logger.info('(Crea otro snapshot después de que cambien los puntos)');
    }

    // Test 7: Usuarios nuevos en el ranking
    logger.info('\n⭐ TEST 7: Usuarios Nuevos en el Ranking');
    logger.info('═'.repeat(60));

    const newUsers = fullLeaderboard.data.filter(u => u.change_indicator === 'new');

    if (newUsers.length > 0) {
      console.log(`Se encontraron ${newUsers.length} usuarios nuevos:`);
      newUsers.slice(0, 10).forEach(user => {
        console.log(`  • ${user.nickname} - #${user.position} (${user.puntos} puntos)`);
      });
    } else {
      logger.info('No hay usuarios nuevos en este momento');
    }

    // Test 8: Distribución de puntos (estadísticas adicionales)
    logger.info('\n📊 TEST 8: Análisis de Distribución');
    logger.info('═'.repeat(60));

    const allUsers = fullLeaderboard.data;
    if (allUsers.length > 0) {
      const points = allUsers.map(u => u.puntos);
      const max = Math.max(...points);
      const min = Math.min(...points);
      const avg = points.reduce((a, b) => a + b, 0) / points.length;
      const median = points.sort((a, b) => a - b)[Math.floor(points.length / 2)];

      console.log(`Puntos Máximos: ${max.toLocaleString()}`);
      console.log(`Puntos Mínimos: ${min.toLocaleString()}`);
      console.log(`Promedio: ${Math.round(avg).toLocaleString()}`);
      console.log(`Mediana: ${median.toLocaleString()}`);

      const vipUsers = allUsers.filter(u => u.is_vip).length;
      console.log(`\nUsuarios VIP en el top ${allUsers.length}: ${vipUsers} (${Math.round(vipUsers/allUsers.length*100)}%)`);
    }

    // Resumen final
    logger.info('\n' + '═'.repeat(60));
    logger.success('¡Todas las pruebas completadas exitosamente!');
    logger.info('═'.repeat(60));

    logger.info('\n💡 Próximos pasos:');
    console.log('  1. Espera 6 horas (o ajusta LEADERBOARD_SNAPSHOT_INTERVAL_HOURS)');
    console.log('  2. Se creará un snapshot automáticamente');
    console.log('  3. Los indicadores de cambio comenzarán a funcionar');
    console.log('  4. Integra los endpoints en tu frontend');
    console.log('\n  📚 Lee LEADERBOARD-SYSTEM.md para más información');

  } catch (error) {
    logger.error('Error al ejecutar las pruebas:', error);
    console.error(error);
  } finally {
    await sequelize.close();
    logger.info('\n👋 Conexión cerrada');
  }
}

// Ejecutar las pruebas
testLeaderboard();
