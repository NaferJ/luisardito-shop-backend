const { exec } = require('child_process');
const { promisify } = require('util');
const crypto = require('crypto');
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
            dbPassword: process.env.MYSQL_ROOT_PASSWORD || 'root'
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
        logger.info('Creando dump de MySQL...');

        // Crear el dump directamente en un archivo temporal en el contenedor MySQL
        // Nombre único para evitar colisiones y ataques de symlink
        const tempId = `${Date.now()}-${crypto.randomBytes(6).toString('hex')}`;
        const tempFile = `/tmp/backup-${tempId}.sql`;

        // Paso 1: Crear el dump dentro del contenedor MySQL
        const dumpCommand = `docker exec ${this.config.dbContainer} sh -c "mysqldump ` +
            `-u ${this.config.dbUser} ` +
            `-p${this.config.dbPassword} ` +
            `--single-transaction ` +
            `--routines ` +
            `--triggers ` +
            `--events ` +
            `--ignore-table=${this.config.dbName}.kick_webhook_events ` +
            `${this.config.dbName} > ${tempFile}"`;

        // Paso 2: Copiar el archivo del contenedor al host
        const copyCommand = `docker cp ${this.config.dbContainer}:${tempFile} "${outputPath}"`;

        // Paso 3: Limpiar el archivo temporal
        const cleanCommand = `docker exec ${this.config.dbContainer} rm -f ${tempFile}`;

        try {
            logger.info(`[Backup] Ejecutando mysqldump en contenedor ${this.config.dbContainer}`);

            // Crear dump dentro del contenedor
            const { stderr: dumpStderr } = await execAsync(dumpCommand);

            if (dumpStderr && !dumpStderr.includes('Warning') && !dumpStderr.includes('Using a password')) {
                logger.warn('[Backup] Advertencias de mysqldump:', dumpStderr);
            }

            // Copiar archivo al host
            await execAsync(copyCommand);

            // Limpiar archivo temporal
            await execAsync(cleanCommand);

            // Verificar que el archivo no esté vacío
            const stats = await fs.stat(outputPath);
            if (stats.size === 0) {
                throw new Error('El archivo de backup esta vacio');
            }

            logger.info(`Dump de MySQL completado (${(stats.size / 1024 / 1024).toFixed(2)} MB)`);
        } catch (error) {
            logger.error('[Backup] Error detallado:', error.message);
            if (error.stderr) logger.error('[Backup] stderr:', error.stderr);
            throw new Error(`Error al crear dump de MySQL: ${error.message}`);
        }
    }

    /**
     * Comprime el backup usando gzip
     */
    async compressBackup(inputPath, outputPath) {
        logger.info('🗜️ Comprimiendo backup...');

        const zlib = require('zlib');
        const { createReadStream, createWriteStream } = require('fs');
        const { pipeline } = require('stream').promises;

        try {
            await pipeline(
                createReadStream(inputPath),
                zlib.createGzip(),
                createWriteStream(outputPath)
            );
            logger.info('✅ Backup comprimido');
        } catch (error) {
            logger.error('[Backup] Error al comprimir:', error);
            throw new Error(`Error al comprimir backup: ${error.message}`);
        }
    }

    /**
     * Sube el backup a GitHub
     */
    async pushToGitHub(backupPath, filename) {
        logger.info('☁️ Subiendo backup a GitHub...');

        try {
            // Verificar tamaño del archivo
            const stats = await fs.stat(backupPath);
            const sizeMB = stats.size / 1024 / 1024;

            // Inicializar repo si no existe (esto también configura Git LFS)
            await this.initGitHubRepo();

            // Verificar si Git LFS está disponible
            const hasLFS = await this.checkGitLFS();

            if (!hasLFS && sizeMB > 95) {
                logger.warn(`⚠️ Backup muy grande (${sizeMB.toFixed(2)} MB) - GitHub tiene límite de 100 MB`);
                logger.warn('💡 Sugerencia: Instala Git LFS para manejar archivos grandes');
                logger.warn('💡 Los backups locales están funcionando correctamente');
                return;
            }

            if (hasLFS && sizeMB > 95) {
                logger.info(`📦 Usando Git LFS para archivo grande (${sizeMB.toFixed(2)} MB)`);
            }

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

            // Configurar merge como estrategia por defecto
            await execAsync(`cd "${repoPath}" && git config pull.rebase false`);

            await execAsync(`cd "${repoPath}" && git add "${relativePath}"`);
            await execAsync(`cd "${repoPath}" && git commit -m "Backup automático: ${filename}"`);

            // Intentar sincronizar con remoto
            try {
                await execAsync(`cd "${repoPath}" && git pull origin main --no-edit`);
                await execAsync(`cd "${repoPath}" && git push origin main`);
            } catch (syncError) {
                // Si hay conflictos, forzar push (los backups no necesitan preservar historial)
                logger.warn('[Backup] Conflicto detectado, forzando push...');
                await execAsync(`cd "${repoPath}" && git push --force origin main`);
            }

            logger.info('✅ Backup subido a GitHub exitosamente');
        } catch (error) {
            logger.error('❌ Error al subir a GitHub:', error.message);
            // No fallar todo el proceso si falla GitHub
        }
    }

    /**
     * Verifica si Git LFS está disponible y configurado
     */
    async checkGitLFS() {
        try {
            await execAsync('git lfs version');

            // Verificar si está configurado en el repo
            const gitattributesPath = path.join(this.config.githubPath, '.gitattributes');
            const content = await fs.readFile(gitattributesPath, 'utf-8');
            return content.includes('*.sql.gz');
        } catch {
            return false;
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
            
            // Asegurar que Git LFS está configurado
            await this.ensureGitLFS(repoPath);

        } catch {
            // No existe, inicializar desde cero
            logger.info('📥 Inicializando repositorio de backups...');

            const authUrl = this.config.githubRepoUrl.replace(
                'https://',
                `https://x-access-token:${this.config.githubToken}@`
            );

            // Asegurar que el directorio existe y está vacío
            await fs.mkdir(repoPath, { recursive: true });
            
            try {
                // Intentar clonar primero (si el repo tiene contenido)
                await execAsync(`git clone "${authUrl}" "${repoPath}"`);
                logger.info('✅ Repositorio clonado exitosamente');
            } catch (cloneError) {
                // Si falla el clone, inicializar repo nuevo
                logger.info('📝 Repositorio vacío, inicializando nuevo repo...');

                // Configurar safe.directory para evitar errores de ownership
                await execAsync(`git config --global --add safe.directory "${repoPath}"`);

                // Inicializar git en el directorio
                await execAsync(`cd "${repoPath}" && git init`);

                // Intentar agregar remote, si falla usar set-url
                try {
                    await execAsync(`cd "${repoPath}" && git remote add origin "${authUrl}"`);
                } catch (remoteError) {
                    // El remote ya existe, actualizarlo
                    await execAsync(`cd "${repoPath}" && git remote set-url origin "${authUrl}"`);
                }

                // Crear o cambiar a rama main
                try {
                    await execAsync(`cd "${repoPath}" && git checkout -b main`);
                } catch {
                    await execAsync(`cd "${repoPath}" && git checkout main`);
                }

                logger.info('✅ Repositorio inicializado');
            }

            // Configurar safe.directory también para repos existentes (por si acaso)
            await execAsync(`git config --global --add safe.directory "${repoPath}"`).catch(() => {});

            // Configurar git user (ahora estamos seguros de que es un repo git)
            const email = this.config.githubUserEmail || 'backup@luisardito.com';
            await execAsync(`cd "${repoPath}" && git config user.email "${email}"`);
            await execAsync(`cd "${repoPath}" && git config user.name "Backup Bot"`);
            
            // Configurar Git LFS
            await this.ensureGitLFS(repoPath);

            logger.info('✅ Repositorio de backups configurado completamente');
        }
    }

    /**
     * Asegura que Git LFS está configurado en el repositorio
     */
    async ensureGitLFS(repoPath) {
        try {
            // Verificar si git-lfs está instalado
            await execAsync('git lfs version');

            // Inicializar Git LFS en el repositorio
            await execAsync(`cd "${repoPath}" && git lfs install`);

            // Verificar si .gitattributes existe y tiene la configuración correcta
            const gitattributesPath = path.join(repoPath, '.gitattributes');
            try {
                const content = await fs.readFile(gitattributesPath, 'utf-8');
                if (!content.includes('*.sql.gz')) {
                    // Agregar tracking de archivos .sql.gz
                    await execAsync(`cd "${repoPath}" && git lfs track "*.sql.gz"`);
                    logger.info('✅ Git LFS configurado para rastrear archivos *.sql.gz');
                }
            } catch {
                // .gitattributes no existe, crear tracking
                await execAsync(`cd "${repoPath}" && git lfs track "*.sql.gz"`);

                // Hacer commit del .gitattributes si es nuevo
                try {
                    await execAsync(`cd "${repoPath}" && git add .gitattributes`);
                    await execAsync(`cd "${repoPath}" && git commit -m "chore: configurar Git LFS para backups"`);
                    await execAsync(`cd "${repoPath}" && git push origin main`);
                    logger.info('✅ Git LFS configurado y .gitattributes commiteado');
                } catch (commitError) {
                    // Si falla el commit, probablemente porque no hay cambios o el repo está vacío
                    logger.info('ℹ️ Git LFS configurado localmente');
                }
            }

        } catch (error) {
            logger.warn('⚠️ Git LFS no está disponible:', error.message);
            logger.warn('💡 Instala Git LFS con: apk add git-lfs (en Alpine) o apt-get install git-lfs (en Debian/Ubuntu)');
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

            // Restaurar en MySQL usando docker exec
            const command = `docker exec -i ${this.config.dbContainer} mysql ` +
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
