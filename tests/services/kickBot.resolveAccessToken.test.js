jest.useFakeTimers();

jest.mock("axios");

jest.mock("../../config", () => ({
  kick: { apiBaseUrl: "https://api.kick.com" },
  kickBot: {
    username: "testbot",
    clientId: "test-client-id",
    clientSecret: "test-client-secret",
    redirectUri: "https://example.com/callback",
  },
}));

jest.mock("../../src/models/kickBotToken.model", () => ({
  findAll: jest.fn(),
}));

jest.mock("../../src/utils/logger", () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
}));

const KickBotToken = require("../../src/models/kickBotToken.model");
const kickBotService = require("../../src/services/kickBot.service");

const NOW = new Date("2025-01-01T00:00:00Z").getTime();

describe("KickBotService.resolveAccessToken characterization", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.setSystemTime(NOW);
    kickBotService._refreshInFlight.clear();
    kickBotService.refreshToken = jest.fn();
    kickBotService.readTokensFromFile = jest.fn();
    kickBotService.refreshAccessToken = jest.fn();
  });

  afterAll(() => {
    jest.useRealTimers();
  });

  function buildRecord(overrides = {}) {
    return {
      id: 1,
      kick_username: "testbot",
      access_token: "db-access-token-1",
      token_expires_at: new Date(NOW + 60 * 60 * 1000).toISOString(),
      ...overrides,
    };
  }

  test("DB: valid token (>45min) is returned as-is", async () => {
    const record = buildRecord({
      token_expires_at: new Date(NOW + 60 * 60 * 1000).toISOString(),
    });
    KickBotToken.findAll.mockResolvedValue([record]);

    const result = await kickBotService.resolveAccessToken();

    expect(result).toBe("db-access-token-1");
    expect(kickBotService.refreshToken).not.toHaveBeenCalled();
  });

  test("DB: expired token triggers refreshToken and returns new access_token", async () => {
    const record = buildRecord({
      token_expires_at: new Date(NOW - 10 * 60 * 1000).toISOString(),
    });
    KickBotToken.findAll.mockResolvedValue([record]);
    kickBotService.refreshToken.mockResolvedValue({
      access_token: "new-access-token",
    });

    const result = await kickBotService.resolveAccessToken();

    expect(kickBotService.refreshToken).toHaveBeenCalledWith(record);
    expect(result).toBe("new-access-token");
  });

  test("DB: token expiring in <45min (not yet expired) triggers proactive renew", async () => {
    const record = buildRecord({
      token_expires_at: new Date(NOW + 30 * 60 * 1000).toISOString(),
    });
    KickBotToken.findAll.mockResolvedValue([record]);
    kickBotService.refreshToken.mockResolvedValue({
      access_token: "renewed-token",
    });

    const result = await kickBotService.resolveAccessToken();

    expect(kickBotService.refreshToken).toHaveBeenCalledWith(record);
    expect(result).toBe("renewed-token");
  });

  test("DB: refreshToken throws for first record, falls through to next valid record", async () => {
    const expiredRecord = buildRecord({
      id: 1,
      kick_username: "testbot",
      access_token: "expired-token",
      token_expires_at: new Date(NOW - 10 * 60 * 1000).toISOString(),
    });
    const validRecord = buildRecord({
      id: 2,
      kick_username: "testbot2",
      access_token: "valid-token-2",
      token_expires_at: new Date(NOW + 60 * 60 * 1000).toISOString(),
    });
    KickBotToken.findAll.mockResolvedValue([expiredRecord, validRecord]);
    kickBotService.refreshToken.mockRejectedValue(new Error("refresh failed"));

    const result = await kickBotService.resolveAccessToken();

    expect(kickBotService.refreshToken).toHaveBeenCalledWith(expiredRecord);
    expect(result).toBe("valid-token-2");
  });

  test("DB: findAll throws, falls through to file branch", async () => {
    KickBotToken.findAll.mockRejectedValue(new Error("DB connection failed"));
    kickBotService.readTokensFromFile.mockResolvedValue({
      accessToken: "file-token",
      expiresAt: NOW + 60 * 60 * 1000,
    });

    const result = await kickBotService.resolveAccessToken();

    expect(result).toBe("file-token");
  });

  test("File: valid file token (>45min) is returned", async () => {
    KickBotToken.findAll.mockResolvedValue([]);
    kickBotService.readTokensFromFile.mockResolvedValue({
      accessToken: "file-token",
      expiresAt: NOW + 60 * 60 * 1000,
    });

    const result = await kickBotService.resolveAccessToken();

    expect(result).toBe("file-token");
    expect(kickBotService.refreshAccessToken).not.toHaveBeenCalled();
  });

  test("File: file token about to expire triggers refreshAccessToken", async () => {
    KickBotToken.findAll.mockResolvedValue([]);
    kickBotService.readTokensFromFile.mockResolvedValue({
      accessToken: "file-token",
      expiresAt: NOW + 30 * 60 * 1000,
    });
    kickBotService.refreshAccessToken.mockResolvedValue("refreshed-file-token");

    const result = await kickBotService.resolveAccessToken();

    expect(kickBotService.refreshAccessToken).toHaveBeenCalled();
    expect(result).toBe("refreshed-file-token");
  });

  test("File: readTokensFromFile throws, falls through to null", async () => {
    KickBotToken.findAll.mockResolvedValue([]);
    kickBotService.readTokensFromFile.mockRejectedValue(
      new Error("file read error")
    );

    const result = await kickBotService.resolveAccessToken();

    expect(result).toBeNull();
  });

  test("Nothing available returns null", async () => {
    KickBotToken.findAll.mockResolvedValue([]);
    kickBotService.readTokensFromFile.mockResolvedValue(null);

    const result = await kickBotService.resolveAccessToken();

    expect(result).toBeNull();
  });
});
