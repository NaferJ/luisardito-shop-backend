jest.mock("../../config", () => ({
  kick: { broadcasterId: "2771761" },
}));

jest.mock("../../src/utils/logger", () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
}));

jest.mock("../../src/models", () => ({
  KickBroadcasterToken: { findAll: jest.fn(), findOne: jest.fn() },
}));

jest.mock("../../src/services/kickAutoSubscribe.service", () => ({
  refreshAccessToken: jest.fn(),
}));

const {
  refreshAccessToken,
} = require("../../src/services/kickAutoSubscribe.service");
const tokenRefreshService = require("../../src/services/tokenRefresh.service");

function buildToken(overrides = {}) {
  return {
    kick_user_id: "2771761",
    kick_username: "Luisardito",
    token_expires_at: new Date(Date.now() + 10 * 60 * 1000),
    update: jest.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

describe("tokenRefreshService.checkTokenExpiration", () => {
  beforeEach(() => jest.clearAllMocks());

  test("refreshes the main broadcaster token when it is about to expire", async () => {
    refreshAccessToken.mockResolvedValue(true);
    const token = buildToken();

    await tokenRefreshService.checkTokenExpiration(token);

    expect(refreshAccessToken).toHaveBeenCalledWith(token);
    expect(token.update).not.toHaveBeenCalled();
  });

  test("does not deactivate the main broadcaster token on a failed refresh", async () => {
    refreshAccessToken.mockResolvedValue(false);
    const token = buildToken();

    await tokenRefreshService.checkTokenExpiration(token);

    expect(refreshAccessToken).toHaveBeenCalledTimes(1);
    expect(token.update).not.toHaveBeenCalled();
  });

  test("retires other users' tokens without calling Kick", async () => {
    const token = buildToken({
      kick_user_id: "28937024",
      kick_username: "viewer",
    });

    await tokenRefreshService.checkTokenExpiration(token);

    expect(refreshAccessToken).not.toHaveBeenCalled();
    expect(token.update).toHaveBeenCalledWith(
      expect.objectContaining({ is_active: false })
    );
  });

  test("leaves tokens that are not close to expiry untouched", async () => {
    const token = buildToken({
      kick_user_id: "28937024",
      token_expires_at: new Date(Date.now() + 2 * 60 * 60 * 1000),
    });

    await tokenRefreshService.checkTokenExpiration(token);

    expect(refreshAccessToken).not.toHaveBeenCalled();
    expect(token.update).not.toHaveBeenCalled();
  });
});
