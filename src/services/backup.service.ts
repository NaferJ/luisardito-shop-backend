import { spawn, type ChildProcess } from "node:child_process";
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
  type _Object,
} from "@aws-sdk/client-s3";
import config from "../../config";
import logger from "../utils/logger";

const BACKUP_FILENAME_PATTERN = /^backup-[\w-]+\.sql\.gz$/;
const MAX_PROCESS_STDERR_LENGTH = 8192;

interface BackupConfig {
  enabled: boolean;
  retentionDays: number;
  remoteRetentionDays: number;
  localPath: string;
  dbHost: string | undefined;
  dbPort: number;
  dbName: string;
  dbUser: string | undefined;
  dbPassword: string | undefined;
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
      dbHost: config.db.host,
      dbPort: config.db.port,
      dbName: config.db.database || "luisardito_shop",
      dbUser: config.db.user,
      dbPassword: config.db.password,
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
    const gzFilename = `backup-${timestamp}.sql.gz`;

    try {
      logger.info("Starting database backup...");

      // Ensure directories exist
      await this.ensureDirectories();

      // 1. Create the compressed backup directly from mysqldump
      const localGzPath = path.join(this.config.localPath, gzFilename);
      await this.dumpDatabase(localGzPath);

      // 2. Get backup size
      const stats = await fs.stat(localGzPath);
      const sizeMB = (stats.size / 1024 / 1024).toFixed(2);

      logger.info(`Backup created: ${gzFilename} (${sizeMB} MB)`);

      // 3. Upload to R2
      if (this.r2Configured) {
        const uploaded = await this.uploadToR2(localGzPath, gzFilename);
        if (uploaded) await this.cleanRemoteBackups();
      } else {
        logger.warn("R2 not configured, skipping remote upload");
      }

      // 4. Clean old backups
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

  private getDbConnection() {
    const { dbHost, dbPort, dbName, dbUser, dbPassword } = this.config;

    if (!dbHost || !dbUser || !dbPassword) {
      const missing: string[] = [];
      if (!dbHost) missing.push("DB_HOST");
      if (!dbUser) missing.push("DB_USER");
      if (!dbPassword) missing.push("DB_PASSWORD");
      throw new Error(
        `Incomplete database backup configuration: missing ${missing.join(", ")}`
      );
    }

    return {
      host: dbHost,
      port: dbPort,
      database: dbName,
      user: dbUser,
      password: dbPassword,
    };
  }

  private observeProcess(child: ChildProcess, command: string) {
    let stderr = "";
    child.stderr?.on("data", (chunk: Buffer | string) => {
      stderr = (stderr + chunk.toString()).slice(-MAX_PROCESS_STDERR_LENGTH);
    });

    const done = new Promise<void>((resolve, reject) => {
      child.once("error", (error) => {
        reject(
          new Error(`Failed to start ${command}: ${error.message}`, {
            cause: error,
          })
        );
      });

      child.once("close", (code, signal) => {
        if (code === 0) {
          resolve();
          return;
        }

        const status = signal ? `signal ${signal}` : `exit code ${code}`;
        const details = stderr.trim();
        reject(
          new Error(
            `${command} failed with ${status}${details ? `: ${details}` : ""}`
          )
        );
      });
    });

    return { done, getStderr: () => stderr };
  }

  private terminateChild(child: ChildProcess) {
    if (child.exitCode === null && !child.killed) {
      child.kill("SIGTERM");
    }
  }

  private async waitForStreamProcess(
    streamPromise: Promise<unknown>,
    processDone: Promise<void>,
    child: ChildProcess
  ) {
    // Stream errors and process exits race each other. Keep the first failure
    // so a database error is not hidden by a downstream EPIPE, and stop the
    // child if the local side of the stream fails first.
    let firstFailure: "stream" | "process" | null = null;

    const observedStream = streamPromise.then(
      () => undefined,
      (error) => {
        if (!firstFailure) firstFailure = "stream";
        this.terminateChild(child);
        throw error;
      }
    );

    const observedProcess = processDone.then(
      () => undefined,
      (error) => {
        if (!firstFailure) firstFailure = "process";
        this.terminateChild(child);
        throw error;
      }
    );

    const [streamResult, processResult] = await Promise.allSettled([
      observedStream,
      observedProcess,
    ]);

    if (firstFailure === "process" && processResult.status === "rejected") {
      throw processResult.reason;
    }
    if (streamResult.status === "rejected") {
      throw streamResult.reason;
    }
    if (processResult.status === "rejected") {
      throw processResult.reason;
    }
  }

  /**
   * Creates the database dump and writes it directly as gzip
   */
  async dumpDatabase(outputPath: string) {
    logger.info("Creating MySQL dump...");

    const connection = this.getDbConnection();
    const args = [
      "-h",
      connection.host,
      "-P",
      String(connection.port),
      "-u",
      connection.user,
      "--single-transaction",
      "--no-tablespaces",
      "--triggers",
      `--ignore-table=${connection.database}.kick_webhook_events`,
      connection.database,
    ];

    const child = spawn("mysqldump", args, {
      env: { ...process.env, MYSQL_PWD: connection.password },
      shell: false,
      stdio: ["ignore", "pipe", "pipe"],
    });
    const { done, getStderr } = this.observeProcess(child, "mysqldump");
    let dumpBytes = 0;

    try {
      child.stdout.on("data", (chunk: Buffer) => {
        dumpBytes += chunk.length;
      });

      await this.waitForStreamProcess(
        pipeline(
          child.stdout,
          zlib.createGzip(),
          createWriteStream(outputPath)
        ),
        done,
        child
      );

      // A gzip stream of an empty dump still has header/trailer bytes, so use
      // the uncompressed byte count as well as the output file size.
      const stats = await fs.stat(outputPath);
      if (stats.size === 0 || dumpBytes === 0) {
        throw new Error("The backup file is empty");
      }

      const stderr = getStderr().trim();
      if (stderr) {
        logger.warn("[Backup] mysqldump warnings:", stderr);
      }

      logger.info(
        `MySQL dump completed (${(stats.size / 1024 / 1024).toFixed(2)} MB compressed)`
      );
    } catch (error) {
      // Do not leave a partial gzip behind; it would look like a valid backup.
      try {
        await fs.unlink(outputPath);
      } catch (unlinkError) {
        if ((unlinkError as NodeJS.ErrnoException).code !== "ENOENT") {
          const unlinkMsg =
            unlinkError instanceof Error
              ? unlinkError.message
              : String(unlinkError);
          logger.warn(
            "[Backup] Could not remove incomplete backup:",
            unlinkMsg
          );
        }
      }

      const msg = error instanceof Error ? error.message : String(error);
      logger.error("[Backup] Detailed error:", msg);
      throw new Error(`Error creating MySQL dump: ${msg}`, {
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
   * Fetches all objects in the bucket, following pagination.
   * Pages depend on the previous continuation token, so they are
   * fetched sequentially via recursion.
   */
  private async listAllRemoteObjects(token?: string): Promise<_Object[]> {
    const page = await this.s3.send(
      new ListObjectsV2Command({
        Bucket: this.config.r2.bucketName,
        ContinuationToken: token,
      })
    );

    const contents = page.Contents ?? [];
    if (!page.IsTruncated) return contents;

    const rest = await this.listAllRemoteObjects(page.NextContinuationToken);
    return contents.concat(rest);
  }

  /**
   * Deletes remote backups older than the remote retention policy
   */
  async cleanRemoteBackups() {
    if (!this.r2Configured) return;

    const cutoffMs =
      Date.now() - this.config.remoteRetentionDays * 24 * 60 * 60 * 1000;

    try {
      const objects = await this.listAllRemoteObjects();
      const keysToDelete = objects
        .filter(
          (obj) =>
            obj.Key && obj.LastModified && obj.LastModified.getTime() < cutoffMs
        )
        .map((obj) => ({ Key: obj.Key as string }));

      // DeleteObjects accepts at most 1000 keys per request
      const chunks = Array.from(
        { length: Math.ceil(keysToDelete.length / 1000) },
        (_, i) => keysToDelete.slice(i * 1000, (i + 1) * 1000)
      );

      await Promise.all(
        chunks.map(async (chunk) => {
          await this.s3.send(
            new DeleteObjectsCommand({
              Bucket: this.config.r2.bucketName,
              Delete: { Objects: chunk },
            })
          );
          for (const { Key } of chunk) {
            logger.info(`Deleted old remote backup: ${Key}`);
          }
        })
      );

      logger.info(
        keysToDelete.length > 0
          ? `Cleaned ${keysToDelete.length} old remote backups`
          : "No old remote backups to clean"
      );
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
      const objects = await this.listAllRemoteObjects();
      const backups = objects
        .filter((obj) => obj.Key)
        .map((obj) => ({
          key: obj.Key as string,
          size: ((obj.Size || 0) / 1024 / 1024).toFixed(2) + " MB",
          date: obj.LastModified || new Date(0),
        }));

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
      throw new TypeError("Unexpected response body from R2");
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
      const candidates = files.filter(
        (file) => file.startsWith("backup-") && file.endsWith(".sql.gz")
      );

      const expired = (
        await Promise.all(
          candidates.map(async (file) => {
            const filePath = path.join(this.config.localPath, file);
            const stats = await fs.stat(filePath);
            return stats.mtime < cutoffDate ? filePath : null;
          })
        )
      ).filter((filePath): filePath is string => filePath !== null);

      await Promise.all(
        expired.map(async (filePath) => {
          await fs.unlink(filePath);
          logger.info(`Deleted old backup: ${path.basename(filePath)}`);
        })
      );

      if (expired.length > 0) {
        logger.info(`Cleaned ${expired.length} old backups`);
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
      const candidates = files.filter(
        (file) => file.startsWith("backup-") && file.endsWith(".sql.gz")
      );

      const backups = await Promise.all(
        candidates.map(async (file) => {
          const stats = await fs.stat(path.join(this.config.localPath, file));
          return {
            filename: file,
            size: (stats.size / 1024 / 1024).toFixed(2) + " MB",
            date: stats.mtime,
          };
        })
      );

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

      const connection = this.getDbConnection();
      const args = [
        "-h",
        connection.host,
        "-P",
        String(connection.port),
        "-u",
        connection.user,
        connection.database,
      ];

      const child = spawn("mysql", args, {
        env: { ...process.env, MYSQL_PWD: connection.password },
        shell: false,
        stdio: ["pipe", "ignore", "pipe"],
      });
      const { done, getStderr } = this.observeProcess(child, "mysql");

      await this.waitForStreamProcess(
        pipeline(
          createReadStream(backupPath),
          zlib.createGunzip(),
          child.stdin
        ),
        done,
        child
      );

      const stderr = getStderr().trim();
      if (stderr) {
        logger.warn("[Backup] mysql restore warnings:", stderr);
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
