require('dotenv').config();

const backupService = require('./src/services/backup.service');
const backupScheduler = require('./src/services/backup.task');
const logger = require('./src/utils/logger');

async function diagnoseBackups() {
    console.log('🔍 Diagnóstico del Sistema de Backups\n');

    // 1. Verificar configuración
    console.log('📋 1. Configuración:');
    console.log('   BACKUP_ENABLED:', process.env.BACKUP_ENABLED);
    console.log('   BACKUP_TIME:', process.env.BACKUP_TIME);
    console.log('   BACKUP_GITHUB_TOKEN:', process.env.BACKUP_GITHUB_TOKEN ? '✅ Configurado' : '❌ Faltante');
    console.log('   BACKUP_GITHUB_REPO_URL:', process.env.BACKUP_GITHUB_REPO_URL);
    console.log('   BACKUP_GITHUB_USER_EMAIL:', process.env.BACKUP_GITHUB_USER_EMAIL);
    console.log('');

    // 2. Verificar scheduler
    console.log('⏰ 2. Scheduler:');
    try {
        backupScheduler.start();
        console.log('   ✅ Scheduler inicializado correctamente');
    } catch (error) {
        console.log('   ❌ Error inicializando scheduler:', error.message);
    }
    console.log('');

    // 3. Verificar directorios
    console.log('📁 3. Directorios:');
    const fs = require('fs');
    const path = require('path');

    const localPath = path.join(__dirname, 'backups/local');
    const githubPath = path.join(__dirname, 'backups/github');

    console.log('   Local path:', localPath, fs.existsSync(localPath) ? '✅ Existe' : '❌ No existe');
    console.log('   GitHub path:', githubPath, fs.existsSync(githubPath) ? '✅ Existe' : '❌ No existe');

    // Verificar si el repo de GitHub está inicializado
    const gitPath = path.join(githubPath, '.git');
    console.log('   GitHub .git:', gitPath, fs.existsSync(gitPath) ? '✅ Inicializado' : '❌ No inicializado');
    console.log('');

    // 4. Verificar backups existentes
    console.log('📦 4. Backups existentes:');
    try {
        const backups = await backupService.listBackups();
        if (backups.length > 0) {
            console.log('   ✅ Encontrados', backups.length, 'backups:');
            backups.slice(-3).forEach(backup => {
                console.log('     -', backup.filename, `(${backup.size}) - ${backup.date.toISOString().split('T')[0]}`);
            });
        } else {
            console.log('   ⚠️ No se encontraron backups');
        }
    } catch (error) {
        console.log('   ❌ Error listando backups:', error.message);
    }
    console.log('');

    // 5. Probar backup manual (sin ejecutar realmente)
    console.log('🧪 5. Test de configuración:');
    if (process.env.BACKUP_ENABLED === 'true') {
        console.log('   ✅ Backups habilitados');
    } else {
        console.log('   ❌ Backups deshabilitados (BACKUP_ENABLED != true)');
    }

    if (process.env.BACKUP_GITHUB_TOKEN) {
        console.log('   ✅ Token de GitHub configurado');
    } else {
        console.log('   ❌ Token de GitHub faltante');
    }

    // 6. Verificar estado del repositorio GitHub
    console.log('📊 6. Estado del repositorio GitHub:');
    if (fs.existsSync(gitPath)) {
        try {
            const { execFileSync } = require('child_process');
            // Ruta absoluta de git para evitar inyección vía PATH (S4036)
            const gitBin = process.platform === 'win32' ? 'git' : '/usr/bin/git';
            const lastCommit = execFileSync(gitBin, ['log', '-1', '--oneline'], { cwd: githubPath, encoding: 'utf8' }).trim();
            console.log('   ✅ Último commit:', lastCommit);

            const status = execFileSync(gitBin, ['status', '--porcelain'], { cwd: githubPath, encoding: 'utf8' }).trim();
            console.log('   Estado del repo:', status || 'Limpio');
        } catch (error) {
            console.log('   ❌ Error verificando repo:', error.message);
        }
    } else {
        console.log('   ❌ Repositorio no inicializado');
    }
    console.log('');

    console.log('\n🎯 Diagnóstico completado');
}

diagnoseBackups().catch(console.error);
