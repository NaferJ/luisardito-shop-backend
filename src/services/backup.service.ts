import { exec } from "node:child_process";
import { promisify } from "node:util";
import crypto from "node:crypto";
import { promises as fs, createReadStream, createWriteStream } from "node:fs";
import path from "node:path";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import zlib from "node:zlib";
import {
  S3Client,
  PutObjectCommand,
  ListObjectsV2Command,
  GetObjectCommand,
  DeleteObjectsCommand,
} from "@aws-sdk/client-s3";
import config from "../../config";
import logger from "../utils/logger";

const execAsync = promisify(exec);

const BACKUP_FILENAME_PATTERN = /^backup-[\w-]+\.sql\.gz$/;

interface BackupConfig {
  enabled: boolean;
  retentionDays: number;
  remoteRetentionDays: number;
  localPath: string;
  dbContainer: string;
  dbName: string;
  dbUser: string;
  dbPassword: string;
  r2: {
    endpoint: string | undefined;
    accessKeyId: string | undefined;
    secretAccessKey: string | undefined;
    bucketName: string | undefined;
  };
}

interface BackupResult {
  success: boolean;
  filename?: string;
  size?: string;
  timestamp?: string;
  reason?: string;
  error?: string;
}

interface BackupInfo {
  filename: string;
  size: string;
  date: Date;
}

interface RemoteBackupInfo {
  key: string;
  size: string;
  date: Date;
}

class BackupService {
  config: BackupConfig;
  private s3Client: S3Client | null = null;

  constructor() {
    this.config = {
      enabled: config.backup.enabled,
      retentionDays: config.backup.retentionDays,
      remoteRetentionDays: config.backup.remoteRetentionDays,
      localPath: path.join(process.cwd(), "backups", "local"),
      dbContainer: config.backup.dbContainer,
      dbName: config.db.database || "luisardito_shop",
      dbUser: config.backup.dbUser,
      dbPassword: config.backup.dbPassword,
      r2: {
        endpoint: config.backup.r2.endpoint,
        accessKeyId: config.backup.r2.accessKeyId,
        secretAccessKey: config.backup.r2.secretAccessKey,
        bucketName: config.backup.r2.bucketName,
      },
    };

    // Validate configuration
    if (this.config.enabled && !this.r2Configured) {
      logger.warn(
        "Backups enabled but R2 is not fully configured (need R2_ENDPOINT, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET_NAME); remote uploads will be skipped"
      );
    }
  }

  get r2Configured(): boolean {
    const r2 = this.config.r2;
    return Boolean(
      r2.endpoint && r2.accessKeyId && r2.secretAccessKey && r2.bucketName
    );
  }

  get s3(): S3Client {
    if (!this.s3Client) {
      const r2 = this.config.r2;
      this.s3Client = new S3Client({
        region: "auto",
        endpoint: r2.endpoint,
        forcePathStyle: true,
        credentials: {
          accessKeyId: r2.accessKeyId,
          secretAccessKey: r2.secretAccessKey,
        },
      });
    }
    return this.s3Client;
  }

  /**
   * Creates a full database backup
   */
  async createBackup(): Promise<BackupResult> {
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

      // 5. Upload to R2
      if (this.r2Configured) {
        const uploaded = await this.uploadToR2(localGzPath, gzFilename);
        if (uploaded) await this.cleanRemoteBackups();
      } else {
        logger.warn("R2 not configured, skipping remote upload");
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
      const msg = error instanceof Error ? error.message : String(error);
      logger.error("Error in backup process:", msg);
      return {
        success: false,
        error: msg,
        timestamp: new Date().toISOString(),
      };
    }
  }

