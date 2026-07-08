const axios = require("axios");

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

jest.mock("../../src/models/kickBotToken.model", () => ({}));

jest.mock("../../src/utils/logger", () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
}));

const kickBotService = require("../../src/services/kickBot.service");

describe("KickBotService.refreshToken single-flight", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    kickBotService._refreshInFlight.clear();
    kickBotService.writeTokensToFile = jest.fn().mockResolvedValue();
  });

  function buildRecord(overrides = {}) {
    return {
      id: 1,
      kick_username: "testbot",
      refresh_token: "old-refresh-token",
      access_token: "old-access-token",
      update: jest.fn().mockImplementation(function (values) {
        Object.assign(this, values);
        return Promise.resolve(this);
      }),
      ...overrides,
    };
  }

  function mockTokenResponse() {
    axios.post.mockResolvedValue({
      data: {
        access_token: "new-access-token",
        refresh_token: "new-refresh-token",
        expires_in: 3600,
      },
    });
  }

  test("concurrent calls share a single axios.post and resolve to the same record", async () => {
    mockTokenResponse();
    const record = buildRecord();

    const p1 = kickBotService.refreshToken(record);
    const p2 = kickBotService.refreshToken(record);
    const [r1, r2] = await Promise.all([p1, p2]);

    expect(axios.post).toHaveBeenCalledTimes(1);
    expect(r1).toBe(r2);
    expect(r1).toBe(record);
    expect(record.update).toHaveBeenCalledTimes(1);
  });

  test("after the in-flight promise settles, a subsequent call triggers a new axios.post", async () => {
    mockTokenResponse();
    const record = buildRecord();

    await kickBotService.refreshToken(record);
    expect(axios.post).toHaveBeenCalledTimes(1);

    await kickBotService.refreshToken(record);
    expect(axios.post).toHaveBeenCalledTimes(2);
  });
});
