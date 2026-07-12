jest.mock("../../src/models", () => ({
  KickWebhookEvent: {
    findOne: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  },
  KickPointsConfig: {
    findAll: jest.fn(),
    findOne: jest.fn(),
  },
  KickUserTracking: { findOne: jest.fn(), upsert: jest.fn() },
  Usuario: { findOne: jest.fn() },
  HistorialPunto: { create: jest.fn() },
  KickReward: { findOne: jest.fn() },
  UserWatchtime: {
    findOrCreate: jest.fn(),
    increment: jest.fn(),
    update: jest.fn(),
  },
  sequelize: { transaction: jest.fn() },
  KickBroadcasterToken: {
    findOne: jest.fn(),
    findAll: jest.fn(),
    count: jest.fn(),
  },
  KickEventSubscription: {
    findAll: jest.fn(),
    findOne: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    destroy: jest.fn(),
    count: jest.fn(),
  },
  BotrixMigrationConfig: { getConfig: jest.fn() },
}));

jest.mock("../../src/services/botrixMigration.service", () => ({
  processChatMessage: jest.fn(),
  processWatchtimeMessage: jest.fn(),
  getMigrationStats: jest.fn(),
}));

jest.mock("../../src/services/kickAppToken.service", () => ({
  subscribeToEventsWithAppToken: jest.fn(),
  getAppAccessToken: jest.fn(),
  checkAppTokenWebhooksStatus: jest.fn(),
}));

jest.mock("../../src/services/vip.service", () => ({
  getVipStats: jest.fn(),
  calculatePointsForUser: jest.fn(),
}));

jest.mock("../../src/services/notificacion.service", () => ({
  crearNotificacionPuntosGanados: jest.fn(),
  crearNotificacionSubRegalada: jest.fn(),
}));

jest.mock("../../src/utils/logger", () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
}));

jest.mock("../../src/config/redis.config", () => ({
  getRedisClient: jest.fn(),
}));

jest.mock("../../src/utils/kickWebhook.util", () => ({
  verifyWebhookSignature: jest.fn(),
}));

jest.mock("../../src/utils/usernameSync.util", () => ({
  syncUserProfileIfNeeded: jest.fn(),
}));

jest.mock("../../config", () => ({
  kick: {
    broadcasterId: "12345",
    apiBaseUrl: "https://api.kick.com",
    clientId: "test-client-id",
    clientSecret: "test-client-secret",
  },
  port: 3000,
}));

const {
  KickWebhookEvent,
  KickPointsConfig,
  KickBroadcasterToken,
  KickEventSubscription,
  BotrixMigrationConfig,
} = require("../../src/models");
const { getRedisClient } = require("../../src/config/redis.config");
const { verifyWebhookSignature } = require("../../src/utils/kickWebhook.util");
const BotrixMigrationService = require("../../src/services/botrixMigration.service");
const VipService = require("../../src/services/vip.service");
const kickAppTokenService = require("../../src/services/kickAppToken.service");
const config = require("../../config");
const controller = require("../../src/controllers/kickWebhook.controller");
const debugController = require("../../src/controllers/kickWebhookDebug.controller");
const AppError = require("../../src/utils/AppError");

