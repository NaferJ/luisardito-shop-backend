#!/usr/bin/env node

/**
 * Emergency backup restoration helper.
 *
 * Requires `npm run build` first (loads compiled output from dist/).
 * Usage:
 *   node scripts/restore-backup.js                       # Restore the most recent backup
 *   node scripts/restore-backup.js backup-2025-12-02.sql.gz  # Restore a specific backup
 */

const backupService = require("./dist/src/services/backup.service");
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
    const backups = await backupService.listBackups();

    if (backups.length === 0) {
      console.log("No local backups available");
      console.log("Download a backup from GitHub first");
      process.exit(1);
    }

    console.log("Available backups:\n");
    backups.forEach((backup, index) => {
      console.log(`  ${index + 1}. ${backup.filename}`);
      console.log(`     Size: ${backup.size}`);
      console.log(`     Date: ${backup.date.toLocaleString()}`);
      console.log("");
    });

    let selectedBackup;
    const filename = process.argv[2];

    if (filename) {
      selectedBackup = backups.find((b) => b.filename === filename);
      if (!selectedBackup) {
        console.log(`Backup not found: ${filename}`);
        process.exit(1);
      }
    } else {
      selectedBackup = backups[0];
    }

    console.log(`Selected backup: ${selectedBackup.filename}`);
    console.log(`Date: ${selectedBackup.date.toLocaleString()}`);
    console.log(`Size: ${selectedBackup.size}\n`);

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
