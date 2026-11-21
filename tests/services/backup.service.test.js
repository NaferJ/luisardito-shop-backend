const mockSend = jest.fn();
const mockCommandInputs = {
  PutObjectCommand: [],
  ListObjectsV2Command: [],
  GetObjectCommand: [],
  DeleteObjectsCommand: [],
};

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
    },
    createReadStream: jest.fn().mockReturnValue({ fake: "read-stream" }),
  };
});

jest.mock("../../config", () => ({
  db: { database: "luisardito_shop" },
  backup: {
    enabled: true,
    time: "03:00",
    retentionDays: 3,
    remoteRetentionDays: 30,
    dbContainer: "luisardito-mysql",
    dbUser: "root",
    dbPassword: "root",
    r2: {
      endpoint: "https://account-id.r2.cloudflarestorage.com",
      accessKeyId: "test-access-key",
      secretAccessKey: "test-secret",
      bucketName: "luisardito-shop-backups",
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

const configuredR2 = () => ({
  endpoint: "https://account-id.r2.cloudflarestorage.com",
  accessKeyId: "test-access-key",
  secretAccessKey: "test-secret",
  bucketName: "luisardito-shop-backups",
});

describe("backupService R2 remote tier", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    for (const inputs of Object.values(mockCommandInputs)) inputs.length = 0;
    backupService.config.enabled = true;
    backupService.config.r2 = configuredR2();
    // Avoid real docker/mysqldump/gzip work in createBackup tests
    backupService.dumpDatabase = jest.fn().mockResolvedValue(undefined);
    backupService.compressBackup = jest.fn().mockResolvedValue(undefined);
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
  });

  test("downloadRemoteBackup rejects path traversal filenames", async () => {
    await expect(
      backupService.downloadRemoteBackup("../evil.sql.gz")
    ).rejects.toThrow("Invalid backup filename");
    expect(mockSend).not.toHaveBeenCalled();
  });
});
