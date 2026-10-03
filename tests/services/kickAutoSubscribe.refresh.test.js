const axios = require("axios");

jest.mock("axios");

jest.mock("../../config", () => ({
  kick: {
    apiBaseUrl: "https://api.kick.com",
    oauthToken: "https://id.kick.com/oauth/token",
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

describe("kickAutoSubscribe.refreshAccessToken single-flight", () => {
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

  function mockTokenResponse() {
    axios.post.mockResolvedValue({
      data: {
        access_token: "new-access-token",
        refresh_token: "new-refresh-token",
        expires_in: 3600,
      },
    });
  }

  test("concurrent calls share a single axios.post and both resolve to true", async () => {
    mockTokenResponse();
    const record = buildRecord();

    const p1 = refreshAccessToken(record);
    const p2 = refreshAccessToken(record);
    const [r1, r2] = await Promise.all([p1, p2]);

    expect(axios.post).toHaveBeenCalledTimes(1);
    expect(r1).toBe(true);
    expect(r2).toBe(true);
    expect(record.update).toHaveBeenCalledTimes(1);
  });

  test("after the in-flight promise settles, a subsequent call triggers a new axios.post", async () => {
    mockTokenResponse();
    const record = buildRecord();

    await refreshAccessToken(record);
    expect(axios.post).toHaveBeenCalledTimes(1);

    await refreshAccessToken(record);
    expect(axios.post).toHaveBeenCalledTimes(2);
  });

  test("posts a form-encoded refresh grant to the OAuth host", async () => {
    mockTokenResponse();
    await refreshAccessToken(buildRecord());

    const [url, body, options] = axios.post.mock.calls[0];
    expect(url).toBe("https://id.kick.com/oauth/token");
    expect(body).toBeInstanceOf(URLSearchParams);
    expect(Object.fromEntries(body)).toEqual({
      grant_type: "refresh_token",
      client_id: "test-client-id",
      client_secret: "test-client-secret",
      refresh_token: "old-refresh-token",
    });
    expect(options.headers["Content-Type"]).toBe(
      "application/x-www-form-urlencoded"
    );
  });
});
