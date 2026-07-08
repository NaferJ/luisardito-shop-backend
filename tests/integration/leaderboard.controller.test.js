jest.mock("../../src/services/leaderboard.service", () => ({
  getLeaderboard: jest.fn(),
  getUserPositionHistory: jest.fn(),
  getLeaderboardStats: jest.fn(),
  createSnapshot: jest.fn(),
  cleanOldSnapshots: jest.fn(),
}));

jest.mock("../../src/utils/logger", () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
}));

const service = require("../../src/services/leaderboard.service");
const controller = require("../../src/controllers/leaderboard.controller");

function createRes() {
  return {
    statusCode: 200,
    body: null,
    status(c) {
      this.statusCode = c;
      return this;
    },
    json(b) {
      this.body = b;
      return this;
    },
  };
}

describe("leaderboard.controller", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("getLeaderboard", () => {
    test("happy path - passes service result, 200", async () => {
      const sentinel = { success: true, data: [{ id: 1 }], meta: {} };
      service.getLeaderboard.mockResolvedValue(sentinel);

      const req = { query: {}, params: {}, user: {} };
      const res = createRes();

      await controller.getLeaderboard(req, res);

      expect(res.statusCode).toBe(200);
      expect(res.body).toBe(sentinel);
    });

    test("limit > 500 -> 400", async () => {
      const req = { query: { limit: "501" }, params: {}, user: {} };
      const res = createRes();

      await controller.getLeaderboard(req, res);

      expect(res.statusCode).toBe(400);
      expect(res.body).toEqual({
        success: false,
        message: "Limit must be between 1 and 500",
      });
    });

    test("limit < 1 -> 400", async () => {
      const req = { query: { limit: "-1" }, params: {}, user: {} };
      const res = createRes();

      await controller.getLeaderboard(req, res);

      expect(res.statusCode).toBe(400);
      expect(res.body).toEqual({
        success: false,
        message: "Limit must be between 1 and 500",
      });
    });

    test("offset < 0 -> 400", async () => {
      const req = { query: { offset: "-1" }, params: {}, user: {} };
      const res = createRes();

      await controller.getLeaderboard(req, res);

      expect(res.statusCode).toBe(400);
      expect(res.body).toEqual({
        success: false,
        message: "Offset cannot be negative",
      });
    });

    test("service rejects -> 500", async () => {
      service.getLeaderboard.mockRejectedValue(new Error("boom"));

      const req = { query: {}, params: {}, user: {} };
      const res = createRes();

      await controller.getLeaderboard(req, res);

      expect(res.statusCode).toBe(500);
      expect(res.body).toMatchObject({
        success: false,
        message: "Error fetching leaderboard",
      });
    });
  });

  describe("getUserHistory", () => {
    test("invalid userId (NaN) -> 400", async () => {
      const req = {
        query: {},
        params: { userId: "abc" },
        user: {},
      };
      const res = createRes();

      await controller.getUserHistory(req, res);

      expect(res.statusCode).toBe(400);
      expect(res.body).toEqual({
        success: false,
        message: "Invalid user ID",
      });
    });

    test("days > 90 -> 400", async () => {
      const req = {
        query: { days: "91" },
        params: { userId: "1" },
        user: {},
      };
      const res = createRes();

      await controller.getUserHistory(req, res);

      expect(res.statusCode).toBe(400);
      expect(res.body).toEqual({
        success: false,
        message: "Days must be between 1 and 90",
      });
    });

    test("days < 1 -> 400", async () => {
      const req = {
        query: { days: "-1" },
        params: { userId: "1" },
        user: {},
      };
      const res = createRes();

      await controller.getUserHistory(req, res);

      expect(res.statusCode).toBe(400);
      expect(res.body).toEqual({
        success: false,
        message: "Days must be between 1 and 90",
      });
    });

    test("happy path - passes service result, 200", async () => {
      const sentinel = { success: true, history: [] };
      service.getUserPositionHistory.mockResolvedValue(sentinel);

      const req = {
        query: { days: "7" },
        params: { userId: "1" },
        user: {},
      };
      const res = createRes();

      await controller.getUserHistory(req, res);

      expect(res.statusCode).toBe(200);
      expect(res.body).toBe(sentinel);
    });
  });

  describe("getStats", () => {
    test("happy path - passes service result, 200", async () => {
      const sentinel = {
        success: true,
        stats: { total_users: 10 },
      };
      service.getLeaderboardStats.mockResolvedValue(sentinel);

      const req = { query: {}, params: {}, user: {} };
      const res = createRes();

      await controller.getStats(req, res);

      expect(res.statusCode).toBe(200);
      expect(res.body).toBe(sentinel);
    });

    test("service rejects -> 500", async () => {
      service.getLeaderboardStats.mockRejectedValue(new Error("boom"));

      const req = { query: {}, params: {}, user: {} };
      const res = createRes();

      await controller.getStats(req, res);

      expect(res.statusCode).toBe(500);
      expect(res.body).toMatchObject({
        success: false,
        message: "Error fetching stats",
      });
    });
  });

  describe("getMyPosition", () => {
    test("with user_position -> data, 200", async () => {
      const userPosition = { usuario_id: 1, position: 5, puntos: 100 };
      service.getLeaderboard.mockResolvedValue({
        user_position: userPosition,
      });

      const req = { query: {}, params: {}, user: { id: 1 } };
      const res = createRes();

      await controller.getMyPosition(req, res);

      expect(res.statusCode).toBe(200);
      expect(res.body).toEqual({
        success: true,
        data: userPosition,
      });
    });

    test("without user_position -> null + message, 200", async () => {
      service.getLeaderboard.mockResolvedValue({
        data: [],
        meta: {},
      });

      const req = { query: {}, params: {}, user: { id: 1 } };
      const res = createRes();

      await controller.getMyPosition(req, res);

      expect(res.statusCode).toBe(200);
      expect(res.body).toEqual({
        success: true,
        data: null,
        message: "You have no points yet",
      });
    });
  });

  describe("createSnapshot", () => {
    test("happy path - passes service result, 200", async () => {
      const sentinel = {
        success: true,
        snapshot_date: new Date(),
        users_count: 5,
      };
      service.createSnapshot.mockResolvedValue(sentinel);

      const req = { query: {}, params: {}, user: {} };
      const res = createRes();

      await controller.createSnapshot(req, res);

      expect(res.statusCode).toBe(200);
      expect(res.body).toBe(sentinel);
    });
  });

  describe("cleanOldSnapshots", () => {
    test("days < 7 -> 400", async () => {
      const req = { query: { days: "5" }, params: {}, user: {} };
      const res = createRes();

      await controller.cleanOldSnapshots(req, res);

      expect(res.statusCode).toBe(400);
      expect(res.body).toEqual({
        success: false,
        message: "You must keep at least 7 days of history",
      });
    });

    test("happy path - passes service result, 200", async () => {
      const sentinel = { success: true, deleted_count: 10 };
      service.cleanOldSnapshots.mockResolvedValue(sentinel);

      const req = { query: { days: "30" }, params: {}, user: {} };
      const res = createRes();

      await controller.cleanOldSnapshots(req, res);

      expect(res.statusCode).toBe(200);
      expect(res.body).toBe(sentinel);
    });
  });

  describe("getTop10", () => {
    test("happy path - shapes data + meta, 200", async () => {
      const serviceResult = {
        data: [{ usuario_id: 1, position: 1 }],
        meta: {
          last_update: "2024-01-01T00:00:00Z",
          total: 100,
        },
      };
      service.getLeaderboard.mockResolvedValue(serviceResult);

      const req = { query: {}, params: {}, user: {} };
      const res = createRes();

      await controller.getTop10(req, res);

      expect(res.statusCode).toBe(200);
      expect(res.body).toEqual({
        success: true,
        data: serviceResult.data,
        meta: {
          last_update: serviceResult.meta.last_update,
        },
      });
    });
  });
});
