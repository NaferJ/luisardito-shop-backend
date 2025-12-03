const { exec } = require('child_process');
const { promisify } = require('util');
const fs = require('fs').promises;
const path = require('path');
const execAsync = promisify(exec);
const logger = require('../utils/logger');

class BackupService {
    constructor() {
        this.config = {
            enabled: process.env.BACKUP_ENABLED === 'true',
            githubRepoUrl: process.env.BACKUP_GITHUB_REPO_URL,
            githubToken: process.env.BACKUP_GITHUB_TOKEN,
            githubUserEmail: process.env.BACKUP_GITHUB_USER_EMAIL,
            retentionDays: parseInt(process.env.BACKUP_RETENTION_DAYS || '3'),
            localPath: path.join(__dirname, '../../backups/local'),
            githubPath: path.join(__dirname, '../../backups/github'),
            dbContainer: 'luisardito-mysql',
            dbName: process.env.DB_NAME || 'luisardito_shop',
            dbUser: 'root',
            dbPassword: 'root'
        };

        // Validar configuración
        if (this.config.enabled && !this.config.githubToken) {
            logger.warn('⚠️ Backup habilitado pero falta BACKUP_GITHUB_TOKEN');
        }
    }

    /**
     * Crea un backup completo de la base de datos
     */
    async createBackup() {
        if (!this.config.enabled) {
            logger.info('ℹ️ Backups deshabilitados (BACKUP_ENABLED=false)');
            return { success: false, reason: 'disabled' };
        }

        const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
        const filename = `backup-${timestamp}.sql`;
        const gzFilename = `${filename}.gz`;

        try {
            logger.info('🔄 Iniciando backup de base de datos...');

            // Asegurar que existen los directorios
            await this.ensureDirectories();

            // 1. Crear backup con mysqldump
            const localBackupPath = path.join(this.config.localPath, filename);
            await this.dumpDatabase(localBackupPath);

            // 2. Comprimir el backup
            const localGzPath = path.join(this.config.localPath, gzFilename);
            await this.compressBackup(localBackupPath, localGzPath);

            // 3. Eliminar backup sin comprimir
            await fs.unlink(localBackupPath);

            // 4. Obtener tamaño del backup
            const stats = await fs.stat(localGzPath);
            const sizeMB = (stats.size / 1024 / 1024).toFixed(2);

            logger.info(`✅ Backup creado: ${gzFilename} (${sizeMB} MB)`);

            // 5. Subir a GitHub
            if (this.config.githubToken) {
                await this.pushToGitHub(localGzPath, gzFilename);
            } else {
                logger.warn('⚠️ GitHub token no configurado, saltando subida a GitHub');
            }

            // 6. Limpiar backups antiguos
            await this.cleanOldBackups();

            logger.info('✅ Proceso de backup completado exitosamente');

            return {
                success: true,
                filename: gzFilename,
                size: sizeMB,
                timestamp: new Date().toISOString()
            };

        } catch (error) {
            logger.error('❌ Error en proceso de backup:', error);
            return {
                success: false,
                error: error.message,
                timestamp: new Date().toISOString()
            };
        }
    }

    /**
     * Crea el dump de la base de datos
     */
    async dumpDatabase(outputPath) {
        logger.info('📦 Creando dump de MySQL...');

        // Conectar directamente a MySQL usando hostname de Docker (db)
        const dbHost = process.env.DB_HOST || 'db';
        const command = `mysqldump ` +
            `-h ${dbHost} ` +
            `-u ${this.config.dbUser} ` +
            `-p${this.config.dbPassword} ` +
            `--single-transaction ` +
            `--routines ` +
            `--triggers ` +
            `--events ` +
            `${this.config.dbName} > "${outputPath}"`;

        try {
            await execAsync(command);
            logger.info('✅ Dump de MySQL completado');
        } catch (error) {
            throw new Error(`Error al crear dump de MySQL: ${error.message}`);
        }
    }

    /**
     * Comprime el backup usando gzip
     */
    async compressBackup(inputPath, outputPath) {
        logger.info('🗜️ Comprimiendo backup...');

        const command = `gzip -c "${inputPath}" > "${outputPath}"`;

        try {
            await execAsync(command);
            logger.info('✅ Backup comprimido');
        } catch (error) {
            throw new Error(`Error al comprimir backup: ${error.message}`);
        }
    }

    /**
     * Sube el backup a GitHub
     */
    async pushToGitHub(backupPath, filename) {
        logger.info('☁️ Subiendo backup a GitHub...');

        try {
            // Inicializar repo si no existe
            await this.initGitHubRepo();

            // Copiar archivo al directorio de GitHub
            const year = new Date().getFullYear();
            const month = String(new Date().getMonth() + 1).padStart(2, '0');
            const destDir = path.join(this.config.githubPath, String(year), month);
            
            await fs.mkdir(destDir, { recursive: true });
            const destPath = path.join(destDir, filename);
            await fs.copyFile(backupPath, destPath);

            // Hacer commit y push
            const repoPath = this.config.githubPath;
            const relativePath = path.join(String(year), month, filename);

            await execAsync(`cd "${repoPath}" && git add "${relativePath}"`);
            await execAsync(`cd "${repoPath}" && git commit -m "Backup automático: ${filename}"`);
            await execAsync(`cd "${repoPath}" && git push origin main`);

            logger.info('✅ Backup subido a GitHub exitosamente');
        } catch (error) {
            logger.error('❌ Error al subir a GitHub:', error.message);
            // No fallar todo el proceso si falla GitHub
        }
    }

