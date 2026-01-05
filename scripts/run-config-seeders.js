#!/usr/bin/env node

/**
 * Script para ejecutar seeders de configuración de Kick
 * Ejecuta solo los seeders específicos de configuración que acabamos de crear
 */

const { exec } = require('child_process');
const path = require('path');

const seeders = [
    '20251028190000-seed-kick-points-config.js',
    '20251028190001-seed-botrix-migration-config.js'
];

console.log('🚀 Ejecutando seeders de configuración de Kick...\n');

async function runSeeder(seederFile) {
    return new Promise((resolve, reject) => {
        const command = `npx sequelize-cli db:seed --seed ${seederFile}`;

        console.log(`📦 Ejecutando: ${seederFile}`);

        exec(command, (error, stdout, stderr) => {
            if (error) {
                console.error(`❌ Error en ${seederFile}:`, error.message);
                reject(error);
                return;
            }

            if (stderr) {
                console.warn(`⚠️ Warning en ${seederFile}:`, stderr);
            }

            console.log(`✅ ${seederFile} completado`);
            if (stdout) console.log(stdout);

            resolve();
        });
    });
}

async function runAllSeeders() {
    try {
        for (const seeder of seeders) {
            await runSeeder(seeder);
            console.log(''); // Línea en blanco para separar
        }

        console.log('🎉 Todos los seeders de configuración ejecutados exitosamente');
        console.log('\n📋 Resumen:');
        console.log('- Configuración de puntos Kick inicializada');
        console.log('- Configuración de migración Botrix inicializada');
        console.log('\n💡 Ahora el frontend debería cargar correctamente las configuraciones');

    } catch (error) {
        console.error('💥 Error ejecutando seeders:', error.message);
        process.exit(1);
    }
}

// Ejecutar si es llamado directamente
if (require.main === module) {
    runAllSeeders();
}

module.exports = { runAllSeeders };
