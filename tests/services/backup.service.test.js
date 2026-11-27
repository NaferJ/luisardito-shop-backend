const { EventEmitter } = require("node:events");
const path = require("node:path");
const zlib = require("node:zlib");
const { Readable, Writable } = require("node:stream");

const mockSend = jest.fn();
const mockCommandInputs = {
  PutObjectCommand: [],
  ListObjectsV2Command: [],
  GetObjectCommand: [],
  DeleteObjectsCommand: [],
};
const mockCreateReadStream = jest.fn();
const mockCreateWriteStream = jest.fn();
const mockPipeline = jest.fn();
const mockSpawn = jest.fn();
const mockDbPassword = "super-secret-backup-password";

jest.mock("@aws-sdk/client-s3", () => {
  const makeCommand = (name) =>
    jest.fn().mockImplementation(function (input) {
      this.input = input;
      mockCommandInputs[name].push(input);
    });
  return {
    S3Client: jest.fn().mockImplementation(() => ({ send: mockSend })),
    PutObjectCommand: makeCommand("PutObjectCommand"),
    ListObjectsV2Command: makeCommand("ListObjectsV2Command"),
    GetObjectCommand: makeCommand("GetObjectCommand"),
    DeleteObjectsCommand: makeCommand("DeleteObjectsCommand"),
  };
});

jest.mock("node:child_process", () => ({
  spawn: mockSpawn,
}));

jest.mock("node:stream/promises", () => ({
  pipeline: mockPipeline,
}));

jest.mock("node:fs", () => {
  const actual = jest.requireActual("node:fs");
  return {
    ...actual,
    promises: {
      ...actual.promises,
      mkdir: jest.fn().mockResolvedValue(undefined),
      unlink: jest.fn().mockResolvedValue(undefined),
      stat: jest.fn().mockResolvedValue({ size: 2 * 1024 * 1024 }),
      readdir: jest.fn().mockResolvedValue([]),
      access: jest.fn().mockResolvedValue(undefined),
      rename: jest.fn().mockResolvedValue(undefined),
      open: jest.fn(),
    },
    createReadStream: mockCreateReadStream,
    createWriteStream: mockCreateWriteStream,
  };
});

jest.mock("../../src/services/healthchecks.service", () => ({
  pingHealthcheck: jest.fn().mockResolvedValue(undefined),
}));

jest.mock("../../config", () => ({
  db: {
    host: "db",
    port: 3306,
    user: "app",
    password: mockDbPassword,
    database: "luisardito_shop",
  },
  backup: {
    enabled: true,
    time: "03:00",
    retentionDays: 3,
    remoteRetentionDays: 30,
    r2: {
      endpoint: "https://account-id.r2.cloudflarestorage.com",
      accessKeyId: "test-access-key",
      secretAccessKey: "test-secret",
      bucketName: "luisardito-shop-backups",
    },
  },
  monitoring: {
    healthchecks: {
      backupUrl: "https://hc-ping.com/backup-check-uuid",
      heartbeatUrl: undefined,
    },
  },
}));

jest.mock("../../src/utils/logger", () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
}));

const backupService = require("../../src/services/backup.service");
const logger = require("../../src/utils/logger");
const fs = require("node:fs");
const { pingHealthcheck } = require("../../src/services/healthchecks.service");

const configuredR2 = () => ({
  endpoint: "https://account-id.r2.cloudflarestorage.com",
  accessKeyId: "test-access-key",
  secretAccessKey: "test-secret",
  bucketName: "luisardito-shop-backups",
});

const spawnedChildren = [];
const openedHandles = [];
let spawnBehavior = {
  exitCode: 0,
  stderr: "",
  stdoutData: "-- test sql\n",
};

function createMockChild(behavior) {
  const child = new EventEmitter();
  child.stdout = new EventEmitter();
  child.stdin = new EventEmitter();
  child.stderr = new EventEmitter();
  child.killed = false;
  child.exitCode = null;
  child.kill = jest.fn(() => {
    child.killed = true;
    return true;
  });

  setImmediate(() => {
    if (behavior.stdoutData) {
      child.stdout.emit("data", Buffer.from(behavior.stdoutData));
    }
    if (behavior.stderr) {
      child.stderr.emit("data", Buffer.from(behavior.stderr));
    }
    child.exitCode = behavior.exitCode;
    child.emit("close", behavior.exitCode, null);
  });

  return child;
}