    /**
     * Inicializa el repositorio de GitHub si no existe
     */
    async initGitHubRepo() {
        const repoPath = this.config.githubPath;

        try {
            // Verificar si ya existe
            await fs.access(path.join(repoPath, '.git'));
            
            // Actualizar remote con token
            const authUrl = this.config.githubRepoUrl.replace(
                'https://',
                `https://x-access-token:${this.config.githubToken}@`
            );
            await execAsync(`cd "${repoPath}" && git remote set-url origin "${authUrl}"`);
            
        } catch {
            // No existe, clonar
            logger.info('📥 Clonando repositorio de backups...');
            
            const authUrl = this.config.githubRepoUrl.replace(
                'https://',
                `https://x-access-token:${this.config.githubToken}@`
            );

            await fs.mkdir(repoPath, { recursive: true });
            
            try {
                // Intentar clonar (puede estar vacío)
                await execAsync(`git clone "${authUrl}" "${repoPath}"`);
            } catch {
                // Repo vacío, inicializar
                await execAsync(`cd "${repoPath}" && git init`);
                await execAsync(`cd "${repoPath}" && git remote add origin "${authUrl}"`);
                await execAsync(`cd "${repoPath}" && git checkout -b main`);
            }

            // Configurar git user
            const email = this.config.githubUserEmail || 'backup@luisardito.com';
            await execAsync(`cd "${repoPath}" && git config user.email "${email}"`);
            await execAsync(`cd "${repoPath}" && git config user.name "Backup Bot"`);
            
            logger.info('✅ Repositorio de backups configurado');
        }
    }

    /**
     * Limpia backups antiguos según retention policy
     */
    async cleanOldBackups() {
        logger.info('🧹 Limpiando backups antiguos...');

        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - this.config.retentionDays);

        try {
            const files = await fs.readdir(this.config.localPath);
            let deletedCount = 0;

            for (const file of files) {
                if (!file.startsWith('backup-') || !file.endsWith('.sql.gz')) {
                    continue;
                }

                const filePath = path.join(this.config.localPath, file);
                const stats = await fs.stat(filePath);

                if (stats.mtime < cutoffDate) {
                    await fs.unlink(filePath);
                    deletedCount++;
                    logger.info(`🗑️ Eliminado backup antiguo: ${file}`);
                }
            }

            if (deletedCount > 0) {
                logger.info(`✅ Limpiados ${deletedCount} backups antiguos`);
            } else {
                logger.info('ℹ️ No hay backups antiguos para limpiar');
            }

        } catch (error) {
            logger.warn('⚠️ Error al limpiar backups antiguos:', error.message);
        }
    }

    /**
     * Asegura que existen los directorios necesarios
     */
    async ensureDirectories() {
        await fs.mkdir(this.config.localPath, { recursive: true });
        await fs.mkdir(this.config.githubPath, { recursive: true });
    }

    /**
     * Lista los backups disponibles
     */
    async listBackups() {
        try {
            const files = await fs.readdir(this.config.localPath);
            const backups = [];

            for (const file of files) {
                if (file.startsWith('backup-') && file.endsWith('.sql.gz')) {
                    const filePath = path.join(this.config.localPath, file);
                    const stats = await fs.stat(filePath);
                    
                    backups.push({
                        filename: file,
                        size: (stats.size / 1024 / 1024).toFixed(2) + ' MB',
                        date: stats.mtime
                    });
                }
            }

            return backups.sort((a, b) => b.date - a.date);
        } catch (error) {
            logger.error('Error al listar backups:', error);
            return [];
        }
    }

    /**
     * Restaura un backup
     */
    async restoreBackup(filename) {
        logger.info(`🔄 Iniciando restauración de backup: ${filename}`);

        const backupPath = path.join(this.config.localPath, filename);
        
        try {
            // Verificar que existe el archivo
            await fs.access(backupPath);

            // Descomprimir si está comprimido
            let sqlFile = backupPath;
            if (filename.endsWith('.gz')) {
                sqlFile = backupPath.replace('.gz', '');
                await execAsync(`gunzip -c "${backupPath}" > "${sqlFile}"`);
            }

            // Restaurar en MySQL (conexión directa por red Docker)
            const dbHost = process.env.DB_HOST || 'db';
            const command = `mysql ` +
                `-h ${dbHost} ` +
                `-u ${this.config.dbUser} ` +
                `-p${this.config.dbPassword} ` +
                `${this.config.dbName} < "${sqlFile}"`;

            await execAsync(command);

            // Limpiar archivo descomprimido temporal
            if (sqlFile !== backupPath) {
                await fs.unlink(sqlFile);
            }

            logger.info('✅ Backup restaurado exitosamente');
            return { success: true };

        } catch (error) {
            logger.error('❌ Error al restaurar backup:', error);
            return { success: false, error: error.message };
        }
    }
}

module.exports = new BackupService();