function createRes() {
  return {
    statusCode: 200,
    body: null,
    headersSent: false,
    status: jest.fn(function (c) {
      this.statusCode = c;
      return this;
    }),
    json: jest.fn(function (b) {
      this.body = b;
      this.headersSent = true;
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

function mockRedis() {
  const redis = {
    keys: jest.fn(),
    pttl: jest.fn(),
    get: jest.fn(),
    set: jest.fn(),
    del: jest.fn(),
    ttl: jest.fn(),
    status: "ready",
  };
  getRedisClient.mockReturnValue(redis);
  return redis;
}

describe("kickWebhook.controller migration characterization", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    config.kick.broadcasterId = "12345";
  });

  // ---------- debugRedisCooldowns ----------
  describe("debugRedisCooldowns", () => {
    test("success -> 200 body unchanged", async () => {
      const redis = mockRedis();
      redis.keys.mockResolvedValue([]);
      redis.pttl.mockResolvedValue(0);
      redis.get.mockResolvedValue("value");

      const req = {};
      const res = createRes();
      const next = jest.fn();

      await debugController.debugRedisCooldowns(req, res, next);

      expect(res.statusCode).toBe(200);
      expect(res.body).toEqual({
        success: true,
        total_active_cooldowns: 0,
        cooldowns: [],
        redis_status: "ready",
        timestamp: expect.any(String),
      });
      expect(next).not.toHaveBeenCalled();
    });

    test("error -> next(AppError) 500", async () => {
      const redis = mockRedis();
      redis.keys.mockRejectedValue(new Error("Redis down"));

      const req = {};
      const res = createRes();
      const next = jest.fn();

      await debugController.debugRedisCooldowns(req, res, next);

      expectNextCalledWithAppError(next, res, 500, "Redis down");
    });
  });

  // ---------- diagnosticTokensDB ----------
  describe("diagnosticTokensDB", () => {
    test("success -> 200 body shape unchanged", async () => {
      KickBroadcasterToken.findAll.mockResolvedValue([]);
      KickEventSubscription.findAll.mockResolvedValue([]);

      const req = {};
      const res = createRes();
      const next = jest.fn();

      await debugController.diagnosticTokensDB(req, res, next);

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.diagnostico).toBeDefined();
      expect(res.body.timestamp).toEqual(expect.any(String));
      expect(next).not.toHaveBeenCalled();
    });

    test("error -> next(AppError) 500", async () => {
      KickBroadcasterToken.findAll.mockRejectedValue(new Error("DB down"));

      const req = {};
      const res = createRes();
      const next = jest.fn();

      await debugController.diagnosticTokensDB(req, res, next);

      expectNextCalledWithAppError(next, res, 500, "DB down");
    });
  });

  // ---------- diagnosticTokens ----------
  describe("diagnosticTokens", () => {
    test("success -> 200 body shape unchanged", async () => {
      KickBroadcasterToken.findAll.mockResolvedValue([]);
      KickEventSubscription.findAll.mockResolvedValue([]);

      const req = {};
      const res = createRes();
      const next = jest.fn();

      await debugController.diagnosticTokens(req, res, next);

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.diagnostico).toBeDefined();
      expect(res.body.timestamp).toEqual(expect.any(String));
      expect(next).not.toHaveBeenCalled();
    });

    test("error -> next(AppError) 500", async () => {
      KickBroadcasterToken.findAll.mockRejectedValue(new Error("DB down"));

      const req = {};
      const res = createRes();
      const next = jest.fn();

      await debugController.diagnosticTokens(req, res, next);

      expectNextCalledWithAppError(next, res, 500, "DB down");
    });
  });

  // ---------- testCors ----------
  describe("testCors", () => {
    test("success -> 200 body unchanged", async () => {
      const req = {
        method: "GET",
        headers: { origin: "https://example.com", "user-agent": "test" },
      };
      const res = createRes();
      const next = jest.fn();

      await debugController.testCors(req, res, next);

      expect(res.statusCode).toBe(200);
      expect(res.body).toEqual({
        message: "CORS working correctly for webhooks",
        timestamp: expect.any(String),
        method: "GET",
        origin: "https://example.com",
        headers: req.headers,
        corsEnabled: true,
      });
      expect(next).not.toHaveBeenCalled();
    });
  });

  // ---------- testWebhook ----------
  describe("testWebhook", () => {
    test("success -> 200 body unchanged", async () => {
      const req = {
        headers: {},
        ip: "127.0.0.1",
      };
      const res = createRes();
      const next = jest.fn();

      await debugController.testWebhook(req, res, next);

      expect(res.statusCode).toBe(200);
      expect(res.body).toEqual({
        status: "success",
        message: "Webhook endpoint is reachable",
        timestamp: expect.any(String),
        ip: "127.0.0.1",
        userAgent: undefined,
      });
      expect(next).not.toHaveBeenCalled();
    });
  });

  // ---------- debugWebhook ----------
  describe("debugWebhook", () => {
    test("success -> 200 body unchanged", async () => {
      KickEventSubscription.findAll.mockResolvedValue([]);

      const req = {};
      const res = createRes();
      const next = jest.fn();

      await debugController.debugWebhook(req, res, next);

      expect(res.statusCode).toBe(200);
      expect(res.body).toEqual({
        activeSubscriptions: 0,
        subscriptions: [],
        webhookUrl: "https://api.luisardito.com/api/webhook/kick",
        expectedHeaders: [
          "kick-event-message-id",
          "kick-event-subscription-id",
          "kick-event-signature",
          "kick-event-message-timestamp",
          "kick-event-type",
          "kick-event-version",
        ],
      });
      expect(next).not.toHaveBeenCalled();
    });

    test("error -> next(AppError) 500", async () => {
      KickEventSubscription.findAll.mockRejectedValue(new Error("DB down"));

      const req = {};
      const res = createRes();
      const next = jest.fn();

      await debugController.debugWebhook(req, res, next);

      expectNextCalledWithAppError(next, res, 500, "DB down");
    });
  });

  // ---------- simulateChat ----------
  describe("simulateChat", () => {
    test("success -> 200 body shape unchanged", async () => {
      // processWebhookEvent is internal, we just need it not to throw
      // The internal handlers will try to access DB but catch errors internally
      const req = {};
      const res = createRes();
      const next = jest.fn();

      await debugController.simulateChat(req, res, next);

      expect(res.statusCode).toBe(200);
      expect(res.body.status).toBe("success");
      expect(res.body.message).toBe("Simulated chat event processed");
      expect(res.body.payload).toBeDefined();
      expect(res.body.timestamp).toEqual(expect.any(String));
      expect(next).not.toHaveBeenCalled();
    });
  });

  // ---------- testRealWebhook ----------
  describe("testRealWebhook", () => {
    test("calls this.handleWebhook and delegates response", async () => {
      const req = {
        headers: {},
        body: {},
      };
      const res = createRes();
      const next = jest.fn();

      // handleWebhook will be called internally via this.handleWebhook
      // Since no Kick headers are present, it returns 200 "Webhook endpoint ready"
      await debugController.testRealWebhook.call(
        debugController,
        req,
        res,
        next
      );

      // handleWebhook sends response directly (200 with "Webhook endpoint ready")
      expect(res.json).toHaveBeenCalled();
      expect(next).not.toHaveBeenCalled();
    });
  });

  // ---------- systemStatus ----------
  describe("systemStatus", () => {
    test("system ready -> 200 body unchanged", async () => {
      KickBroadcasterToken.findOne.mockResolvedValue({
        kick_username: "Luisardito",
        token_expires_at: new Date(Date.now() + 86400000).toISOString(),
        auto_subscribed: true,
      });
      KickEventSubscription.count.mockResolvedValue(5);

      const req = {};
      const res = createRes();
      const next = jest.fn();

      await debugController.systemStatus(req, res, next);

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.status.system_ready).toBe(true);
      expect(res.body.status.subscriptions_active).toBe(5);
      expect(res.body.message).toBe("Webhook system operational");
      expect(next).not.toHaveBeenCalled();
    });

    test("system not ready -> 503 body unchanged", async () => {
      KickBroadcasterToken.findOne.mockResolvedValue(null);
      KickEventSubscription.count.mockResolvedValue(0);

      const req = {};
      const res = createRes();
      const next = jest.fn();

      await debugController.systemStatus(req, res, next);

      expect(res.statusCode).toBe(503);
      expect(res.body.success).toBeFalsy();
      expect(res.body.status.system_ready).toBeFalsy();
      expect(res.body.message).toBe("System needs configuration");
      expect(next).not.toHaveBeenCalled();
    });

    test("error -> next(AppError) 500", async () => {
      KickBroadcasterToken.findOne.mockRejectedValue(new Error("DB down"));

      const req = {};
      const res = createRes();
      const next = jest.fn();

      await debugController.systemStatus(req, res, next);

      expectNextCalledWithAppError(next, res, 500, "DB down");
    });
  });

  // ---------- setupPermanentWebhooks ----------
  describe("setupPermanentWebhooks", () => {
    test("success -> 200 body unchanged", async () => {
      kickAppTokenService.subscribeToEventsWithAppToken.mockResolvedValue({
        success: true,
        totalSubscribed: 5,
        totalErrors: 0,
      });

      const req = {};
      const res = createRes();
      const next = jest.fn();

      await debugController.setupPermanentWebhooks(req, res, next);

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.permanent).toBe(true);
      expect(res.body.token_type).toBe("APP_TOKEN");
      expect(res.body.subscriptions_created).toBe(5);
      expect(next).not.toHaveBeenCalled();
    });

    test("service returns failure -> next(AppError) 500", async () => {
      kickAppTokenService.subscribeToEventsWithAppToken.mockResolvedValue({
        success: false,
        totalSubscribed: 0,
        totalErrors: 1,
        error: "Something went wrong",
      });

      const req = {};
      const res = createRes();
      const next = jest.fn();

      await debugController.setupPermanentWebhooks(req, res, next);

      expectNextCalledWithAppError(
        next,
        res,
        500,
        "Error configuring permanent webhooks"
      );
    });

    test("thrown error -> next(AppError) 500", async () => {
      kickAppTokenService.subscribeToEventsWithAppToken.mockRejectedValue(
        new Error("Network error")
      );

      const req = {};
      const res = createRes();
      const next = jest.fn();

      await debugController.setupPermanentWebhooks(req, res, next);

      expectNextCalledWithAppError(next, res, 500, "Network error");
    });
  });

  // ---------- debugBotrixMigration ----------
  describe("debugBotrixMigration", () => {
    test("success -> 200 body unchanged", async () => {
      BotrixMigrationService.processChatMessage.mockResolvedValue({
        processed: true,
        details: { user: "test" },
      });

      const req = {
        body: { kick_username: "testuser", points_amount: 100 },
      };
      const res = createRes();
      const next = jest.fn();

      await debugController.debugBotrixMigration(req, res, next);

      expect(res.statusCode).toBe(200);
      expect(res.body).toEqual({
        success: true,
        message: "Migration simulation completed",
        input: { kick_username: "testuser", points_amount: 100 },
        result: { processed: true, details: { user: "test" } },
        mock_message: expect.any(String),
      });
      expect(next).not.toHaveBeenCalled();
    });

    test("missing params -> next(AppError) 400", async () => {
      const req = { body: {} };
      const res = createRes();
      const next = jest.fn();

      await debugController.debugBotrixMigration(req, res, next);

      expectNextCalledWithAppError(
        next,
        res,
        400,
        "Missing parameters: kick_username, points_amount"
      );
    });

    test("error -> next(AppError) 500", async () => {
      BotrixMigrationService.processChatMessage.mockRejectedValue(
        new Error("Service error")
      );

      const req = {
        body: { kick_username: "testuser", points_amount: 100 },
      };
      const res = createRes();
      const next = jest.fn();

      await debugController.debugBotrixMigration(req, res, next);

      expectNextCalledWithAppError(next, res, 500, "Service error");
    });
  });

  // ---------- debugSystemInfo ----------
  describe("debugSystemInfo", () => {
    test("success -> 200 body shape unchanged", async () => {
      BotrixMigrationConfig.getConfig.mockResolvedValue({
        migration_enabled: true,
        vip_points_enabled: true,
        vip_chat_points: 2,
        vip_follow_points: 10,
        vip_sub_points: 20,
      });
      BotrixMigrationService.getMigrationStats.mockResolvedValue({
        migrated_users: 5,
        total_migrated_points: 1000,
        pending_users: 2,
        migration_percentage: 70,
      });
      VipService.getVipStats.mockResolvedValue({
        total_vips: 10,
        active_vips: 8,
        expired_vips: 1,
        permanent_vips: 3,
        temporary_vips: 5,
      });

      const req = {};
      const res = createRes();
      const next = jest.fn();

      await debugController.debugSystemInfo(req, res, next);

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.system_info.migration.enabled).toBe(true);
      expect(res.body.system_info.vip.points_enabled).toBe(true);
      expect(res.body.system_info.migration.stats.migrated_users).toBe(5);
      expect(res.body.system_info.vip.stats.total_vips).toBe(10);
      expect(res.body.timestamp).toEqual(expect.any(String));
      expect(next).not.toHaveBeenCalled();
    });

    test("error -> next(AppError) 500", async () => {
      BotrixMigrationConfig.getConfig.mockRejectedValue(
        new Error("Config error")
      );

      const req = {};
      const res = createRes();
      const next = jest.fn();

      await debugController.debugSystemInfo(req, res, next);

      expectNextCalledWithAppError(next, res, 500, "Config error");
    });
  });

  // ---------- debugStreamStatus ----------
  describe("debugStreamStatus", () => {
    test("success -> 200 body shape unchanged", async () => {
      const redis = mockRedis();
      redis.get.mockImplementation((key) => {
        if (key === "stream:is_live") return "true";
        if (key === "stream:current_info")
          return JSON.stringify({ title: "Test" });
        if (key === "stream:last_status_update")
          return new Date().toISOString();
        return null;
      });
      redis.ttl.mockResolvedValue(-1);

      const req = {};
      const res = createRes();
      const next = jest.fn();

      await debugController.debugStreamStatus(req, res, next);

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.stream.is_live).toBe(true);
      expect(res.body.stream_info).toEqual({ title: "Test" });
      expect(res.body.timestamp).toEqual(expect.any(String));
      expect(next).not.toHaveBeenCalled();
    });

    test("error -> next(AppError) 500", async () => {
      const redis = mockRedis();
      redis.get.mockRejectedValue(new Error("Redis down"));

      const req = {};
      const res = createRes();
      const next = jest.fn();

      await debugController.debugStreamStatus(req, res, next);

      expectNextCalledWithAppError(next, res, 500, "Redis down");
    });
  });

  // ---------- forceStreamState ----------
  describe("forceStreamState", () => {
    test("success -> 200 body unchanged", async () => {
      const redis = mockRedis();
      redis.get.mockResolvedValue("false");
      redis.set.mockResolvedValue("OK");
      redis.del.mockResolvedValue(1);

      const req = {
        body: { is_live: true, reason: "test" },
      };
      const res = createRes();
      const next = jest.fn();

      await debugController.forceStreamState(req, res, next);

      expect(res.statusCode).toBe(200);
      expect(res.body).toEqual({
        success: true,
        message: "Stream state updated manually",
        previous_state: "false",
        new_state: "true",
        reason: "test",
        warning: "This change will be reverted if a Kick webhook arrives",
        ttl_hours: 2,
        timestamp: expect.any(String),
      });
      expect(next).not.toHaveBeenCalled();
    });

    test("missing boolean is_live -> next(AppError) 400", async () => {
      const req = { body: { is_live: "yes", reason: "test" } };
      const res = createRes();
      const next = jest.fn();

      await debugController.forceStreamState(req, res, next);

      expectNextCalledWithAppError(
        next,
        res,
        400,
        "Parameter is_live must be boolean (true/false)"
      );
    });

    test("error -> next(AppError) 500", async () => {
      const redis = mockRedis();
      redis.get.mockRejectedValue(new Error("Redis down"));

      const req = { body: { is_live: true, reason: "test" } };
      const res = createRes();
      const next = jest.fn();

      await debugController.forceStreamState(req, res, next);

      expectNextCalledWithAppError(next, res, 500, "Redis down");
    });
  });

  // ---------- getPublicPointsConfig ----------
  describe("getPublicPointsConfig", () => {
    test("success -> 200 body unchanged", async () => {
      KickPointsConfig.findAll.mockResolvedValue([
        {
          id: 1,
          config_key: "chat_points_regular",
          config_value: 1,
          enabled: true,
          description: "Regular chat points",
        },
      ]);

      const req = {};
      const res = createRes();
      const next = jest.fn();

      await debugController.getPublicPointsConfig(req, res, next);

      expect(res.statusCode).toBe(200);
      expect(res.body).toEqual({
        config: [
          {
            id: 1,
            config_key: "chat_points_regular",
            config_value: 1,
            enabled: true,
            description: "Regular chat points",
          },
        ],
        total: 1,
        initialized: true,
      });
      expect(next).not.toHaveBeenCalled();
    });

    test("error -> next(AppError) 500 'Internal server error'", async () => {
      KickPointsConfig.findAll.mockRejectedValue(new Error("DB down"));

      const req = {};
      const res = createRes();
      const next = jest.fn();

      await debugController.getPublicPointsConfig(req, res, next);

      expectNextCalledWithAppError(next, res, 500, "Internal server error");
    });
  });

  // ---------- reactivateBroadcasterToken ----------
  describe("reactivateBroadcasterToken", () => {
    test("no broadcaster token -> next(AppError) 404", async () => {
      KickBroadcasterToken.findOne.mockResolvedValue(null);

      const req = {};
      const res = createRes();
      const next = jest.fn();

      await debugController.reactivateBroadcasterToken(req, res, next);

      expectNextCalledWithAppError(
        next,
        res,
        404,
        "Main broadcaster token not found"
      );
    });

    test("error -> next(AppError) 500", async () => {
      KickBroadcasterToken.findOne.mockRejectedValue(new Error("DB down"));

      const req = {};
      const res = createRes();
      const next = jest.fn();

      await debugController.reactivateBroadcasterToken(req, res, next);

      expectNextCalledWithAppError(next, res, 500, "DB down");
    });
  });

  // ---------- handleWebhook (NOT migrated — must keep original status codes) ----------
  describe("handleWebhook (receiver — must NOT regress)", () => {
    test("test request -> 200 'Test webhook received'", async () => {
      const req = {
        headers: {},
        body: { test: true },
      };
      const res = createRes();

      await controller.handleWebhook(req, res);

      expect(res.statusCode).toBe(200);
      expect(res.body).toEqual({
        status: "success",
        message: "Test webhook received",
        timestamp: expect.any(String),
      });
    });

    test("no Kick headers -> 200 'Webhook endpoint ready'", async () => {
      const req = {
        headers: {},
        body: {},
      };
      const res = createRes();

      await controller.handleWebhook(req, res);

      expect(res.statusCode).toBe(200);
      expect(res.body).toEqual({ message: "Webhook endpoint ready" });
    });

    test("missing required headers -> 400 { error: 'Missing required headers' }", async () => {
      const req = {
        headers: {
          "kick-event-message-id": "msg-1",
          // missing signature, timestamp, type
        },
        body: { data: "test" },
      };
      const res = createRes();

      await controller.handleWebhook(req, res);

      expect(res.statusCode).toBe(400);
      expect(res.body).toEqual({ error: "Missing required headers" });
    });

    test("invalid signature -> 401 { error: 'Invalid signature' }", async () => {
      verifyWebhookSignature.mockReturnValue(false);
      const req = {
        headers: {
          "kick-event-message-id": "msg-1",
          "kick-event-subscription-id": "sub-1",
          "kick-event-signature": "bad-sig",
          "kick-event-message-timestamp": Date.now().toString(),
          "kick-event-type": "chat.message.sent",
          "kick-event-version": "1",
        },
        body: { data: "test" },
      };
      const res = createRes();

      await controller.handleWebhook(req, res);

      expect(res.statusCode).toBe(401);
      expect(res.body).toEqual({ error: "Invalid signature" });
    });

    test("valid signature, new event -> 200 'Webhook processed successfully'", async () => {
      verifyWebhookSignature.mockReturnValue(true);
      KickWebhookEvent.findOne.mockResolvedValue(null);
      KickWebhookEvent.create.mockResolvedValue({});
      KickWebhookEvent.update.mockResolvedValue([1]);

      const req = {
        headers: {
          "kick-event-message-id": "msg-1",
          "kick-event-subscription-id": "sub-1",
          "kick-event-signature": "good-sig",
          "kick-event-message-timestamp": new Date().toISOString(),
          "kick-event-type": "unknown.event",
          "kick-event-version": "1",
        },
        body: { data: "test" },
      };
      const res = createRes();

      await controller.handleWebhook(req, res);

      expect(res.statusCode).toBe(200);
      expect(res.body).toEqual({
        message: "Webhook processed successfully",
      });
    });

    test("already processed event -> 200 'Event already processed'", async () => {
      verifyWebhookSignature.mockReturnValue(true);
      KickWebhookEvent.findOne.mockResolvedValue({ message_id: "msg-1" });

      const req = {
        headers: {
          "kick-event-message-id": "msg-1",
          "kick-event-subscription-id": "sub-1",
          "kick-event-signature": "good-sig",
          "kick-event-message-timestamp": new Date().toISOString(),
          "kick-event-type": "chat.message.sent",
          "kick-event-version": "1",
        },
        body: { data: "test" },
      };
      const res = createRes();

      await controller.handleWebhook(req, res);

      expect(res.statusCode).toBe(200);
      expect(res.body).toEqual({ message: "Event already processed" });
    });

    test("internal error -> 500 { error: 'Internal error processing webhook' }", async () => {
      verifyWebhookSignature.mockReturnValue(true);
      KickWebhookEvent.findOne.mockRejectedValue(new Error("DB down"));

      const req = {
        headers: {
          "kick-event-message-id": "msg-1",
          "kick-event-subscription-id": "sub-1",
          "kick-event-signature": "good-sig",
          "kick-event-message-timestamp": new Date().toISOString(),
          "kick-event-type": "chat.message.sent",
          "kick-event-version": "1",
        },
        body: { data: "test" },
      };
      const res = createRes();

      await controller.handleWebhook(req, res);

      expect(res.statusCode).toBe(500);
      expect(res.body).toEqual({
        error: "Internal error processing webhook",
      });
    });
  });
});