function resetProcessMocks() {
  spawnedChildren.length = 0;
  spawnBehavior = {
    exitCode: 0,
    stderr: "",
    stdoutData: "-- test sql\n",
  };
  mockSpawn.mockImplementation(() => {
    const child = createMockChild(spawnBehavior);
    spawnedChildren.push(child);
    return child;
  });
  mockPipeline.mockResolvedValue(undefined);
  openedHandles.length = 0;
  fs.promises.open.mockImplementation(async (filePath) => {
    const handle = {
      filePath,
      createReadStream: jest.fn((options) => ({
        fake: "handle-read-stream",
        filePath,
        options,
      })),
      close: jest.fn().mockResolvedValue(undefined),
    };
    openedHandles.push(handle);
    return handle;
  });
  mockCreateReadStream.mockImplementation((filePath) => ({
    fake: "read-stream",
    filePath,
  }));
  mockCreateWriteStream.mockImplementation((filePath) => ({
    fake: "write-stream",
    filePath,
  }));
}

function resetBackupConfig() {
  backupService.config.enabled = true;
  backupService.config.dbHost = "db";
  backupService.config.dbPort = 3306;
  backupService.config.dbName = "luisardito_shop";
  backupService.config.dbUser = "app";
  backupService.config.dbPassword = mockDbPassword;
  backupService.config.r2 = configuredR2();
}

