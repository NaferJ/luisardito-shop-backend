jest.mock("../../src/models", () => ({
  KickPointsConfig: {
    findAll: jest.fn(),
    findOne: jest.fn(),
    create: jest.fn(),
    findOrCreate: jest.fn(),
  },
}));

jest.mock("../../src/utils/logger", () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
}));

const { KickPointsConfig } = require("../../src/models");
const kickPointsConfigCtrl = require("../../src/controllers/kickPointsConfig.controller");
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

describe("kickPointsConfig.controller migration characterization", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ---------- getConfig ----------
  describe("getConfig", () => {
    test("success with existing configs -> 200 { config, total, initialized: false }", async () => {
      const configs = [
        {
          config_key: "chat_points_regular",
          config_value: 10,
          enabled: true,
        },
        {
          config_key: "follow_points",
          config_value: 50,
          enabled: true,
        },
      ];
      KickPointsConfig.findAll.mockResolvedValue(configs);

      const req = {};
      const res = createRes();
      const next = jest.fn();

      await kickPointsConfigCtrl.getConfig(req, res, next);

      expect(res.statusCode).toBe(200);
      expect(res.body).toEqual({
        config: configs,
        total: 2,
        initialized: false,
      });
      expect(next).not.toHaveBeenCalled();
    });

    test("success with auto-initialize (empty config) -> 200 { config: created, total, initialized: true, message }", async () => {
      KickPointsConfig.findAll.mockResolvedValue([]);

      const createdConfigs = [
        {
          config_key: "chat_points_regular",
          config_value: 10,
          description: "Points per chat message (regular users)",
          enabled: true,
        },
        {
          config_key: "chat_points_subscriber",
          config_value: 20,
          description: "Points per chat message (subscribers)",
          enabled: true,
        },
        {
          config_key: "chat_points_vip",
          config_value: 30,
          description: "Points per chat message (VIPs)",
          enabled: true,
        },
        {
          config_key: "follow_points",
          config_value: 50,
          description: "Points for following the channel (first time)",
          enabled: true,
        },
        {
          config_key: "subscription_new_points",
          config_value: 500,
          description: "Points for new subscription",
          enabled: true,
        },
        {
          config_key: "subscription_renewal_points",
          config_value: 300,
          description: "Points for subscription renewal",
          enabled: true,
        },
        {
          config_key: "gift_given_points",
          config_value: 100,
          description: "Points per gifted subscription",
          enabled: true,
        },
        {
          config_key: "gift_received_points",
          config_value: 400,
          description: "Points for receiving a gifted subscription",
          enabled: true,
        },
        {
          config_key: "kicks_gifted_multiplier",
          config_value: 2,
          description: "Points multiplier per gifted kicks",
          enabled: true,
        },
      ];
      KickPointsConfig.create.mockImplementation((configData) =>
        Promise.resolve(configData)
      );

      const req = {};
      const res = createRes();
      const next = jest.fn();

      await kickPointsConfigCtrl.getConfig(req, res, next);

      expect(res.statusCode).toBe(200);
      expect(res.body).toEqual({
        config: createdConfigs,
        total: 9,
        initialized: true,
        message: "Configuration initialized automatically",
      });
      expect(next).not.toHaveBeenCalled();
    });

    test("error -> next(AppError) 500 'Internal server error'", async () => {
      KickPointsConfig.findAll.mockRejectedValue(new Error("DB down"));

      const req = {};
      const res = createRes();
      const next = jest.fn();

      await kickPointsConfigCtrl.getConfig(req, res, next);

      expectNextCalledWithAppError(next, res, 500, "Internal server error");
    });
  });

  // ---------- updateConfig ----------
  describe("updateConfig", () => {
    test("success -> 200 { message: 'Configuration updated', config }", async () => {
      const config = {
        config_key: "chat_points_regular",
        config_value: 10,
        enabled: true,
        update: jest.fn().mockResolvedValue(undefined),
      };
      KickPointsConfig.findOne.mockResolvedValue(config);

      const req = {
        body: { config_key: "chat_points_regular", config_value: 15 },
      };
      const res = createRes();
      const next = jest.fn();

      await kickPointsConfigCtrl.updateConfig(req, res, next);

      expect(res.statusCode).toBe(200);
      expect(res.body).toEqual({
        message: "Configuration updated",
        config,
      });
      expect(next).not.toHaveBeenCalled();
    });

    test("missing config_key -> next(AppError) 400 'config_key is required'", async () => {
      const req = { body: { config_value: 15 } };
      const res = createRes();
      const next = jest.fn();

      await kickPointsConfigCtrl.updateConfig(req, res, next);

      expectNextCalledWithAppError(next, res, 400, "config_key is required");
    });

    test("config not found -> next(AppError) 404 'Configuration not found'", async () => {
      KickPointsConfig.findOne.mockResolvedValue(null);

      const req = { body: { config_key: "nonexistent", config_value: 15 } };
      const res = createRes();
      const next = jest.fn();

      await kickPointsConfigCtrl.updateConfig(req, res, next);

      expectNextCalledWithAppError(next, res, 404, "Configuration not found");
    });

    test("error -> next(AppError) 500 'Internal server error'", async () => {
      KickPointsConfig.findOne.mockRejectedValue(new Error("DB down"));

      const req = { body: { config_key: "chat_points_regular" } };
      const res = createRes();
      const next = jest.fn();

      await kickPointsConfigCtrl.updateConfig(req, res, next);

      expectNextCalledWithAppError(next, res, 500, "Internal server error");
    });
  });

  // ---------- updateMultipleConfigs ----------
  describe("updateMultipleConfigs", () => {
    test("success -> 200 { message: 'N configurations updated', configs: updated }", async () => {
      const config1 = {
        config_key: "chat_points_regular",
        config_value: 10,
        enabled: true,
        update: jest.fn().mockResolvedValue(undefined),
      };
      const config2 = {
        config_key: "follow_points",
        config_value: 50,
        enabled: true,
        update: jest.fn().mockResolvedValue(undefined),
      };
      KickPointsConfig.findOne
        .mockResolvedValueOnce(config1)
        .mockResolvedValueOnce(config2);

      const req = {
        body: {
          configs: [
            { config_key: "chat_points_regular", config_value: 15 },
            { config_key: "follow_points", config_value: 60 },
          ],
        },
      };
      const res = createRes();
      const next = jest.fn();

      await kickPointsConfigCtrl.updateMultipleConfigs(req, res, next);

      expect(res.statusCode).toBe(200);
      expect(res.body).toEqual({
        message: "2 configurations updated",
        configs: [config1, config2],
      });
      expect(next).not.toHaveBeenCalled();
    });

    test("configs not array -> next(AppError) 400 'configs must be an array'", async () => {
      const req = { body: { configs: "not-an-array" } };
      const res = createRes();
      const next = jest.fn();

      await kickPointsConfigCtrl.updateMultipleConfigs(req, res, next);

      expectNextCalledWithAppError(next, res, 400, "configs must be an array");
    });

    test("error -> next(AppError) 500 'Internal server error'", async () => {
      KickPointsConfig.findOne.mockRejectedValue(new Error("DB down"));

      const req = {
        body: { configs: [{ config_key: "chat_points_regular" }] },
      };
      const res = createRes();
      const next = jest.fn();

      await kickPointsConfigCtrl.updateMultipleConfigs(req, res, next);

      expectNextCalledWithAppError(next, res, 500, "Internal server error");
    });
  });

  // ---------- initializeConfig ----------
  describe("initializeConfig", () => {
    test("success -> 200 { message, created, total }", async () => {
      KickPointsConfig.findOrCreate.mockImplementation(({ defaults }) =>
        Promise.resolve([defaults, true])
      );

      const req = {};
      const res = createRes();
      const next = jest.fn();

      await kickPointsConfigCtrl.initializeConfig(req, res, next);

      expect(res.statusCode).toBe(200);
      expect(res.body.total).toBe(8);
      expect(res.body.created).toHaveLength(8);
      expect(res.body.message).toBe(
        "Configuration initialized (8 new, 0 existing)"
      );
      expect(next).not.toHaveBeenCalled();
    });

    test("error -> next(AppError) 500 'Internal server error'", async () => {
      KickPointsConfig.findOrCreate.mockRejectedValue(new Error("DB down"));

      const req = {};
      const res = createRes();
      const next = jest.fn();

      await kickPointsConfigCtrl.initializeConfig(req, res, next);

      expectNextCalledWithAppError(next, res, 500, "Internal server error");
    });
  });
});
