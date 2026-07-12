const { exec } = require("child_process");
const { promisify } = require("util");
const crypto = require("crypto");
const fs = require("fs").promises;
const path = require("path");
const execAsync = promisify(exec);
const logger = require("../utils/logger");

class BackupService {
  constructor() {
    this.config = {
      enabled: process.env.BACKUP_ENABLED === "true",
      githubRepoUrl: process.env.BACKUP_GITHUB_REPO_URL,
      githubToken: process.env.BACKUP_GITHUB_TOKEN,
      githubUserEmail: process.env.BACKUP_GITHUB_USER_EMAIL,
      retentionDays: Number.parseInt(process.env.BACKUP_RETENTION_DAYS || "3"),
      localPath: path.join(__dirname, "../../backups/local"),
      githubPath: path.join(__dirname, "../../backups/github"),
      dbContainer: "luisardito-mysql",
      dbName: process.env.DB_NAME || "luisardito_shop",
      dbUser: "root",
      dbPassword: process.env.MYSQL_ROOT_PASSWORD || "root",
    };

    // Validate configuration
    if (this.config.enabled && !this.config.githubToken) {
      logger.warn("Backup enabled but BACKUP_GITHUB_TOKEN is missing");
    }
  }

  /**
   * Creates a full database backup
   */
  async createBackup() {
    if (!this.config.enabled) {
      logger.info("Backups disabled (BACKUP_ENABLED=false)");
      return { success: false, reason: "disabled" };
    }

    const timestamp = new Date()
      .toISOString()
      .replace(/[:.]/g, "-")
      .slice(0, -5);
    const filename = `backup-${timestamp}.sql`;
    const gzFilename = `${filename}.gz`;

    try {
      logger.info("Starting database backup...");

      // Ensure directories exist
      await this.ensureDirectories();

      // 1. Create backup with mysqldump
      const localBackupPath = path.join(this.config.localPath, filename);
      await this.dumpDatabase(localBackupPath);

      // 2. Compress the backup
      const localGzPath = path.join(this.config.localPath, gzFilename);
      await this.compressBackup(localBackupPath, localGzPath);

      // 3. Remove uncompressed backup
      await fs.unlink(localBackupPath);

      // 4. Get backup size
      const stats = await fs.stat(localGzPath);
      const sizeMB = (stats.size / 1024 / 1024).toFixed(2);

      logger.info(`Backup created: ${gzFilename} (${sizeMB} MB)`);

      // 5. Upload to GitHub
      if (this.config.githubToken) {
        await this.pushToGitHub(localGzPath, gzFilename);
      } else {
        logger.warn("GitHub token not configured, skipping GitHub upload");
      }

      // 6. Clean old backups
      await this.cleanOldBackups();

      logger.info("Backup process completed successfully");

      return {
        success: true,
        filename: gzFilename,
        size: sizeMB,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      logger.error("Error in backup process:", error);
      return {
        success: false,
        error: error.message,
        timestamp: new Date().toISOString(),
      };
    }
  }

  /**
   * Creates the database dump
   */
  async dumpDatabase(outputPath) {
    logger.info("Creating MySQL dump...");

    // Create the dump directly in a temp file inside the MySQL container
    // Unique name to avoid collisions and symlink attacks
    const tempId = `${Date.now()}-${crypto.randomBytes(6).toString("hex")}`;
    const tempFile = `/tmp/backup-${tempId}.sql`;

    // Step 1: Create the dump inside the MySQL container
    const dumpCommand =
      `docker exec ${this.config.dbContainer} sh -c "mysqldump ` +
      `-u ${this.config.dbUser} ` +
      `-p${this.config.dbPassword} ` +
      `--single-transaction ` +
      `--routines ` +
      `--triggers ` +
      `--events ` +
      `--ignore-table=${this.config.dbName}.kick_webhook_events ` +
      `${this.config.dbName} > ${tempFile}"`;

    // Step 2: Copy the file from the container to the host
    const copyCommand = `docker cp ${this.config.dbContainer}:${tempFile} "${outputPath}"`;

    // Step 3: Clean up the temp file
    const cleanCommand = `docker exec ${this.config.dbContainer} rm -f ${tempFile}`;

    try {
      logger.info(
        `[Backup] Running mysqldump in container ${this.config.dbContainer}`
      );

      // Create dump inside the container
      const { stderr: dumpStderr } = await execAsync(dumpCommand);

      if (
        dumpStderr &&
        !dumpStderr.includes("Warning") &&
        !dumpStderr.includes("Using a password")
      ) {
        logger.warn("[Backup] mysqldump warnings:", dumpStderr);
      }

      // Copy file to host
      await execAsync(copyCommand);

      // Clean up temp file
      await execAsync(cleanCommand);

      // Verify the file is not empty
      const stats = await fs.stat(outputPath);
      if (stats.size === 0) {
        throw new Error("The backup file is empty");
      }

      logger.info(
        `MySQL dump completed (${(stats.size / 1024 / 1024).toFixed(2)} MB)`
      );
    } catch (error) {
      logger.error("[Backup] Detailed error:", error.message);
      if (error.stderr) logger.error("[Backup] stderr:", error.stderr);
      throw new Error(`Error creating MySQL dump: ${error.message}`, {
        cause: error,
      });
    }
  }

  /**
   * Compresses the backup using gzip
   */
  async compressBackup(inputPath, outputPath) {
    logger.info("Compressing backup...");

    const zlib = require("zlib");
    const { createReadStream, createWriteStream } = require("fs");
    const { pipeline } = require("stream").promises;

    try {
      await pipeline(
        createReadStream(inputPath),
        zlib.createGzip(),
        createWriteStream(outputPath)
      );
      logger.info("Backup compressed");
    } catch (error) {
      logger.error("[Backup] Error compressing:", error);
      throw new Error(`Error compressing backup: ${error.message}`, {
        cause: error,
      });
    }
  }

  /**
   * Uploads the backup to GitHub
   */
  async pushToGitHub(backupPath, filename) {
    logger.info("Uploading backup to GitHub...");

    try {
      // Check file size
      const stats = await fs.stat(backupPath);
      const sizeMB = stats.size / 1024 / 1024;

      // Initialize repo if it does not exist (this also configures Git LFS)
      await this.initGitHubRepo();

      // Check if Git LFS is available
      const hasLFS = await this.checkGitLFS();

      if (!hasLFS && sizeMB > 95) {
        logger.warn(
          `Backup too large (${sizeMB.toFixed(2)} MB) - GitHub has a 100 MB limit`
        );
        logger.warn("Suggestion: install Git LFS to handle large files");
        logger.warn("Local backups are working correctly");
        return;
      }

      if (hasLFS && sizeMB > 95) {
        logger.info(`Using Git LFS for large file (${sizeMB.toFixed(2)} MB)`);
      }

      // Copy file to the GitHub directory
      const year = new Date().getFullYear();
      const month = String(new Date().getMonth() + 1).padStart(2, "0");
      const destDir = path.join(this.config.githubPath, String(year), month);

      await fs.mkdir(destDir, { recursive: true });
      const destPath = path.join(destDir, filename);
      await fs.copyFile(backupPath, destPath);

      // Commit and push
      const repoPath = this.config.githubPath;
      const relativePath = path.join(String(year), month, filename);

      // Set merge as the default strategy
      await execAsync(`cd "${repoPath}" && git config pull.rebase false`);

      await execAsync(`cd "${repoPath}" && git add "${relativePath}"`);
      await execAsync(
        `cd "${repoPath}" && git commit -m "Automatic backup: ${filename}"`
      );

      // Try to sync with remote
      try {
        await execAsync(`cd "${repoPath}" && git pull origin main --no-edit`);
        await execAsync(`cd "${repoPath}" && git push origin main`);
      } catch (_syncError) {
        // If there are conflicts, force push (backups don't need to preserve history)
        logger.warn("[Backup] Conflict detected, forcing push...");
        await execAsync(`cd "${repoPath}" && git push --force origin main`);
      }

      logger.info("Backup uploaded to GitHub successfully");
    } catch (error) {
      logger.error("Error uploading to GitHub:", error.message);
      // Don't fail the whole process if GitHub fails
    }
  }

  /**
   * Checks if Git LFS is available and configured
   */
  async checkGitLFS() {
    try {
      await execAsync("git lfs version");

      // Check if it is configured in the repo
      const gitattributesPath = path.join(
        this.config.githubPath,
        ".gitattributes"
      );
      const content = await fs.readFile(gitattributesPath, "utf-8");
      return content.includes("*.sql.gz");
    } catch {
      return false;
    }
  }

  /**
   * Initializes the GitHub repository if it does not exist
   */
  async initGitHubRepo() {
    const repoPath = this.config.githubPath;

    try {
      // Check if it already exists
      await fs.access(path.join(repoPath, ".git"));

      // Update remote with token
      const authUrl = this.config.githubRepoUrl.replace(
        "https://",
        `https://x-access-token:${this.config.githubToken}@`
      );
      await execAsync(
        `cd "${repoPath}" && git remote set-url origin "${authUrl}"`
      );

      // Ensure Git LFS is configured
      await this.ensureGitLFS(repoPath);
    } catch {
      // Does not exist, initialize from scratch
      logger.info("Initializing backup repository...");

      const authUrl = this.config.githubRepoUrl.replace(
        "https://",
        `https://x-access-token:${this.config.githubToken}@`
      );

      // Ensure the directory exists and is empty
      await fs.mkdir(repoPath, { recursive: true });

      try {
        // Try to clone first (if the repo has content)
        await execAsync(`git clone "${authUrl}" "${repoPath}"`);
        logger.info("Repository cloned successfully");
      } catch (_cloneError) {
        // If clone fails, initialize a new repo
        logger.info("Empty repository, initializing new repo...");

        // Configure safe.directory to avoid ownership errors
        await execAsync(
          `git config --global --add safe.directory "${repoPath}"`
        );

        // Initialize git in the directory
        await execAsync(`cd "${repoPath}" && git init`);

        // Try to add remote, if it fails use set-url
        try {
          await execAsync(
            `cd "${repoPath}" && git remote add origin "${authUrl}"`
          );
        } catch (_remoteError) {
          // Remote already exists, update it
          await execAsync(
            `cd "${repoPath}" && git remote set-url origin "${authUrl}"`
          );
        }

        // Create or switch to main branch
        try {
          await execAsync(`cd "${repoPath}" && git checkout -b main`);
        } catch {
          await execAsync(`cd "${repoPath}" && git checkout main`);
        }

        logger.info("Repository initialized");
      }

      // Configure safe.directory for existing repos too (just in case)
      await execAsync(
        `git config --global --add safe.directory "${repoPath}"`
      ).catch(() => {});

      // Configure git user (now we are sure it is a git repo)
      const email = this.config.githubUserEmail || "backup@luisardito.com";
      await execAsync(`cd "${repoPath}" && git config user.email "${email}"`);
      await execAsync(`cd "${repoPath}" && git config user.name "Backup Bot"`);

      // Configure Git LFS
      await this.ensureGitLFS(repoPath);

      logger.info("Backup repository fully configured");
    }
  }

  /**
   * Ensures Git LFS is configured in the repository
   */
  async ensureGitLFS(repoPath) {
    try {
      // Check if git-lfs is installed
      await execAsync("git lfs version");

      // Initialize Git LFS in the repository
      await execAsync(`cd "${repoPath}" && git lfs install`);

      // Check if .gitattributes exists and has the correct configuration
      const gitattributesPath = path.join(repoPath, ".gitattributes");
      try {
        const content = await fs.readFile(gitattributesPath, "utf-8");
        if (!content.includes("*.sql.gz")) {
          // Add tracking for .sql.gz files
          await execAsync(`cd "${repoPath}" && git lfs track "*.sql.gz"`);
          logger.info("Git LFS configured to track *.sql.gz files");
        }
      } catch {
        // .gitattributes does not exist, create tracking
        await execAsync(`cd "${repoPath}" && git lfs track "*.sql.gz"`);

        // Commit .gitattributes if it is new
        try {
          await execAsync(`cd "${repoPath}" && git add .gitattributes`);
          await execAsync(
            `cd "${repoPath}" && git commit -m "chore: configure Git LFS for backups"`
          );
          await execAsync(`cd "${repoPath}" && git push origin main`);
          logger.info("Git LFS configured and .gitattributes committed");
        } catch (_commitError) {
          // If commit fails, probably because there are no changes or the repo is empty
          logger.info("Git LFS configured locally");
        }
      }
    } catch (error) {
      logger.warn("Git LFS is not available:", error.message);
      logger.warn(
        "Install Git LFS with: apk add git-lfs (on Alpine) or apt-get install git-lfs (on Debian/Ubuntu)"
      );
    }
  }

  /**
   * Cleans old backups according to the retention policy
   */
  async cleanOldBackups() {
    logger.info("Cleaning old backups...");

    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - this.config.retentionDays);

    try {
      const files = await fs.readdir(this.config.localPath);
      let deletedCount = 0;

      for (const file of files) {
        if (!file.startsWith("backup-") || !file.endsWith(".sql.gz")) {
          continue;
        }

        const filePath = path.join(this.config.localPath, file);
        const stats = await fs.stat(filePath);

        if (stats.mtime < cutoffDate) {
          await fs.unlink(filePath);
          deletedCount++;
          logger.info(`Deleted old backup: ${file}`);
        }
      }

      if (deletedCount > 0) {
        logger.info(`Cleaned ${deletedCount} old backups`);
      } else {
        logger.info("No old backups to clean");
      }
    } catch (error) {
      logger.warn("Error cleaning old backups:", error.message);
    }
  }

