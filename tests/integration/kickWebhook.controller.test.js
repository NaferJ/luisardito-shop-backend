jest.mock("../../src/utils/kickWebhook.util", () => ({
  verifyWebhookSignature: jest.fn(),
}));

jest.mock("../../src/models", () => ({
  KickWebhookEvent: {
    findOne: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  },
  KickPointsConfig: {
    findOne: jest.fn(),
    findAll: jest.fn(),
  },
  KickUserTracking: {
    findOne: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    upsert: jest.fn(),
  },
  Usuario: {
    findOne: jest.fn(),
  },
  HistorialPunto: {
    create: jest.fn(),
  },
  KickReward: {
    findOne: jest.fn(),
  },
  UserWatchtime: {
    findOrCreate: jest.fn(),
    increment: jest.fn(),
    update: jest.fn(),
  },
  sequelize: {
    transaction: jest.fn(),
  },
}));

jest.mock("../../src/services/botrixMigration.service", () => ({
  processChatMessage: jest.fn(),
  processWatchtimeMessage: jest.fn(),
}));

jest.mock("../../src/services/vip.service", () => ({
  calculatePointsForUser: jest.fn(),
}));

jest.mock("../../src/services/notificacion.service", () => ({
  crearNotificacionPuntosGanados: jest.fn(),
  crearNotificacionSubRegalada: jest.fn(),
}));

jest.mock("../../src/services/kickModeratorCommands.service", () => ({
  processModeratorCommand: jest.fn(),
}));

jest.mock("../../src/config/redis.config", () => ({
  getRedisClient: jest.fn(() => ({
    get: jest.fn(),
    set: jest.fn(),
    del: jest.fn(),
    keys: jest.fn(),
    pttl: jest.fn(),
  })),
}));

jest.mock("../../src/utils/usernameSync.util", () => ({
  syncUserProfileIfNeeded: jest.fn(),
}));

jest.mock("../../src/utils/logger", () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
}));

const { verifyWebhookSignature } = require("../../src/utils/kickWebhook.util");
const { KickWebhookEvent } = require("../../src/models");
const controller = require("../../src/controllers/kickWebhook.controller");

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

function createReq(headers = {}, body = {}) {
  return { headers, body };
}

const FULL_HEADERS = {
  "kick-event-type": "chat.message.sent",
  "kick-event-message-id": "msg-001",
  "kick-event-signature": "valid-sig",
  "kick-event-message-timestamp": "1700000000",
  "kick-event-version": "1",
  "kick-event-subscription-id": "sub-001",
};

describe("kickWebhook.controller handleWebhook characterization", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    verifyWebhookSignature.mockReturnValue(true);
    KickWebhookEvent.findOne.mockResolvedValue(null);
    KickWebhookEvent.create.mockResolvedValue({});
    KickWebhookEvent.update.mockResolvedValue([1]);
  });

  // 1. Test webhook
  test('Body { test: true } -> 200 { status: "success", message: "Test webhook received", timestamp }', async () => {
    const req = createReq({}, { test: true });
    const res = createRes();

    await controller.handleWebhook(req, res);

    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({
      status: "success",
      message: "Test webhook received",
      timestamp: expect.any(String),
    });
  });

  // 2. No kick-event-* headers
  test('No kick-event-* headers -> 200 { message: "Webhook endpoint ready" }', async () => {
    const req = createReq({}, { data: "something" });
    const res = createRes();

    await controller.handleWebhook(req, res);

    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({ message: "Webhook endpoint ready" });
  });

  // 3. Missing required headers
  test('Missing required headers -> 400 { error: "Missing required headers" }', async () => {
    const req = createReq(
      {
        "kick-event-type": "chat.message.sent",
        "kick-event-message-id": "msg-002",
      },
      { data: "test" }
    );
    const res = createRes();

    await controller.handleWebhook(req, res);

    expect(res.statusCode).toBe(400);
    expect(res.body).toEqual({ error: "Missing required headers" });
  });

  // 4. Invalid signature
  test('Invalid signature -> 401 { error: "Invalid signature" }', async () => {
    verifyWebhookSignature.mockReturnValue(false);

    const req = createReq(FULL_HEADERS, { data: "test" });
    const res = createRes();

    await controller.handleWebhook(req, res);

    expect(res.statusCode).toBe(401);
    expect(res.body).toEqual({ error: "Invalid signature" });
  });

  // 5. Duplicate event
  test('Duplicate event -> 200 { message: "Event already processed" }', async () => {
    KickWebhookEvent.findOne.mockResolvedValue({ message_id: "msg-001" });

    const req = createReq(FULL_HEADERS, { data: "test" });
    const res = createRes();

    await controller.handleWebhook(req, res);

    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({ message: "Event already processed" });
  });

  // 6. Happy path
  test('Happy path -> 200 { message: "Webhook processed successfully" }; create and update called', async () => {
    const req = createReq(
      { ...FULL_HEADERS, "kick-event-type": "unhandled.event.type" },
      { data: "test" }
    );
    const res = createRes();

    await controller.handleWebhook(req, res);

    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({ message: "Webhook processed successfully" });
    expect(KickWebhookEvent.create).toHaveBeenCalledTimes(1);
    expect(KickWebhookEvent.update).toHaveBeenCalledTimes(1);
  });

  // 7. processWebhookEvent throws
  test('processWebhookEvent throws -> 500 { error: "Internal error processing webhook" }', async () => {
    // "moderation.banned" handler has no try/catch and accesses
    // payload.broadcaster.username — empty payload causes a TypeError
    const req = createReq(
      { ...FULL_HEADERS, "kick-event-type": "moderation.banned" },
      {}
    );
    const res = createRes();

    await controller.handleWebhook(req, res);

    expect(res.statusCode).toBe(500);
    expect(res.body).toEqual({ error: "Internal error processing webhook" });
  });
});
