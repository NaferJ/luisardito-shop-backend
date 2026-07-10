jest.mock("../../src/models", () => ({
  KickBroadcasterToken: {
    findOne: jest.fn(),
    count: jest.fn(),
  },
  KickEventSubscription: {
    findAll: jest.fn(),
    update: jest.fn(),
    count: jest.fn(),
  },
}));

jest.mock("../../src/services/tokenRefresh.service", () => ({
  forceRefresh: jest.fn(),
  getStatus: jest.fn(),
}));

jest.mock("../../src/utils/logger", () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
}));

jest.mock("../../config", () => ({
  kick: {
    broadcasterId: "12345",
  },
}));

const {
  KickBroadcasterToken,
  KickEventSubscription,
} = require("../../src/models");
const tokenRefreshService = require("../../src/services/tokenRefresh.service");
const config = require("../../config");
const controller = require("../../src/controllers/kickBroadcaster.controller");
const AppError = require("../../src/utils/AppError");

function createRes() {
  return {
    statusCode: 200,
    body: null,
    status: jest.fn(function (c) {
      this.statusCode = c;
      return this;
    }),
    json: jest.fn(function (b) {
      this.body = b;
      return this;
    }),
  };
}

function expectNextCalledWithAppError(next, res, statusCode, message) {
  expect(next).toHaveBeenCalledTimes(1);
  const err = next.mock.calls[0][0];
  expect(err).toBeInstanceOf(AppError);
  expect(err.statusCode).toBe(statusCode);
  expect(err.message).toBe(message);
  expect(res.status).not.toHaveBeenCalled();
  expect(res.json).not.toHaveBeenCalled();
}

