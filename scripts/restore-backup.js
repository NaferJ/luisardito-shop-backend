#!/usr/bin/env node

/**
 * Emergency backup restoration helper.
 *
 * Requires `npm run build` first (loads compiled output from dist/).
 * Usage:
 *   node scripts/restore-backup.js                       # Restore the most recent backup
 *   node scripts/restore-backup.js backup-2025-12-02.sql.gz  # Restore a specific backup
 */

const backupService = require("../dist/src/services/backup.service");
const readline = require("readline");

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

function promptUser(question) {
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      resolve(answer);
    });
  });
}

async function main() {
  console.log("\nBACKUP RESTORATION SCRIPT\n");

  try {
    const localBackups = await backupService.listBackups();
    const remoteBackups = await backupService.listRemoteBackups();

    // Remote backups that are not already downloaded locally
    const localFilenames = new Set(localBackups.map((b) => b.filename));
    const remoteOnly = remoteBackups.filter((b) => !localFilenames.has(b.key));

    const options = [
      ...localBackups.map((b) => ({
        filename: b.filename,
        size: b.size,
        date: b.date,
        remote: false,
      })),
      ...remoteOnly.map((b) => ({
        filename: b.key,
        size: b.size,
        date: b.date,
        remote: true,
      })),
    ];

    if (options.length === 0) {
      console.log("No backups available locally or in R2");
      console.log("Check the R2 configuration or create a backup first");
      process.exit(1);
    }

    console.log("Available backups:\n");
    options.forEach((backup, index) => {
      const tag = backup.remote ? " [remote]" : "";
      console.log(`  ${index + 1}. ${backup.filename}${tag}`);
      console.log(`     Size: ${backup.size}`);
      console.log(`     Date: ${backup.date.toLocaleString()}`);
      console.log("");
    });

    let selectedBackup;
    const filename = process.argv[2];

    if (filename) {
      selectedBackup = options.find((b) => b.filename === filename);
      if (!selectedBackup) {
        console.log(`Backup not found: ${filename}`);
        process.exit(1);
      }
    } else {
      selectedBackup = options[0];
    }

    console.log(`Selected backup: ${selectedBackup.filename}`);
    console.log(`Date: ${selectedBackup.date.toLocaleString()}`);
    console.log(`Size: ${selectedBackup.size}\n`);

    if (selectedBackup.remote) {
      console.log("Downloading backup from R2...");
      await backupService.downloadRemoteBackup(selectedBackup.filename);
    }

    console.log("WARNING: This operation will overwrite the current database");
    console.log("Make sure to create a recent backup first if needed\n");

    const confirm = await promptUser(
      'Are you sure you want to continue? (type "YES" to confirm): '
    );

    if (confirm.trim().toUpperCase() !== "YES") {
      console.log("\nRestoration cancelled");
      process.exit(0);
    }

    console.log("\nStarting restoration...\n");

    const result = await backupService.restoreBackup(selectedBackup.filename);

    if (result.success) {
      console.log("\nBackup restored successfully!");
      console.log("Restart the application if necessary");
    } else {
      console.log("\nError restoring backup:", result.error);
      process.exit(1);
    }
  } catch (error) {
    console.error("\nFatal error:", error.message);
    process.exit(1);
  } finally {
    rl.close();
  }
}

main();
