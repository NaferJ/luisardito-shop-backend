#!/usr/bin/env node

/**
 * 🧪 Script de Prueba - Sistema de Comandos para Moderadores
 *
 * Este script simula el procesamiento de comandos de moderadores
 * para verificar que todo funciona correctamente antes de probarlo en producción.
 *
 * Uso: node test-moderator-commands.js
 */

const ModeratorCommandsService = require('./src/services/kickModeratorCommands.service');

// Mock de payloads de Kick
const mockBroadcaster = {
  user_id: 123456,
  username: 'luisardito'
};

const mockModerator = {
  user_id: 789012,
  username: 'moderador_test',
  identity: {
    badges: [
      { type: 'moderator', text: 'Moderator' }
    ]
  }
};

const mockViewer = {
  user_id: 345678,
  username: 'viewer_regular',
  identity: {
    badges: []
  }
};

// Tests
async function runTests() {
  console.log('🧪 Iniciando tests del sistema de comandos para moderadores...\n');

  try {
    // Test 1: Verificar permisos de moderador
    console.log('📋 Test 1: Verificación de permisos');
    const isMod = ModeratorCommandsService.isModerator(mockModerator, mockBroadcaster);
    const isBroadcaster = ModeratorCommandsService.isModerator(mockBroadcaster, mockBroadcaster);
    const isViewer = ModeratorCommandsService.isModerator(mockViewer, mockBroadcaster);

    console.log(`  Moderador: ${isMod ? '✅' : '❌'} (esperado: ✅)`);
    console.log(`  Broadcaster: ${isBroadcaster ? '✅' : '❌'} (esperado: ✅)`);
    console.log(`  Viewer: ${!isViewer ? '✅' : '❌'} (esperado: ✅)\n`);

    // Test 2: Parser de comando básico
    console.log('📋 Test 2: Parser de comando básico');
    const parsed1 = ModeratorCommandsService.parseModeratorCommand('!addcmd test Hola mundo');
    console.log(`  Comando: ${parsed1.command}`);
    console.log(`  Nombre: ${parsed1.name}`);
    console.log(`  Respuesta: ${parsed1.flags.response}`);
    console.log(`  Resultado: ${parsed1.name === 'test' && parsed1.flags.response === 'Hola mundo' ? '✅' : '❌'}\n`);

    // Test 3: Parser con aliases
    console.log('📋 Test 3: Parser con aliases');
    const parsed2 = ModeratorCommandsService.parseModeratorCommand('!addcmd discord Link --aliases dc,disc');
    console.log(`  Aliases: ${parsed2.flags.aliases?.join(', ')}`);
    console.log(`  Resultado: ${parsed2.flags.aliases?.length === 2 ? '✅' : '❌'}\n`);

    // Test 4: Parser con cooldown
    console.log('📋 Test 4: Parser con cooldown');
    const parsed3 = ModeratorCommandsService.parseModeratorCommand('!addcmd test Hola --cooldown 10');
    console.log(`  Cooldown: ${parsed3.flags.cooldown}s`);
    console.log(`  Resultado: ${parsed3.flags.cooldown === 10 ? '✅' : '❌'}\n`);

    // Test 5: Parser completo
    console.log('📋 Test 5: Parser completo');
    const parsed4 = ModeratorCommandsService.parseModeratorCommand(
      '!addcmd horario Stream 8PM --aliases schedule,hora --cooldown 15 --desc "Horario del stream"'
    );
    console.log(`  Comando: ${parsed4.command}`);
    console.log(`  Nombre: ${parsed4.name}`);
    console.log(`  Respuesta: ${parsed4.flags.response}`);
    console.log(`  Aliases: ${parsed4.flags.aliases?.join(', ')}`);
    console.log(`  Cooldown: ${parsed4.flags.cooldown}s`);
    console.log(`  Descripción: ${parsed4.flags.desc}`);
    const isValid = parsed4.name === 'horario' &&
                   parsed4.flags.response === 'Stream 8PM' &&
                   parsed4.flags.aliases?.length === 2 &&
                   parsed4.flags.cooldown === 15;
    console.log(`  Resultado: ${isValid ? '✅' : '❌'}\n`);

    // Test 6: Parser de edición
    console.log('📋 Test 6: Parser de edición');
    const parsed5 = ModeratorCommandsService.parseModeratorCommand('!editcmd discord --cooldown 20');
    console.log(`  Comando: ${parsed5.command}`);
    console.log(`  Nombre: ${parsed5.name}`);
    console.log(`  Cooldown: ${parsed5.flags.cooldown}s`);
    console.log(`  Resultado: ${parsed5.command === '!editcmd' && parsed5.flags.cooldown === 20 ? '✅' : '❌'}\n`);

    // Test 7: Parser de info
    console.log('📋 Test 7: Parser de info');
    const parsed6 = ModeratorCommandsService.parseModeratorCommand('!cmdinfo discord');
    console.log(`  Comando: ${parsed6.command}`);
    console.log(`  Nombre: ${parsed6.name}`);
    console.log(`  Resultado: ${parsed6.command === '!cmdinfo' && parsed6.name === 'discord' ? '✅' : '❌'}\n`);

    // Test 8: Parser de eliminación
    console.log('📋 Test 8: Parser de eliminación');
    const parsed7 = ModeratorCommandsService.parseModeratorCommand('!delcmd test');
    console.log(`  Comando: ${parsed7.command}`);
    console.log(`  Nombre: ${parsed7.name}`);
    console.log(`  Resultado: ${parsed7.command === '!delcmd' && parsed7.name === 'test' ? '✅' : '❌'}\n`);

    // Test 9: Comando inválido (no es comando de moderador)
    console.log('📋 Test 9: Comando inválido');
    const parsed8 = ModeratorCommandsService.parseModeratorCommand('!puntos');
    console.log(`  Resultado: ${parsed8 === null ? '✅' : '❌'} (debe retornar null)\n`);

    // Test 10: Comando sin nombre
    console.log('📋 Test 10: Comando sin nombre');
    const parsed9 = ModeratorCommandsService.parseModeratorCommand('!addcmd');
    console.log(`  Error: ${parsed9.error}`);
    console.log(`  Resultado: ${parsed9.error ? '✅' : '❌'}\n`);

    console.log('✅ Todos los tests completados!\n');
    console.log('⚠️  NOTA: Para probar la integración completa con la base de datos,');
    console.log('   necesitas ejecutar comandos reales en el chat de Kick.\n');

  } catch (error) {
    console.error('❌ Error ejecutando tests:', error.message);
    console.error(error);
    process.exit(1);
  }
}

// Ejecutar tests
if (require.main === module) {
  runTests().then(() => {
    console.log('🎉 Tests finalizados exitosamente!');
    process.exit(0);
  }).catch(error => {
    console.error('💥 Error fatal:', error);
    process.exit(1);
  });
}

module.exports = { runTests };

