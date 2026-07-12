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

const { KickWebhookEvent, KickPointsConfig } = require("../../src/models");
const { getRedisClient } = require("../../src/config/redis.config");
const { verifyWebhookSignature } = require("../../src/utils/kickWebhook.util");
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
