#!/usr/bin/env node

/**
 * Script para ejecutar un backup manual inmediatamente
 * 
 * Uso:
 *   node manual-backup.js
 */

require('dotenv').config();
const backupService = require('./src/services/backup.service');

async function main() {
    console.log('\n🔄 Ejecutando backup manual...\n');

    try {
        const result = await backupService.createBackup();

        if (result.success) {
            console.log('\n✅ Backup completado exitosamente');
            console.log(`📦 Archivo: ${result.filename}`);
            console.log(`📊 Tamaño: ${result.size} MB`);
            console.log(`🕐 Timestamp: ${result.timestamp}`);
        } else {
            console.log('\n❌ Backup falló');
            console.log(`Razón: ${result.error || result.reason}`);
            process.exit(1);
        }
    } catch (error) {
        console.error('\n❌ Error fatal:', error.message);
        process.exit(1);
    }
}

main();