  /**
   * Ensures the required directories exist
   */
  async ensureDirectories() {
    await fs.mkdir(this.config.localPath, { recursive: true });
    await fs.mkdir(this.config.githubPath, { recursive: true });
  }

  /**
   * Lists available backups
   */
  async listBackups() {
    try {
      const files = await fs.readdir(this.config.localPath);
      const backups = [];

      for (const file of files) {
        if (file.startsWith("backup-") && file.endsWith(".sql.gz")) {
          const filePath = path.join(this.config.localPath, file);
          const stats = await fs.stat(filePath);

          backups.push({
            filename: file,
            size: (stats.size / 1024 / 1024).toFixed(2) + " MB",
            date: stats.mtime,
          });
        }
      }

      return backups.sort((a, b) => b.date - a.date);
    } catch (error) {
      logger.error("Error listing backups:", error);
      return [];
    }
  }

  /**
   * Restores a backup
   */
  async restoreBackup(filename) {
    logger.info(`Starting backup restore: ${filename}`);

    const backupPath = path.join(this.config.localPath, filename);

    try {
      // Verify the file exists
      await fs.access(backupPath);

      // Decompress if compressed
      let sqlFile = backupPath;
      if (filename.endsWith(".gz")) {
        sqlFile = backupPath.replace(".gz", "");
        await execAsync(`gunzip -c "${backupPath}" > "${sqlFile}"`);
      }

      // Restore into MySQL using docker exec
      const command =
        `docker exec -i ${this.config.dbContainer} mysql ` +
        `-u ${this.config.dbUser} ` +
        `-p${this.config.dbPassword} ` +
        `${this.config.dbName} < "${sqlFile}"`;

      await execAsync(command);

      // Clean up the temporary decompressed file
      if (sqlFile !== backupPath) {
        await fs.unlink(sqlFile);
      }

      logger.info("Backup restored successfully");
      return { success: true };
    } catch (error) {
      logger.error("Error restoring backup:", error);
      return { success: false, error: error.message };
    }
  }
}

module.exports = new BackupService();
