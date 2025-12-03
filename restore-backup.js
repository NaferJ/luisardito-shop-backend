#!/usr/bin/env node

/**
 * Script de restauración de emergencia de backups
 * 
 * Uso:
 *   node restore-backup.js                    # Restaurar el backup más reciente
 *   node restore-backup.js backup-2025-12-02.sql.gz  # Restaurar un backup específico
 */

const backupService = require('./src/services/backup.service');
const logger = require('./src/utils/logger');
const readline = require('readline');

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

async function promptUser(question) {
    return new Promise(resolve => {
        rl.question(question, answer => {
            resolve(answer);
        });
    });
}

async function main() {
    console.log('\n🔄 SCRIPT DE RESTAURACIÓN DE BACKUP\n');

    try {
        // Listar backups disponibles
        const backups = await backupService.listBackups();

        if (backups.length === 0) {
            console.log('❌ No hay backups disponibles localmente');
            console.log('💡 Descarga un backup desde GitHub primero');
            process.exit(1);
        }

        console.log('📦 Backups disponibles:\n');
        backups.forEach((backup, index) => {
            console.log(`  ${index + 1}. ${backup.filename}`);
            console.log(`     Tamaño: ${backup.size}`);
            console.log(`     Fecha: ${backup.date.toLocaleString()}`);
            console.log('');
        });

        // Determinar qué backup restaurar
        let selectedBackup;
        const filename = process.argv[2];

        if (filename) {
            // Backup específico pasado como argumento
            selectedBackup = backups.find(b => b.filename === filename);
            if (!selectedBackup) {
                console.log(`❌ Backup no encontrado: ${filename}`);
                process.exit(1);
            }
        } else {
            // Usar el más reciente
            selectedBackup = backups[0];
        }

        console.log(`🎯 Backup seleccionado: ${selectedBackup.filename}`);
        console.log(`📅 Fecha: ${selectedBackup.date.toLocaleString()}`);
        console.log(`📊 Tamaño: ${selectedBackup.size}\n`);

        // Confirmar con el usuario
        console.log('⚠️  ADVERTENCIA: Esta operación sobrescribirá la base de datos actual');
        console.log('⚠️  Asegúrate de haber creado un backup reciente si es necesario\n');

        const confirm = await promptUser('¿Estás seguro de continuar? (escribe "SI" para confirmar): ');

        if (confirm.trim().toUpperCase() !== 'SI') {
            console.log('\n❌ Restauración cancelada');
            process.exit(0);
        }

        console.log('\n🔄 Iniciando restauración...\n');

        // Ejecutar restauración
        const result = await backupService.restoreBackup(selectedBackup.filename);

        if (result.success) {
            console.log('\n✅ ¡Backup restaurado exitosamente!');
            console.log('💡 Reinicia la aplicación si es necesario');
        } else {
            console.log('\n❌ Error al restaurar backup:', result.error);
            process.exit(1);
        }

    } catch (error) {
        console.error('\n❌ Error fatal:', error.message);
        process.exit(1);
    } finally {
        rl.close();
    }
}

main();