describe("backupService R2 remote tier", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    for (const inputs of Object.values(mockCommandInputs)) inputs.length = 0;
    resetProcessMocks();
    resetBackupConfig();
    // Avoid real mysqldump work in createBackup tests
    backupService.dumpDatabase = jest.fn().mockResolvedValue(undefined);
  });

  afterEach(() => {
    delete backupService.dumpDatabase;
  });

  test("uploadToR2 sends PutObjectCommand with bucket, key and content metadata", async () => {
    mockSend.mockResolvedValue({});

    const ok = await backupService.uploadToR2(
      "/tmp/backup-2026-11-21.sql.gz",
      "backup-2026-11-21.sql.gz"
    );

    expect(ok).toBe(true);
    expect(mockSend).toHaveBeenCalledTimes(1);
    expect(mockCommandInputs.PutObjectCommand).toHaveLength(1);
    expect(mockCommandInputs.PutObjectCommand[0]).toMatchObject({
      Bucket: "luisardito-shop-backups",
      Key: "backup-2026-11-21.sql.gz",
      ContentType: "application/gzip",
      ContentLength: 2 * 1024 * 1024,
    });
  });

  test("uploadToR2 returns false when the R2 upload fails", async () => {
    mockSend.mockRejectedValue(new Error("network down"));

    const ok = await backupService.uploadToR2(
      "/tmp/backup-2026-11-21.sql.gz",
      "backup-2026-11-21.sql.gz"
    );

    expect(ok).toBe(false);
  });

  test("skips remote upload with a warning when R2 vars are missing", async () => {
    backupService.config.r2 = {
      endpoint: undefined,
      accessKeyId: undefined,
      secretAccessKey: undefined,
      bucketName: undefined,
    };

    const result = await backupService.createBackup();

    expect(result.success).toBe(true);
    expect(logger.warn).toHaveBeenCalledWith(
      "R2 not configured, skipping remote upload"
    );
    expect(mockSend).not.toHaveBeenCalled();
  });

  test("cleanRemoteBackups issues DeleteObjects only for keys older than the retention cutoff", async () => {
    const oldDate = new Date(Date.now() - 40 * 24 * 60 * 60 * 1000);
    const newDate = new Date();
    mockSend
      .mockResolvedValueOnce({
        Contents: [
          { Key: "backup-old.sql.gz", LastModified: oldDate },
          { Key: "backup-new.sql.gz", LastModified: newDate },
        ],
        IsTruncated: false,
      })
      .mockResolvedValueOnce({});

    await backupService.cleanRemoteBackups();

    expect(mockCommandInputs.ListObjectsV2Command).toHaveLength(1);
    expect(mockCommandInputs.DeleteObjectsCommand).toHaveLength(1);
    expect(mockCommandInputs.DeleteObjectsCommand[0].Delete.Objects).toEqual([
      { Key: "backup-old.sql.gz" },
    ]);
  });

  test("createBackup returns a disabled result when backups are disabled", async () => {
    backupService.config.enabled = false;

    const result = await backupService.createBackup();

    expect(result).toEqual({ success: false, reason: "disabled" });
    expect(mockSend).not.toHaveBeenCalled();
    expect(pingHealthcheck).not.toHaveBeenCalled();
  });

  test("createBackup pings the backup healthcheck on success", async () => {
    backupService.uploadToR2 = jest.fn().mockResolvedValue(true);

    const result = await backupService.createBackup();

    expect(result.success).toBe(true);
    expect(pingHealthcheck).toHaveBeenCalledWith(
      "https://hc-ping.com/backup-check-uuid",
      false
    );
  });

  test("createBackup pings the backup failure endpoint when the backup fails", async () => {
    backupService.dumpDatabase.mockRejectedValue(new Error("dump failed"));

    const result = await backupService.createBackup();

    expect(result.success).toBe(false);
    expect(pingHealthcheck).toHaveBeenCalledWith(
      "https://hc-ping.com/backup-check-uuid",
      true
    );
  });

  test("createBackup pings the failure endpoint when the R2 upload fails", async () => {
    backupService.uploadToR2 = jest.fn().mockResolvedValue(false);

    const result = await backupService.createBackup();

    expect(result.success).toBe(true);
    expect(pingHealthcheck).toHaveBeenCalledWith(
      "https://hc-ping.com/backup-check-uuid",
      true
    );
  });

  test("downloadRemoteBackup writes to a unique partial file and renames it into place", async () => {
    const filename = "backup-2026-11-21.sql.gz";
    const destPath = path.join(backupService.config.localPath, filename);
    mockSend.mockResolvedValue({ Body: Readable.from([Buffer.from("gz")]) });

    const result = await backupService.downloadRemoteBackup(filename);

    expect(result).toBe(destPath);
    const [partialPath] = mockCreateWriteStream.mock.calls[0];
    expect(partialPath.startsWith(`${destPath}.`)).toBe(true);
    expect(partialPath).toMatch(/\.[0-9a-f-]{36}\.partial$/);
    expect(fs.promises.rename).toHaveBeenCalledWith(partialPath, destPath);
  });

  test("downloadRemoteBackup removes the partial file when the download fails", async () => {
    mockSend.mockResolvedValue({ Body: Readable.from([Buffer.from("gz")]) });
    mockPipeline.mockRejectedValueOnce(new Error("connection reset"));

    await expect(
      backupService.downloadRemoteBackup("backup-2026-11-21.sql.gz")
    ).rejects.toThrow("connection reset");

    const [partialPath] = mockCreateWriteStream.mock.calls[0];
    expect(fs.promises.unlink).toHaveBeenCalledWith(partialPath);
    expect(fs.promises.rename).not.toHaveBeenCalled();
  });

  test("downloadRemoteBackup rejects path traversal filenames", async () => {
    await expect(
      backupService.downloadRemoteBackup("../evil.sql.gz")
    ).rejects.toThrow("Invalid backup filename");
    expect(mockSend).not.toHaveBeenCalled();
  });
});

