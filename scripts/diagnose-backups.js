/**
 * Backup system diagnostic helper.
 *
 * Requires `npm run build` first (loads compiled output from dist/).
 * Usage: node scripts/diagnose-backups.js
 */

require("dotenv").config();

const backupService = require("../dist/src/services/backup.service");
const backupScheduler = require("../dist/src/services/backup.task");
const fs = require("fs");

async function diagnoseBackups() {
  console.log("Backup System Diagnostic\n");

  // 1. Verify configuration
  console.log("1. Configuration:");
  console.log("   BACKUP_ENABLED:", process.env.BACKUP_ENABLED);
  console.log("   BACKUP_TIME:", process.env.BACKUP_TIME);
  console.log("   BACKUP_RETENTION_DAYS:", process.env.BACKUP_RETENTION_DAYS);
  console.log(
    "   BACKUP_REMOTE_RETENTION_DAYS:",
    process.env.BACKUP_REMOTE_RETENTION_DAYS
  );
  console.log(
    "   R2_ENDPOINT:",
    process.env.R2_ENDPOINT ? "Configured" : "Missing"
  );
  console.log(
    "   R2_ACCESS_KEY_ID:",
    process.env.R2_ACCESS_KEY_ID ? "Configured" : "Missing"
  );
  console.log(
    "   R2_SECRET_ACCESS_KEY:",
    process.env.R2_SECRET_ACCESS_KEY ? "Configured" : "Missing"
  );
  console.log(
    "   R2_BUCKET_NAME:",
    process.env.R2_BUCKET_NAME ? "Configured" : "Missing"
  );
  console.log("");

  // 2. Verify scheduler
  console.log("2. Scheduler:");
  try {
    backupScheduler.start();
    console.log("   Scheduler initialized successfully");
  } catch (error) {
    console.log("   Error initializing scheduler:", error.message);
  }
  console.log("");

  // 3. Verify directories
  console.log("3. Directories:");
  const localPath = backupService.config.localPath;

  console.log(
    "   Local path:",
    localPath,
    fs.existsSync(localPath) ? "Exists" : "Missing"
  );
  console.log("");

  // 4. Verify existing backups
  console.log("4. Existing backups:");
  try {
    const backups = await backupService.listBackups();
    if (backups.length > 0) {
      console.log("   Found", backups.length, "backups:");
      backups.slice(-3).forEach((backup) => {
        console.log(
          "     -",
          backup.filename,
          `(${backup.size}) - ${backup.date.toISOString().split("T")[0]}`
        );
      });
    } else {
      console.log("   No backups found");
    }
  } catch (error) {
    console.log("   Error listing backups:", error.message);
  }
  console.log("");

  // 5. Configuration test
  console.log("5. Configuration test:");
  if (process.env.BACKUP_ENABLED === "true") {
    console.log("   Backups enabled");
  } else {
    console.log("   Backups disabled (BACKUP_ENABLED != true)");
  }

  if (backupService.r2Configured) {
    console.log("   R2 configured");
  } else {
    console.log("   R2 missing configuration");
  }
  console.log("");

  // 6. Verify R2 connectivity and remote backups
  console.log("6. R2 remote storage:");
  try {
    const connected = await backupService.checkR2Connection();
    if (connected) {
      console.log("   R2 connection: OK");
      const remoteBackups = await backupService.listRemoteBackups();
      console.log("   Remote backups found:", remoteBackups.length);
    } else {
      console.log("   R2 connection: FAILED (or not configured)");
    }
  } catch (error) {
    console.log("   Error checking R2:", error.message);
  }
  console.log("");

  console.log("\nDiagnostic completed");
}

diagnoseBackups().catch(console.error);
