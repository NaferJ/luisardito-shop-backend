#!/usr/bin/env node

/**
 * Script de verificación para asegurar que max_puntos y watchtime están implementados correctamente
 */

const fs = require('fs');
const path = require('path');
const logger = require('./src/utils/logger');

async function verifyImplementation() {
  console.log('🔍 Iniciando verificación de implementación...\n');

  let allGood = true;

  // 1. Verificar archivos de migración
  console.log('📋 Verificando archivos de migración...');
  const migrationFiles = [
    'migrations/20260103000002-add-max-puntos-to-usuarios.js',
    'migrations/20260103000003-create-user-watchtime.js'
  ];

  for (const file of migrationFiles) {
    if (fs.existsSync(file)) {
      console.log(`  ✅ ${file}`);
    } else {
      console.log(`  ❌ FALTA: ${file}`);
      allGood = false;
    }
  }

  // 2. Verificar modelo Usuario
  console.log('\n🔍 Verificando modelo Usuario...');
  const usuarioModel = fs.readFileSync('src/models/usuario.model.js', 'utf8');
  if (usuarioModel.includes('max_puntos')) {
    console.log('  ✅ Campo max_puntos en Usuario');
  } else {
    console.log('  ❌ Campo max_puntos FALTA en Usuario');
    allGood = false;
  }

  // 3. Verificar modelo UserWatchtime
  console.log('\n🔍 Verificando modelo UserWatchtime...');
  if (fs.existsSync('src/models/userWatchtime.model.js')) {
    const watchtimeModel = fs.readFileSync('src/models/userWatchtime.model.js', 'utf8');
    const requiredFields = ['total_watchtime_minutes', 'message_count', 'first_message_date', 'last_message_at'];
    let modelGood = true;
    for (const field of requiredFields) {
      if (!watchtimeModel.includes(field)) {
        console.log(`  ❌ Campo ${field} FALTA`);
        modelGood = false;
      }
    }
    if (modelGood) {
      console.log('  ✅ Modelo UserWatchtime completo');
    } else {
      allGood = false;
    }
  } else {
    console.log('  ❌ Archivo userWatchtime.model.js NO EXISTE');
    allGood = false;
  }

  // 4. Verificar index.js de modelos
  console.log('\n🔍 Verificando index.js de modelos...');
  const indexModels = fs.readFileSync('src/models/index.js', 'utf8');
  const indexChecks = [
    { name: 'Importación UserWatchtime', pattern: 'userWatchtime.model' },
    { name: 'Exportación UserWatchtime', pattern: 'UserWatchtime,' },
    { name: 'Asociación Usuario-Watchtime', pattern: 'hasOne(UserWatchtime' }
  ];

  for (const check of indexChecks) {
    if (indexModels.includes(check.pattern)) {
      console.log(`  ✅ ${check.name}`);
    } else {
      console.log(`  ❌ ${check.name} FALTA`);
      allGood = false;
    }
  }

  // 5. Verificar webhook controller
  console.log('\n🔍 Verificando kickWebhook.controller.js...');
  const webhookController = fs.readFileSync('src/controllers/kickWebhook.controller.js', 'utf8');
  const webhookChecks = [
    { name: 'max_puntos en webhook', pattern: 'max_puntos' },
    { name: 'UserWatchtime en webhook', pattern: 'UserWatchtime' },
    { name: 'total_watchtime_minutes increment', pattern: 'total_watchtime_minutes' },
    { name: 'message_count increment', pattern: 'message_count' }
  ];

  for (const check of webhookChecks) {
    if (webhookController.includes(check.pattern)) {
      console.log(`  ✅ ${check.name}`);
    } else {
      console.log(`  ❌ ${check.name} FALTA`);
      allGood = false;
    }
  }

  // 6. Verificar leaderboard service
  console.log('\n🔍 Verificando leaderboard.service.js...');
  const leaderboardService = fs.readFileSync('src/services/leaderboard.service.js', 'utf8');
  const leaderboardChecks = [
    { name: 'max_puntos en respuesta', pattern: 'max_puntos' },
    { name: 'watchtime_minutes en respuesta', pattern: 'watchtime_minutes' },
    { name: 'UserWatchtime include', pattern: 'include' }
  ];

  for (const check of leaderboardChecks) {
    if (leaderboardService.includes(check.pattern)) {
      console.log(`  ✅ ${check.name}`);
    } else {
      console.log(`  ❌ ${check.name} FALTA`);
      allGood = false;
    }
  }

  // 7. Verificar scripts auxiliares
  console.log('\n🔍 Verificando scripts auxiliares...');
  const scripts = [
    'initialize-watchtime.js',
    'migrations/manual-apply-max-puntos-watchtime.sql'
  ];

  for (const script of scripts) {
    if (fs.existsSync(script)) {
      console.log(`  ✅ ${script}`);
    } else {
      console.log(`  ❌ FALTA: ${script}`);
      allGood = false;
    }
  }

  // 8. Verificar sintaxis
  console.log('\n🔍 Verificando sintaxis de archivos...');
  const filesToCheck = [
    'src/models/usuario.model.js',
    'src/models/userWatchtime.model.js',
    'src/models/index.js',
    'src/controllers/kickWebhook.controller.js',
    'src/services/leaderboard.service.js'
  ];

  const { execSync } = require('child_process');
  for (const file of filesToCheck) {
    try {
      execSync(`node -c ${file}`, { stdio: 'pipe' });
      console.log(`  ✅ Sintaxis OK: ${file}`);
    } catch (error) {
      console.log(`  ❌ Error de sintaxis en: ${file}`);
      allGood = false;
    }
  }

  // Resultado final
  console.log('\n' + '='.repeat(60));
  if (allGood) {
    console.log('✅ ¡Verificación completada! Todos los cambios están implementados correctamente.');
    console.log('\n📚 Próximos pasos:');
    console.log('1. Aplicar migraciones: npm run migrate');
    console.log('2. Inicializar datos: node initialize-watchtime.js');
    console.log('3. Reiniciar servidor y probar webhook');
    console.log('4. Verificar endpoint: GET /api/leaderboard');
  } else {
    console.log('❌ Verificación completada con errores. Por favor revisa los puntos marcados arriba.');
  }
  console.log('='.repeat(60) + '\n');

  return allGood ? 0 : 1;
}

// Ejecutar
if (require.main === module) {
  verifyImplementation().then(code => process.exit(code));
}

module.exports = { verifyImplementation };