  /**
   * Creates the database dump
   */
  async dumpDatabase(outputPath: string) {
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
      const msg = error instanceof Error ? error.message : String(error);
      logger.error("[Backup] Detailed error:", msg);
      if (error instanceof Error && "stderr" in error) {
        logger.error("[Backup] stderr:", (error as { stderr: string }).stderr);
      }
      throw new Error(`Error creating MySQL dump: ${msg}`, {
        cause: error,
      });
    }
  }

  /**
   * Compresses the backup using gzip
   */
  async compressBackup(inputPath: string, outputPath: string) {
    logger.info("Compressing backup...");

    try {
      await pipeline(
        createReadStream(inputPath),
        zlib.createGzip(),
        createWriteStream(outputPath)
      );
      logger.info("Backup compressed");
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      logger.error("[Backup] Error compressing:", msg);
      throw new Error(`Error compressing backup: ${msg}`, {
        cause: error,
      });
    }
  }

  /**
   * Uploads the backup to Cloudflare R2
   */
  async uploadToR2(backupPath: string, filename: string): Promise<boolean> {
    logger.info("Uploading backup to R2...");

    try {
      const stats = await fs.stat(backupPath);

      await this.s3.send(
        new PutObjectCommand({
          Bucket: this.config.r2.bucketName,
          Key: filename,
          Body: createReadStream(backupPath),
          ContentType: "application/gzip",
          ContentLength: stats.size,
        })
      );

      logger.info("Backup uploaded to R2 successfully");
      return true;
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      logger.error("Error uploading to R2:", msg);
      // Don't fail the whole process if R2 fails
      return false;
    }
  }

  /**
   * Deletes remote backups older than the remote retention policy
   */
  async cleanRemoteBackups() {
    if (!this.r2Configured) return;

    const cutoffMs =
      Date.now() - this.config.remoteRetentionDays * 24 * 60 * 60 * 1000;

    try {
      const keysToDelete: { Key: string }[] = [];
      let continuationToken: string | undefined;

      do {
        const page = await this.s3.send(
          new ListObjectsV2Command({
            Bucket: this.config.r2.bucketName,
            ContinuationToken: continuationToken,
          })
        );

        for (const obj of page.Contents || []) {
          if (
            obj.Key &&
            obj.LastModified &&
            obj.LastModified.getTime() < cutoffMs
          ) {
            keysToDelete.push({ Key: obj.Key });
          }
        }

        continuationToken = page.IsTruncated
          ? page.NextContinuationToken
          : undefined;
      } while (continuationToken);

      // DeleteObjects accepts at most 1000 keys per request
      for (let i = 0; i < keysToDelete.length; i += 1000) {
        const chunk = keysToDelete.slice(i, i + 1000);
        await this.s3.send(
          new DeleteObjectsCommand({
            Bucket: this.config.r2.bucketName,
            Delete: { Objects: chunk },
          })
        );
        for (const { Key } of chunk) {
          logger.info(`Deleted old remote backup: ${Key}`);
        }
      }

      if (keysToDelete.length > 0) {
        logger.info(`Cleaned ${keysToDelete.length} old remote backups`);
      } else {
        logger.info("No old remote backups to clean");
      }
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      logger.warn("Error cleaning remote backups:", msg);
    }
  }

  /**
   * Lists backups stored in R2
   */
  async listRemoteBackups(): Promise<RemoteBackupInfo[]> {
    if (!this.r2Configured) return [];

    try {
      const backups: RemoteBackupInfo[] = [];
      let continuationToken: string | undefined;

      do {
        const page = await this.s3.send(
          new ListObjectsV2Command({
            Bucket: this.config.r2.bucketName,
            ContinuationToken: continuationToken,
          })
        );

        for (const obj of page.Contents || []) {
          if (!obj.Key) continue;
          backups.push({
            key: obj.Key,
            size: ((obj.Size || 0) / 1024 / 1024).toFixed(2) + " MB",
            date: obj.LastModified || new Date(0),
          });
        }

        continuationToken = page.IsTruncated
          ? page.NextContinuationToken
          : undefined;
      } while (continuationToken);

      return backups.sort((a, b) => b.date.getTime() - a.date.getTime());
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      logger.error("Error listing remote backups:", msg);
      return [];
    }
  }

  /**
   * Downloads a remote backup from R2 into the local backups directory
   */
  async downloadRemoteBackup(filename: string): Promise<string> {
    if (!BACKUP_FILENAME_PATTERN.test(filename)) {
      throw new Error(`Invalid backup filename: ${filename}`);
    }

    if (!this.r2Configured) {
      throw new Error("R2 is not configured, cannot download remote backups");
    }

    await fs.mkdir(this.config.localPath, { recursive: true });
    const destPath = path.join(this.config.localPath, filename);

    const response = await this.s3.send(
      new GetObjectCommand({
        Bucket: this.config.r2.bucketName,
        Key: filename,
      })
    );

    if (!(response.Body instanceof Readable)) {
      throw new Error("Unexpected response body from R2");
    }

    await pipeline(response.Body, createWriteStream(destPath));

    logger.info(`Downloaded remote backup: ${filename}`);
    return destPath;
  }

  /**
   * Checks connectivity with the R2 bucket
   */
  async checkR2Connection(): Promise<boolean> {
    if (!this.r2Configured) {
      logger.warn("R2 is not configured");
      return false;
    }

    try {
      await this.s3.send(
        new ListObjectsV2Command({
          Bucket: this.config.r2.bucketName,
          MaxKeys: 1,
        })
      );
      return true;
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      logger.error("R2 connection check failed:", msg);
      return false;
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
      const msg = error instanceof Error ? error.message : String(error);
      logger.warn("Error cleaning old backups:", msg);
    }
  }

  /**
   * Ensures the required directories exist
   */
  async ensureDirectories() {
    await fs.mkdir(this.config.localPath, { recursive: true });
  }

  /**
   * Lists available backups
   */
  async listBackups(): Promise<BackupInfo[]> {
    try {
      const files = await fs.readdir(this.config.localPath);
      const backups: BackupInfo[] = [];

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

      return backups.sort((a, b) => b.date.getTime() - a.date.getTime());
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      logger.error("Error listing backups:", msg);
      return [];
    }
  }

  /**
   * Restores a backup
   */
  async restoreBackup(
    filename: string
  ): Promise<{ success: boolean; error?: string }> {
    logger.info(`Starting backup restore: ${filename}`);

    try {
      if (!BACKUP_FILENAME_PATTERN.test(filename)) {
        throw new Error(`Invalid backup filename: ${filename}`);
      }

      const backupPath = path.join(this.config.localPath, filename);

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
      const msg = error instanceof Error ? error.message : String(error);
      logger.error("Error restoring backup:", msg);
      return { success: false, error: msg };
    }
  }
}

const backupService = new BackupService();
export = backupService;
