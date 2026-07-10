jest.mock("../../src/services/broadcasterInfo.service", () => ({
  getBroadcasterInfo: jest.fn(),
  getStreamStatus: jest.fn(),
}));

jest.mock("../../src/utils/logger", () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
}));

const broadcasterInfoService = require("../../src/services/broadcasterInfo.service");
const broadcasterInfoCtrl = require("../../src/controllers/broadcasterInfo.controller");
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

describe("broadcasterInfo.controller migration characterization", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ---------- getBroadcasterInfo ----------
  describe("getBroadcasterInfo", () => {
    test("success -> 200 { success: true, data }", async () => {
      const mockData = {
        username: "Luisardito",
        user_id: "123",
        stream: { is_live: true, status: "online" },
      };
      broadcasterInfoService.getBroadcasterInfo.mockResolvedValue(mockData);

      const req = {};
      const res = createRes();
      const next = jest.fn();

      await broadcasterInfoCtrl.getBroadcasterInfo(req, res, next);

      expect(res.statusCode).toBe(200);
      expect(res.body).toEqual({ success: true, data: mockData });
      expect(next).not.toHaveBeenCalled();
    });

    test("error -> next(AppError) 500 'Error fetching broadcaster info'", async () => {
      broadcasterInfoService.getBroadcasterInfo.mockRejectedValue(
        new Error("Redis connection lost")
      );

      const req = {};
      const res = createRes();
      const next = jest.fn();

      await broadcasterInfoCtrl.getBroadcasterInfo(req, res, next);

      expect(next).toHaveBeenCalledTimes(1);
      const err = next.mock.calls[0][0];
      expect(err).toBeInstanceOf(AppError);
      expect(err.statusCode).toBe(500);
      expect(err.message).toBe("Error fetching broadcaster info");
      expect(err.details).toBe("Redis connection lost");
      expect(res.status).not.toHaveBeenCalled();
      expect(res.json).not.toHaveBeenCalled();
    });
  });

  // ---------- getStreamStatus ----------
  describe("getStreamStatus", () => {
    test("success -> 200 { success: true, data }", async () => {
      const mockStatus = {
        is_live: false,
        status: "offline",
        checked_at: "2025-01-01T00:00:00.000Z",
      };
      broadcasterInfoService.getStreamStatus.mockResolvedValue(mockStatus);

      const req = {};
      const res = createRes();
      const next = jest.fn();

      await broadcasterInfoCtrl.getStreamStatus(req, res, next);

      expect(res.statusCode).toBe(200);
      expect(res.body).toEqual({ success: true, data: mockStatus });
      expect(next).not.toHaveBeenCalled();
    });

    test("error -> next(AppError) 500 'Error fetching stream status'", async () => {
      broadcasterInfoService.getStreamStatus.mockRejectedValue(
        new Error("Redis connection lost")
      );

      const req = {};
      const res = createRes();
      const next = jest.fn();

      await broadcasterInfoCtrl.getStreamStatus(req, res, next);

      expect(next).toHaveBeenCalledTimes(1);
      const err = next.mock.calls[0][0];
      expect(err).toBeInstanceOf(AppError);
      expect(err.statusCode).toBe(500);
      expect(err.message).toBe("Error fetching stream status");
      expect(err.details).toBe("Redis connection lost");
      expect(res.status).not.toHaveBeenCalled();
      expect(res.json).not.toHaveBeenCalled();
    });
  });

  // ---------- errorHandler integration: { error } shape ----------
  describe("errorHandler integration — { error } shape", () => {
    const express = require("express");
    const supertest = require("supertest");
    const {
      errorHandler,
    } = require("../../src/middleware/errorHandler.middleware");

    function buildApp() {
      const app = express();
      app.use(express.json());
      return app;
    }

    test("getBroadcasterInfo 500 -> { error: 'Error fetching broadcaster info' } via errorHandler", async () => {
      broadcasterInfoService.getBroadcasterInfo.mockRejectedValue(
        new Error("Redis down")
      );
      const app = buildApp();
      app.get("/info", broadcasterInfoCtrl.getBroadcasterInfo);
      app.use(errorHandler);

      const response = await supertest(app).get("/info");

      expect(response.status).toBe(500);
      expect(response.body).toHaveProperty(
        "error",
        "Error fetching broadcaster info"
      );
      expect(response.body).toHaveProperty("details", "Redis down");
      expect(response.body).not.toHaveProperty("success");
    });

    test("getStreamStatus 500 -> { error: 'Error fetching stream status' } via errorHandler", async () => {
      broadcasterInfoService.getStreamStatus.mockRejectedValue(
        new Error("Redis down")
      );
      const app = buildApp();
      app.get("/status", broadcasterInfoCtrl.getStreamStatus);
      app.use(errorHandler);

      const response = await supertest(app).get("/status");

      expect(response.status).toBe(500);
      expect(response.body).toHaveProperty(
        "error",
        "Error fetching stream status"
      );
      expect(response.body).toHaveProperty("details", "Redis down");
      expect(response.body).not.toHaveProperty("success");
    });
  });
});
