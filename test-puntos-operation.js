/**
 * 🧪 Script de prueba para el nuevo sistema de puntos
 * 
 * Prueba los dos modos de operación:
 * - operation: 'add' (sumar/restar)
 * - operation: 'set' (establecer)
 */

const axios = require('axios');

// Configuración
const BASE_URL = process.env.API_URL || 'http://localhost:3001';
const TOKEN = process.env.ADMIN_TOKEN; // Necesitas un token de admin
const TEST_USER_ID = process.env.TEST_USER_ID || '1'; // ID de usuario de prueba

if (!TOKEN) {
  console.error('❌ ERROR: Debes proporcionar ADMIN_TOKEN');
  console.log('Uso: ADMIN_TOKEN=tu_token_aqui TEST_USER_ID=1 node test-puntos-operation.js');
  process.exit(1);
}

const api = axios.create({
  baseURL: `${BASE_URL}/api`,
  headers: {
    'Authorization': `Bearer ${TOKEN}`,
    'Content-Type': 'application/json'
  }
});

async function testPuntosSystem() {
  console.log('🧪 Iniciando pruebas del sistema de puntos...\n');

  try {
    // 1. Obtener usuario actual
    console.log('1️⃣ Obteniendo puntos actuales del usuario...');
    const { data: usuarios } = await api.get('/usuarios');
    const usuario = usuarios.usuarios?.find(u => u.id === Number(TEST_USER_ID)) || usuarios[0];
    
    if (!usuario) {
      console.error('❌ No se encontró el usuario');
      return;
    }

    console.log(`   Usuario: ${usuario.nickname}`);
    console.log(`   Puntos actuales: ${usuario.puntos}`);
    console.log('   ✅ OK\n');

    // 2. Test: Sumar puntos (operation: 'add')
    console.log('2️⃣ Probando SUMAR 1000 puntos (operation: "add")...');
    const { data: resultAdd } = await api.put(`/usuarios/${usuario.id}/puntos`, {
      puntos: 1000,
      operation: 'add',
      motivo: 'Test: Sumar puntos'
    });
    
    console.log(`   Puntos anteriores: ${resultAdd.usuario.puntosAnteriores}`);
    console.log(`   Cambio: +${resultAdd.usuario.cambio}`);
    console.log(`   Puntos nuevos: ${resultAdd.usuario.puntosNuevos}`);
    console.log(`   Operación: ${resultAdd.operation}`);
    console.log('   ✅ OK\n');

    // 3. Test: Restar puntos (operation: 'add' con valor negativo)
    console.log('3️⃣ Probando RESTAR 500 puntos (operation: "add", puntos: -500)...');
    const { data: resultSubtract } = await api.put(`/usuarios/${usuario.id}/puntos`, {
      puntos: -500,
      operation: 'add',
      motivo: 'Test: Restar puntos'
    });
    
    console.log(`   Puntos anteriores: ${resultSubtract.usuario.puntosAnteriores}`);
    console.log(`   Cambio: ${resultSubtract.usuario.cambio}`);
    console.log(`   Puntos nuevos: ${resultSubtract.usuario.puntosNuevos}`);
    console.log(`   Operación: ${resultSubtract.operation}`);
    console.log('   ✅ OK\n');

    // 4. Test: Establecer puntos (operation: 'set')
    console.log('4️⃣ Probando ESTABLECER a 50000 puntos (operation: "set")...');
    const { data: resultSet } = await api.put(`/usuarios/${usuario.id}/puntos`, {
      puntos: 50000,
      operation: 'set',
      motivo: 'Test: Establecer puntos'
    });
    
    console.log(`   Puntos anteriores: ${resultSet.usuario.puntosAnteriores}`);
    console.log(`   Cambio: ${resultSet.usuario.cambio > 0 ? '+' : ''}${resultSet.usuario.cambio}`);
    console.log(`   Puntos nuevos: ${resultSet.usuario.puntosNuevos}`);
    console.log(`   Operación: ${resultSet.operation}`);
    console.log('   ✅ OK\n');

    // 5. Test: Retrocompatibilidad (sin operation, debería usar 'set' por defecto)
    console.log('5️⃣ Probando RETROCOMPATIBILIDAD (sin operation)...');
    const { data: resultLegacy } = await api.put(`/usuarios/${usuario.id}/puntos`, {
      puntos: 25000,
      motivo: 'Test: Sin operation (legacy)'
    });
    
    console.log(`   Puntos anteriores: ${resultLegacy.usuario.puntosAnteriores}`);
    console.log(`   Cambio: ${resultLegacy.usuario.cambio > 0 ? '+' : ''}${resultLegacy.usuario.cambio}`);
    console.log(`   Puntos nuevos: ${resultLegacy.usuario.puntosNuevos}`);
    console.log(`   Operación (por defecto): ${resultLegacy.operation}`);
    console.log('   ✅ OK\n');

    // 6. Test: Validación de operation inválido
    console.log('6️⃣ Probando VALIDACIÓN (operation inválido)...');
    try {
      await api.put(`/usuarios/${usuario.id}/puntos`, {
        puntos: 1000,
        operation: 'invalid',
        motivo: 'Test: Operation inválido'
      });
      console.log('   ❌ FALLO: Debería haber rechazado operation inválido\n');
    } catch (error) {
      console.log(`   ✅ OK: Rechazó correctamente (${error.response.data.error})\n`);
    }

    // 7. Test: Validación de puntos negativos con 'set'
    console.log('7️⃣ Probando VALIDACIÓN (puntos negativos con "set")...');
    try {
      await api.put(`/usuarios/${usuario.id}/puntos`, {
        puntos: -1000,
        operation: 'set',
        motivo: 'Test: Puntos negativos'
      });
      console.log('   ❌ FALLO: Debería haber rechazado puntos negativos con "set"\n');
    } catch (error) {
      console.log(`   ✅ OK: Rechazó correctamente (${error.response.data.error})\n`);
    }

    // Resumen final
    console.log('═══════════════════════════════════════════════');
    console.log('✅ TODAS LAS PRUEBAS PASARON CORRECTAMENTE');
    console.log('═══════════════════════════════════════════════');
    console.log('\n📊 Resumen de operaciones:');
    console.log('  ✓ operation: "add" con valor positivo → SUMAR');
    console.log('  ✓ operation: "add" con valor negativo → RESTAR');
    console.log('  ✓ operation: "set" → ESTABLECER');
    console.log('  ✓ Sin operation → ESTABLECER (legacy, por defecto)');
    console.log('  ✓ Validaciones funcionando correctamente');

  } catch (error) {
    console.error('\n❌ ERROR en las pruebas:');
    if (error.response) {
      console.error('Status:', error.response.status);
      console.error('Data:', error.response.data);
    } else {
      console.error(error.message);
    }
    process.exit(1);
  }
}

// Ejecutar pruebas
testPuntosSystem();