describe("backupService MySQL process execution", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    for (const inputs of Object.values(mockCommandInputs)) inputs.length = 0;
    resetProcessMocks();
    resetBackupConfig();
  });

  test("dumpDatabase spawns mysqldump without a shell and keeps the password out of argv", async () => {
    const outputPath = "/tmp/backup-2026-11-21.sql.gz";

    await backupService.dumpDatabase(outputPath);

    expect(mockSpawn).toHaveBeenCalledTimes(1);
    const [command, args, options] = mockSpawn.mock.calls[0];
    expect(command).toBe("mysqldump");
    expect(args).toEqual([
      "-h",
      "db",
      "-P",
      "3306",
      "-u",
      "app",
      "--single-transaction",
      "--no-tablespaces",
      "--triggers",
      "--ignore-table=luisardito_shop.kick_webhook_events",
      "luisardito_shop",
    ]);
    expect(options).toMatchObject({
      shell: false,
      stdio: ["ignore", "pipe", "pipe"],
    });
    expect(options.env.MYSQL_PWD).toBe(mockDbPassword);
    expect(args.some((arg) => arg.includes(mockDbPassword))).toBe(false);

    expect(fs.createWriteStream).toHaveBeenCalledWith(`${outputPath}.partial`);
    expect(mockPipeline).toHaveBeenCalledTimes(1);
    const [source, gzipStream, destination] = mockPipeline.mock.calls[0];
    expect(source).toBe(spawnedChildren[0].stdout);
    expect(gzipStream).toBeInstanceOf(zlib.Gzip);
    expect(destination).toBe(mockCreateWriteStream.mock.results[0].value);
    expect(fs.promises.rename).toHaveBeenCalledWith(
      `${outputPath}.partial`,
      outputPath
    );
  });

  test("dumpDatabase fails when mysqldump exits non-zero", async () => {
    spawnBehavior = {
      exitCode: 2,
      stderr: "access denied",
      stdoutData: "",
    };

    await expect(
      backupService.dumpDatabase("/tmp/backup-2026-11-21.sql.gz")
    ).rejects.toThrow("mysqldump failed with exit code 2");
    expect(fs.promises.unlink).toHaveBeenCalledWith(
      "/tmp/backup-2026-11-21.sql.gz.partial"
    );
    expect(fs.promises.rename).not.toHaveBeenCalled();
  });

  test("cleanOldBackups expires only the staging files left by an interrupted dump or download", async () => {
    const oldMtime = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000);
    const staging = [
      "backup-old.sql.gz.partial",
      "backup-old.sql.gz.0b6a3c1e-2f4d-4e8a-9c7b-5d1e2f3a4b5c.partial",
    ];
    fs.promises.readdir.mockResolvedValueOnce([
      ...staging,
      "backup-notes.partial",
      "backup-old.sql.gz.copy.partial",
      "unrelated.partial",
    ]);
    fs.promises.stat.mockResolvedValue({ size: 10, mtime: oldMtime });

    await backupService.cleanOldBackups();

    expect(fs.promises.unlink.mock.calls).toEqual(
      staging.map((file) => [path.join(backupService.config.localPath, file)])
    );
  });

  test("restoreBackup streams the gunzipped backup into mysql without a shell and keeps the password out of argv", async () => {
    const filename = "backup-2026-11-21.sql.gz";
    const backupPath = path.join(process.cwd(), "backups", "local", filename);

    const result = await backupService.restoreBackup(filename);

    expect(result).toEqual({ success: true });
    expect(mockSpawn).toHaveBeenCalledTimes(1);
    const [command, args, options] = mockSpawn.mock.calls[0];
    expect(command).toBe("mysql");
    expect(args).toEqual([
      "-h",
      "db",
      "-P",
      "3306",
      "-u",
      "app",
      "luisardito_shop",
    ]);
    expect(options).toMatchObject({
      shell: false,
      stdio: ["pipe", "ignore", "pipe"],
    });
    expect(options.env.MYSQL_PWD).toBe(mockDbPassword);
    expect(args.some((arg) => arg.includes(mockDbPassword))).toBe(false);

    expect(fs.promises.open).toHaveBeenCalledTimes(1);
    expect(fs.promises.open).toHaveBeenCalledWith(backupPath, "r");
    expect(fs.createReadStream).not.toHaveBeenCalled();
    const [handle] = openedHandles;
    expect(handle.createReadStream).toHaveBeenCalledTimes(2);
    for (const call of handle.createReadStream.mock.calls) {
      expect(call[0]).toEqual({ start: 0, autoClose: false });
    }

    expect(mockPipeline).toHaveBeenCalledTimes(2);
    const [verifySource, verifyGunzip, sink] = mockPipeline.mock.calls[0];
    expect(verifySource).toBe(handle.createReadStream.mock.results[0].value);
    expect(verifyGunzip).toBeInstanceOf(zlib.Gunzip);
    expect(sink).toBeInstanceOf(Writable);

    const [source, gunzipStream, destination] = mockPipeline.mock.calls[1];
    expect(source).toBe(handle.createReadStream.mock.results[1].value);
    expect(gunzipStream).toBeInstanceOf(zlib.Gunzip);
    expect(destination).toBe(spawnedChildren[0].stdin);
    expect(handle.close).toHaveBeenCalledTimes(1);
  });

  test("restoreBackup imports the verified file even if the path is replaced after verification", async () => {
    const realFs = jest.requireActual("node:fs");
    const { pipeline: realPipeline } = jest.requireActual(
      "node:stream/promises"
    );
    const os = require("node:os");
    const dir = realFs.mkdtempSync(path.join(os.tmpdir(), "restore-test-"));
    const filename = "backup-2026-11-21.sql.gz";
    const backupPath = path.join(dir, filename);
    const verifiedSql = "INSERT INTO usuarios VALUES (1);\n".repeat(100);
    realFs.writeFileSync(backupPath, zlib.gzipSync(verifiedSql));
    const originalLocalPath = backupService.config.localPath;
    backupService.config.localPath = dir;

    fs.promises.open.mockImplementation((...args) =>
      realFs.promises.open(...args)
    );
    let pipelineCalls = 0;
    mockPipeline.mockImplementation(async (...streams) => {
      await realPipeline(...streams);
      pipelineCalls += 1;
      if (pipelineCalls === 1) {
        // Simulate retention or a download swapping the file mid-restore.
        realFs.unlinkSync(backupPath);
        realFs.writeFileSync(backupPath, Buffer.from("not gzip"));
      }
    });
    const received = [];
    mockSpawn.mockImplementation(() => {
      const child = new EventEmitter();
      child.stderr = new EventEmitter();
      child.killed = false;
      child.exitCode = null;
      child.kill = jest.fn();
      child.stdin = new Writable({
        write(chunk, _encoding, callback) {
          received.push(chunk);
          callback();
        },
      });
      child.stdin.on("finish", () => {
        child.exitCode = 0;
        child.emit("close", 0, null);
      });
      return child;
    });

    try {
      const result = await backupService.restoreBackup(filename);

      expect(result).toEqual({ success: true });
      expect(Buffer.concat(received).toString()).toBe(verifiedSql);
    } finally {
      backupService.config.localPath = originalLocalPath;
      realFs.rmSync(dir, { recursive: true, force: true });
    }
  });

  test("restoreBackup never starts mysql when the archive is truncated", async () => {
    const realFs = jest.requireActual("node:fs");
    const { pipeline: realPipeline } = jest.requireActual(
      "node:stream/promises"
    );
    const os = require("node:os");
    const dir = realFs.mkdtempSync(path.join(os.tmpdir(), "restore-test-"));
    const filename = "backup-2026-11-21.sql.gz";
    const sql =
      "DROP TABLE IF EXISTS usuarios;\nCREATE TABLE usuarios (id INT);\n";
    const gzipped = zlib.gzipSync(Buffer.from(sql.repeat(200)));
    realFs.writeFileSync(
      path.join(dir, filename),
      gzipped.subarray(0, gzipped.length - 8)
    );
    const originalLocalPath = backupService.config.localPath;
    backupService.config.localPath = dir;

    let handle;
    fs.promises.open.mockImplementation(async (...args) => {
      handle = await realFs.promises.open(...args);
      jest.spyOn(handle, "close");
      return handle;
    });
    mockPipeline.mockImplementation(realPipeline);

    try {
      const result = await backupService.restoreBackup(filename);

      expect(result.success).toBe(false);
      expect(result.error).toMatch(/unexpected end of file/i);
      expect(mockSpawn).not.toHaveBeenCalled();
      expect(handle.close).toHaveBeenCalled();
      // A closed FileHandle reports fd -1.
      expect(handle.fd).toBe(-1);
      expect(logger.warn).not.toHaveBeenCalledWith(
        "[Backup] Could not close the backup file:",
        expect.anything()
      );
    } finally {
      backupService.config.localPath = originalLocalPath;
      realFs.rmSync(dir, { recursive: true, force: true });
    }
  });
});
