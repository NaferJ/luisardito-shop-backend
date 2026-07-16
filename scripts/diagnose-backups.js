/**
 * Backup system diagnostic helper.
 *
 * Requires `npm run build` first (loads compiled output from dist/).
 * Usage: node scripts/diagnose-backups.js
 */

require("dotenv").config();

const backupService = require("./dist/src/services/backup.service");
const backupScheduler = require("./dist/src/services/backup.task");
const fs = require("fs");
const path = require("path");

async function diagnoseBackups() {
  console.log("Backup System Diagnostic\n");

  // 1. Verify configuration
  console.log("1. Configuration:");
  console.log("   BACKUP_ENABLED:", process.env.BACKUP_ENABLED);
  console.log("   BACKUP_TIME:", process.env.BACKUP_TIME);
  console.log(
    "   BACKUP_GITHUB_TOKEN:",
    process.env.BACKUP_GITHUB_TOKEN ? "Configured" : "Missing"
  );
  console.log("   BACKUP_GITHUB_REPO_URL:", process.env.BACKUP_GITHUB_REPO_URL);
  console.log(
    "   BACKUP_GITHUB_USER_EMAIL:",
    process.env.BACKUP_GITHUB_USER_EMAIL
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
  const localPath = path.join(__dirname, "backups/local");
  const githubPath = path.join(__dirname, "backups/github");

  console.log(
    "   Local path:",
    localPath,
    fs.existsSync(localPath) ? "Exists" : "Missing"
  );
  console.log(
    "   GitHub path:",
    githubPath,
    fs.existsSync(githubPath) ? "Exists" : "Missing"
  );

  const gitPath = path.join(githubPath, ".git");
  console.log(
    "   GitHub .git:",
    gitPath,
    fs.existsSync(gitPath) ? "Initialized" : "Not initialized"
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

  if (process.env.BACKUP_GITHUB_TOKEN) {
    console.log("   GitHub token configured");
  } else {
    console.log("   GitHub token missing");
  }

  // 6. Verify GitHub repository state
  console.log("6. GitHub repository state:");
  if (fs.existsSync(gitPath)) {
    try {
      const { execFileSync } = require("child_process");
      // Absolute git path to avoid PATH injection (S4036)
      const gitBin = process.platform === "win32" ? "git" : "/usr/bin/git";
      const lastCommit = execFileSync(gitBin, ["log", "-1", "--oneline"], {
        cwd: githubPath,
        encoding: "utf8",
      }).trim();
      console.log("   Last commit:", lastCommit);

      const status = execFileSync(gitBin, ["status", "--porcelain"], {
        cwd: githubPath,
        encoding: "utf8",
      }).trim();
      console.log("   Repo status:", status || "Clean");
    } catch (error) {
      console.log("   Error verifying repo:", error.message);
    }
  } else {
    console.log("   Repository not initialized");
  }
  console.log("");

  console.log("\nDiagnostic completed");
}

diagnoseBackups().catch(console.error);
