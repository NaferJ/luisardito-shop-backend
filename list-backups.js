#!/usr/bin/env node

/**
 * Script para listar todos los backups disponibles
 * 
 * Uso:
 *   node list-backups.js
 */

require('dotenv').config();
const backupService = require('./src/services/backup.service');

async function main() {
    console.log('\n📦 BACKUPS DISPONIBLES\n');

    try {
        const backups = await backupService.listBackups();

        if (backups.length === 0) {
            console.log('ℹ️  No hay backups disponibles localmente');
            console.log('💡 Ejecuta un backup manual con: node manual-backup.js');
            return;
        }

        console.log(`Total: ${backups.length} backups\n`);

        backups.forEach((backup, index) => {
            console.log(`${index + 1}. ${backup.filename}`);
            console.log(`   📊 Tamaño: ${backup.size}`);
            console.log(`   📅 Fecha: ${backup.date.toLocaleString()}`);
            console.log('');
        });

        console.log('💡 Para restaurar: node restore-backup.js [nombre-archivo]');

    } catch (error) {
        console.error('❌ Error:', error.message);
        process.exit(1);
    }
}

main();
