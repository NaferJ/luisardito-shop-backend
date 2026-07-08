const axios = require("axios");

jest.mock("axios");

jest.mock("../../config", () => ({
  kick: {
    apiBaseUrl: "https://api.kick.com",
    clientId: "test-client-id",
    clientSecret: "test-client-secret",
  },
}));

jest.mock("../../src/utils/logger", () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
}));

jest.mock("../../src/models", () => ({
  KickEventSubscription: {},
  KickBroadcasterToken: {},
}));

const {
  refreshAccessToken,
  refreshInFlight,
} = require("../../src/services/kickAutoSubscribe.service");

describe("kickAutoSubscribe.refreshAccessToken deactivation", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    refreshInFlight.clear();
  });

  function buildRecord(overrides = {}) {
    return {
      id: 1,
      kick_user_id: "12345",
      kick_username: "broadcaster1",
      refresh_token: "old-refresh-token",
      access_token: "old-access-token",
      update: jest.fn().mockImplementation(function (values) {
        Object.assign(this, values);
        return Promise.resolve(this);
      }),
      ...overrides,
    };
  }

  test("deactivates the token when Kick returns 401", async () => {
    axios.post.mockRejectedValue({
      response: { status: 401, data: "invalid_grant" },
    });

    const record = buildRecord();
    const result = await refreshAccessToken(record);

    expect(result).toBe(false);
    expect(record.update).toHaveBeenCalledWith(
      expect.objectContaining({ is_active: false })
    );
  });

  test("deactivates the token when Kick returns 400", async () => {
    axios.post.mockRejectedValue({
      response: { status: 400, data: "invalid_request" },
    });

    const record = buildRecord();
    const result = await refreshAccessToken(record);

    expect(result).toBe(false);
    expect(record.update).toHaveBeenCalledWith(
      expect.objectContaining({ is_active: false })
    );
  });

  test("does NOT deactivate on a transient error (ECONNRESET)", async () => {
    axios.post.mockRejectedValue({ code: "ECONNRESET" });

    const record = buildRecord();
    const result = await refreshAccessToken(record);

    expect(result).toBe(false);
    const deactivationCalls = record.update.mock.calls.filter(
      ([values]) => values && values.is_active === false
    );
    expect(deactivationCalls).toHaveLength(0);
  });
});