describe("kickBroadcaster.controller migration characterization", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    config.kick.broadcasterId = "12345";
  });

  // ---------- getConnectionStatus ----------
  describe("getConnectionStatus", () => {
    test("no broadcaster configured -> 200 { connected:false, message }", async () => {
      config.kick.broadcasterId = null;

      const req = {};
      const res = createRes();
      const next = jest.fn();

      await controller.getConnectionStatus(req, res, next);

      expect(res.statusCode).toBe(200);
      expect(res.body).toEqual({
        connected: false,
        message: "No main broadcaster configured",
      });
      expect(next).not.toHaveBeenCalled();
    });

    test("active subscriptions (APP_TOKEN) -> 200 permanent shape", async () => {
      const subs = [
        {
          event_type: "chat.message.sent",
          event_version: "1",
          subscription_id: "sub-1",
          app_id: "APP_TOKEN",
          created_at: "2025-01-01T00:00:00Z",
        },
      ];
      KickEventSubscription.findAll.mockResolvedValue(subs);

      const req = {};
      const res = createRes();
      const next = jest.fn();

      await controller.getConnectionStatus(req, res, next);

      expect(res.statusCode).toBe(200);
      expect(res.body).toEqual({
        connected: true,
        system_type: "PERMANENT",
        broadcaster: {
          kick_user_id: "12345",
          kick_username: "Luisardito",
          connected_at: "2025-01-01T00:00:00Z",
          last_updated: expect.any(Date),
        },
        token: {
          type: "App Token (Permanent)",
          expires_at: null,
          is_expired: false,
          requires_maintenance: false,
        },
        subscriptions: {
          auto_subscribed: true,
          total_active: 1,
          permanent_webhooks: true,
          events: [
            {
              event_type: "chat.message.sent",
              event_version: "1",
              subscription_id: "sub-1",
              token_type: "App Token",
              created_at: "2025-01-01T00:00:00Z",
            },
          ],
        },
      });
      expect(next).not.toHaveBeenCalled();
    });

    test("active subscriptions (User Token) -> 200 temporary shape", async () => {
      const subs = [
        {
          event_type: "channel.follow",
          event_version: "1",
          subscription_id: "sub-2",
          app_id: "user-123",
          created_at: "2025-02-01T00:00:00Z",
        },
      ];
      KickEventSubscription.findAll.mockResolvedValue(subs);

      const req = {};
      const res = createRes();
      const next = jest.fn();

      await controller.getConnectionStatus(req, res, next);

      expect(res.statusCode).toBe(200);
      expect(res.body).toEqual({
        connected: true,
        system_type: "TEMPORARY",
        broadcaster: {
          kick_user_id: "12345",
          kick_username: "Luisardito",
          connected_at: "2025-02-01T00:00:00Z",
          last_updated: expect.any(Date),
        },
        token: {
          type: "User Token (Temporary)",
          expires_at: "Varies by user token",
          is_expired: false,
          requires_maintenance: true,
        },
        subscriptions: {
          auto_subscribed: true,
          total_active: 1,
          permanent_webhooks: false,
          events: [
            {
              event_type: "channel.follow",
              event_version: "1",
              subscription_id: "sub-2",
              token_type: "User Token",
              created_at: "2025-02-01T00:00:00Z",
            },
          ],
        },
      });
      expect(next).not.toHaveBeenCalled();
    });

    test("no subscriptions, no active token -> 200 disconnected shape", async () => {
      KickEventSubscription.findAll.mockResolvedValue([]);
      KickBroadcasterToken.findOne.mockResolvedValue(null);

      const req = {};
      const res = createRes();
      const next = jest.fn();

      await controller.getConnectionStatus(req, res, next);

      expect(res.statusCode).toBe(200);
      expect(res.body).toEqual({
        connected: false,
        system_type: "DISCONNECTED",
        message: "No active tokens or subscriptions available",
      });
      expect(next).not.toHaveBeenCalled();
    });

    test("no subscriptions, has user token -> 200 user-token-fallback shape", async () => {
      KickEventSubscription.findAll.mockResolvedValue([]);
      KickBroadcasterToken.findOne.mockResolvedValue({
        kick_user_id: "12345",
        kick_username: "Luisardito",
        access_token: "abcdefghijklmnop",
        token_expires_at: "2025-12-31T23:59:59Z",
        refresh_token: "refresh-token-xyz",
        auto_subscribed: true,
        created_at: "2025-01-01T00:00:00Z",
        updated_at: "2025-06-01T00:00:00Z",
        last_subscription_attempt: "2025-06-01T00:00:00Z",
        subscription_error: null,
      });

      const req = {};
      const res = createRes();
      const next = jest.fn();

      await controller.getConnectionStatus(req, res, next);

      expect(res.statusCode).toBe(200);
      expect(res.body).toEqual({
        connected: true,
        system_type: "TEMPORARY",
        broadcaster: {
          kick_user_id: "12345",
          kick_username: "Luisardito",
          connected_at: "2025-01-01T00:00:00Z",
          last_updated: "2025-06-01T00:00:00Z",
        },
        token: {
          type: "User Token (Temporary)",
          expires_at: "2025-12-31T23:59:59Z",
          is_expired: false,
          has_refresh_token: true,
          provided_by: "Luisardito",
          requires_maintenance: true,
        },
        subscriptions: {
          auto_subscribed: true,
          total_active: 0,
          permanent_webhooks: false,
          last_attempt: "2025-06-01T00:00:00Z",
          error: null,
          events: [],
        },
      });
      expect(next).not.toHaveBeenCalled();
    });

    test("error -> next(AppError) 500 'Internal server error'", async () => {
      KickEventSubscription.findAll.mockRejectedValue(new Error("DB down"));

      const req = {};
      const res = createRes();
      const next = jest.fn();

      await controller.getConnectionStatus(req, res, next);

      expectNextCalledWithAppError(next, res, 500, "Internal server error");
    });
  });

  // ---------- disconnect ----------
  describe("disconnect", () => {
    test("success -> 200 { message, broadcaster, token_provider }", async () => {
      const token = {
        kick_username: "Luisardito",
        update: jest.fn().mockResolvedValue(undefined),
      };
      KickBroadcasterToken.findOne.mockResolvedValue(token);
      KickEventSubscription.update.mockResolvedValue(1);

      const req = {};
      const res = createRes();
      const next = jest.fn();

      await controller.disconnect(req, res, next);

      expect(token.update).toHaveBeenCalledWith({ is_active: false });
      expect(res.statusCode).toBe(200);
      expect(res.body).toEqual({
        message: "Broadcaster disconnected successfully",
        broadcaster: "Luisardito",
        token_provider: "Luisardito",
      });
      expect(next).not.toHaveBeenCalled();
    });

    test("no broadcaster connected -> next(AppError) 404", async () => {
      KickBroadcasterToken.findOne.mockResolvedValue(null);

      const req = {};
      const res = createRes();
      const next = jest.fn();

      await controller.disconnect(req, res, next);

      expectNextCalledWithAppError(next, res, 404, "No broadcaster connected");
    });

    test("error -> next(AppError) 500 'Internal server error'", async () => {
      KickBroadcasterToken.findOne.mockRejectedValue(new Error("DB down"));

      const req = {};
      const res = createRes();
      const next = jest.fn();

      await controller.disconnect(req, res, next);

      expectNextCalledWithAppError(next, res, 500, "Internal server error");
    });
  });

  // ---------- getActiveToken ----------
  describe("getActiveToken", () => {
    test("success -> 200 token info shape", async () => {
      KickBroadcasterToken.findOne.mockResolvedValue({
        kick_user_id: "12345",
        kick_username: "Luisardito",
        access_token: "abcdefghijklmnop",
        token_expires_at: "2025-12-31T23:59:59Z",
        refresh_token: "refresh-token-xyz",
        auto_subscribed: true,
      });

      const req = {};
      const res = createRes();
      const next = jest.fn();

      await controller.getActiveToken(req, res, next);

      expect(res.statusCode).toBe(200);
      expect(res.body).toEqual({
        kick_user_id: "12345",
        kick_username: "Luisardito",
        token_preview: "abcdefghij...",
        token_expires_at: "2025-12-31T23:59:59Z",
        has_refresh_token: true,
        auto_subscribed: true,
      });
      expect(next).not.toHaveBeenCalled();
    });

    test("success with null access_token -> token_preview null", async () => {
      KickBroadcasterToken.findOne.mockResolvedValue({
        kick_user_id: "12345",
        kick_username: "Luisardito",
        access_token: null,
        token_expires_at: null,
        refresh_token: null,
        auto_subscribed: false,
      });

      const req = {};
      const res = createRes();
      const next = jest.fn();

      await controller.getActiveToken(req, res, next);

      expect(res.statusCode).toBe(200);
      expect(res.body).toEqual({
        kick_user_id: "12345",
        kick_username: "Luisardito",
        token_preview: null,
        token_expires_at: null,
        has_refresh_token: false,
        auto_subscribed: false,
      });
      expect(next).not.toHaveBeenCalled();
    });

    test("no broadcaster connected -> next(AppError) 404", async () => {
      KickBroadcasterToken.findOne.mockResolvedValue(null);

      const req = {};
      const res = createRes();
      const next = jest.fn();

      await controller.getActiveToken(req, res, next);

      expectNextCalledWithAppError(next, res, 404, "No broadcaster connected");
    });

    test("error -> next(AppError) 500 'Internal server error'", async () => {
      KickBroadcasterToken.findOne.mockRejectedValue(new Error("DB down"));

      const req = {};
      const res = createRes();
      const next = jest.fn();

      await controller.getActiveToken(req, res, next);

      expectNextCalledWithAppError(next, res, 500, "Internal server error");
    });
  });

  // ---------- refreshToken ----------
  describe("refreshToken", () => {
    test("success -> 200 { message, broadcaster, new_expires_at }", async () => {
      const token = {
        kick_user_id: "12345",
        kick_username: "Luisardito",
        token_expires_at: "2025-12-31T23:59:59Z",
        reload: jest.fn().mockResolvedValue(undefined),
      };
      KickBroadcasterToken.findOne.mockResolvedValue(token);
      tokenRefreshService.forceRefresh.mockResolvedValue({ success: true });

      const req = {};
      const res = createRes();
      const next = jest.fn();

      await controller.refreshToken(req, res, next);

      expect(token.reload).toHaveBeenCalledTimes(1);
      expect(res.statusCode).toBe(200);
      expect(res.body).toEqual({
        message: "Token refreshed successfully",
        broadcaster: "Luisardito",
        new_expires_at: "2025-12-31T23:59:59Z",
      });
      expect(next).not.toHaveBeenCalled();
    });

    test("no broadcaster connected -> next(AppError) 404", async () => {
      KickBroadcasterToken.findOne.mockResolvedValue(null);

      const req = {};
      const res = createRes();
      const next = jest.fn();

      await controller.refreshToken(req, res, next);

      expectNextCalledWithAppError(next, res, 404, "No broadcaster connected");
    });

    test("could not refresh -> next(AppError) 400 with details", async () => {
      KickBroadcasterToken.findOne.mockResolvedValue({
        kick_user_id: "12345",
        kick_username: "Luisardito",
      });
      tokenRefreshService.forceRefresh.mockResolvedValue({
        success: false,
        error: "Refresh token expired",
      });

      const req = {};
      const res = createRes();
      const next = jest.fn();

      await controller.refreshToken(req, res, next);

      expect(next).toHaveBeenCalledTimes(1);
      const err = next.mock.calls[0][0];
      expect(err).toBeInstanceOf(AppError);
      expect(err.statusCode).toBe(400);
      expect(err.message).toBe("Could not refresh the token");
      expect(err.details).toBe("Refresh token expired");
      expect(res.status).not.toHaveBeenCalled();
      expect(res.json).not.toHaveBeenCalled();
    });

    test("error -> next(AppError) 500 'Internal server error'", async () => {
      KickBroadcasterToken.findOne.mockRejectedValue(new Error("DB down"));

      const req = {};
      const res = createRes();
      const next = jest.fn();

      await controller.refreshToken(req, res, next);

      expectNextCalledWithAppError(next, res, 500, "Internal server error");
    });
  });

  // ---------- getRefreshServiceStatus ----------
  describe("getRefreshServiceStatus", () => {
    test("success -> 200 status object", async () => {
      const status = { running: true, interval: 300000 };
      tokenRefreshService.getStatus.mockReturnValue(status);

      const req = {};
      const res = createRes();
      const next = jest.fn();

      await controller.getRefreshServiceStatus(req, res, next);

      expect(res.statusCode).toBe(200);
      expect(res.body).toEqual(status);
      expect(next).not.toHaveBeenCalled();
    });

    test("error -> next(AppError) 500 'Internal server error'", async () => {
      tokenRefreshService.getStatus.mockImplementation(() => {
        throw new Error("Service error");
      });

      const req = {};
      const res = createRes();
      const next = jest.fn();

      await controller.getRefreshServiceStatus(req, res, next);

      expectNextCalledWithAppError(next, res, 500, "Internal server error");
    });
  });

  // ---------- debugConfig ----------
  describe("debugConfig", () => {
    test("success -> 200 config debug shape", async () => {
      KickBroadcasterToken.count.mockResolvedValue(1);
      KickEventSubscription.count
        .mockResolvedValueOnce(5) // subscriptionCount
        .mockResolvedValueOnce(3); // subscriptionsByBroadcaster

      const req = {};
      const res = createRes();
      const next = jest.fn();

      await controller.debugConfig(req, res, next);

      expect(res.statusCode).toBe(200);
      expect(res.body).toEqual({
        config: {
          broadcasterId: "12345",
          hasBroadcasterId: true,
          nodeEnv: process.env.NODE_ENV,
          kickBroadcasterIdEnv: process.env.KICK_BROADCASTER_ID,
        },
        tokenCount: 1,
        subscriptionCount: 5,
        subscriptionsByBroadcaster: 3,
      });
      expect(next).not.toHaveBeenCalled();
    });

    test("error -> next(AppError) 500 with error.message", async () => {
      KickBroadcasterToken.count.mockRejectedValue(new Error("DB down"));

      const req = {};
      const res = createRes();
      const next = jest.fn();

      await controller.debugConfig(req, res, next);

      expectNextCalledWithAppError(next, res, 500, "DB down");
    });
  });
});
