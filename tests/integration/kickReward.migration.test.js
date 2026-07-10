jest.mock("../../src/models", () => ({
  KickReward: {
    findAll: jest.fn(),
    findByPk: jest.fn(),
  },
}));

jest.mock("../../src/services/kickReward.service", () => ({
  syncRewardsFromKick: jest.fn(),
  createRewardInKick: jest.fn(),
  updateRewardInKick: jest.fn(),
  deleteRewardInKick: jest.fn(),
}));

jest.mock("../../src/utils/logger", () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
}));

const { KickReward } = require("../../src/models");
const KickRewardService = require("../../src/services/kickReward.service");
const kickRewardCtrl = require("../../src/controllers/kickReward.controller");
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

describe("kickReward.controller migration characterization", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ---------- getAllRewards ----------
  describe("getAllRewards", () => {
    test("success -> 200 { success:true, total, rewards }", async () => {
      const rewards = [
        { id: 1, title: "Reward A" },
        { id: 2, title: "Reward B" },
      ];
      KickReward.findAll.mockResolvedValue(rewards);

      const req = {};
      const res = createRes();
      const next = jest.fn();

      await kickRewardCtrl.getAllRewards(req, res, next);

      expect(res.statusCode).toBe(200);
      expect(res.body).toEqual({
        success: true,
        total: 2,
        rewards,
      });
      expect(next).not.toHaveBeenCalled();
    });

    test("error -> next(AppError) 500 'Error fetching rewards'", async () => {
      KickReward.findAll.mockRejectedValue(new Error("DB down"));

      const req = {};
      const res = createRes();
      const next = jest.fn();

      await kickRewardCtrl.getAllRewards(req, res, next);

      expectNextCalledWithAppError(next, res, 500, "Error fetching rewards");
    });
  });

  // ---------- getRewardById ----------
  describe("getRewardById", () => {
    test("success -> 200 { success:true, reward }", async () => {
      const reward = { id: 1, title: "Reward A" };
      KickReward.findByPk.mockResolvedValue(reward);

      const req = { params: { id: "1" } };
      const res = createRes();
      const next = jest.fn();

      await kickRewardCtrl.getRewardById(req, res, next);

      expect(res.statusCode).toBe(200);
      expect(res.body).toEqual({ success: true, reward });
      expect(next).not.toHaveBeenCalled();
    });

    test("not found -> next(AppError) 404 'Reward not found'", async () => {
      KickReward.findByPk.mockResolvedValue(null);

      const req = { params: { id: "999" } };
      const res = createRes();
      const next = jest.fn();

      await kickRewardCtrl.getRewardById(req, res, next);

      expectNextCalledWithAppError(next, res, 404, "Reward not found");
    });

    test("error -> next(AppError) 500 'Error fetching reward'", async () => {
      KickReward.findByPk.mockRejectedValue(new Error("DB down"));

      const req = { params: { id: "1" } };
      const res = createRes();
      const next = jest.fn();

      await kickRewardCtrl.getRewardById(req, res, next);

      expectNextCalledWithAppError(next, res, 500, "Error fetching reward");
    });
  });

  // ---------- syncRewards ----------
  describe("syncRewards", () => {
    test("success -> 200 { success:true, message, ...result }", async () => {
      const result = { synced: 5, created: 2 };
      KickRewardService.syncRewardsFromKick.mockResolvedValue(result);

      const req = {};
      const res = createRes();
      const next = jest.fn();

      await kickRewardCtrl.syncRewards(req, res, next);

      expect(res.statusCode).toBe(200);
      expect(res.body).toEqual({
        success: true,
        message: "Rewards synced successfully",
        synced: 5,
        created: 2,
      });
      expect(next).not.toHaveBeenCalled();
    });

    test("error -> next(AppError) 500 'Error syncing rewards' with details", async () => {
      KickRewardService.syncRewardsFromKick.mockRejectedValue(
        new Error("Kick API down")
      );

      const req = {};
      const res = createRes();
      const next = jest.fn();

      await kickRewardCtrl.syncRewards(req, res, next);

      expect(next).toHaveBeenCalledTimes(1);
      const err = next.mock.calls[0][0];
      expect(err).toBeInstanceOf(AppError);
      expect(err.statusCode).toBe(500);
      expect(err.message).toBe("Error syncing rewards");
      expect(err.details).toBe("Kick API down");
      expect(res.status).not.toHaveBeenCalled();
      expect(res.json).not.toHaveBeenCalled();
    });
  });

  // ---------- createReward ----------
  describe("createReward", () => {
    const validBody = {
      title: "New Reward",
      description: "A reward",
      cost: 100,
      puntos_a_otorgar: 50,
    };

    test("success -> 201 { success:true, message, reward }", async () => {
      const reward = { id: 1, title: "New Reward" };
      KickRewardService.createRewardInKick.mockResolvedValue({ reward });

      const req = { body: validBody };
      const res = createRes();
      const next = jest.fn();

      await kickRewardCtrl.createReward(req, res, next);

      expect(res.statusCode).toBe(201);
      expect(res.body).toEqual({
        success: true,
        message: "Reward created successfully in Kick",
        reward,
      });
      expect(next).not.toHaveBeenCalled();
    });

    test("missing fields -> next(AppError) 400", async () => {
      const req = { body: { title: "X" } };
      const res = createRes();
      const next = jest.fn();

      await kickRewardCtrl.createReward(req, res, next);

      expectNextCalledWithAppError(
        next,
        res,
        400,
        "Missing required fields: title, cost, puntos_a_otorgar"
      );
    });

    test("cost < 1 -> next(AppError) 400 'Cost must be at least 1'", async () => {
      const req = {
        body: { title: "X", cost: -1, puntos_a_otorgar: 1 },
      };
      const res = createRes();
      const next = jest.fn();

      await kickRewardCtrl.createReward(req, res, next);

      expectNextCalledWithAppError(next, res, 400, "Cost must be at least 1");
    });

    test("title > 50 chars -> next(AppError) 400 'Title cannot exceed 50 characters'", async () => {
      const req = {
        body: { title: "A".repeat(51), cost: 10, puntos_a_otorgar: 1 },
      };
      const res = createRes();
      const next = jest.fn();

      await kickRewardCtrl.createReward(req, res, next);

      expectNextCalledWithAppError(
        next,
        res,
        400,
        "Title cannot exceed 50 characters"
      );
    });

    test("description > 200 chars -> next(AppError) 400 'Description cannot exceed 200 characters'", async () => {
      const req = {
        body: {
          title: "X",
          description: "A".repeat(201),
          cost: 10,
          puntos_a_otorgar: 1,
        },
      };
      const res = createRes();
      const next = jest.fn();

      await kickRewardCtrl.createReward(req, res, next);

      expectNextCalledWithAppError(
        next,
        res,
        400,
        "Description cannot exceed 200 characters"
      );
    });

    test("service error -> next(AppError) 500 'Error creating reward' with details", async () => {
      KickRewardService.createRewardInKick.mockRejectedValue(
        new Error("Kick API error")
      );

      const req = { body: validBody };
      const res = createRes();
      const next = jest.fn();

      await kickRewardCtrl.createReward(req, res, next);

      expect(next).toHaveBeenCalledTimes(1);
      const err = next.mock.calls[0][0];
      expect(err).toBeInstanceOf(AppError);
      expect(err.statusCode).toBe(500);
      expect(err.message).toBe("Error creating reward");
      expect(err.details).toBe("Kick API error");
      expect(res.status).not.toHaveBeenCalled();
      expect(res.json).not.toHaveBeenCalled();
    });
  });

  // ---------- updateReward ----------
  describe("updateReward", () => {
    test("success -> 200 { success:true, message, reward }", async () => {
      const reward = {
        id: 1,
        kick_reward_id: "abc",
        title: "Old Title",
      };
      KickReward.findByPk.mockResolvedValue(reward);
      KickRewardService.updateRewardInKick.mockResolvedValue({
        reward: { id: 1, title: "New Title" },
      });

      const req = { params: { id: "1" }, body: { title: "New Title" } };
      const res = createRes();
      const next = jest.fn();

      await kickRewardCtrl.updateReward(req, res, next);

      expect(res.statusCode).toBe(200);
      expect(res.body).toEqual({
        success: true,
        message: "Reward updated successfully",
        reward: { id: 1, title: "New Title" },
      });
      expect(next).not.toHaveBeenCalled();
    });

    test("not found -> next(AppError) 404 'Reward not found'", async () => {
      KickReward.findByPk.mockResolvedValue(null);

      const req = { params: { id: "999" }, body: {} };
      const res = createRes();
      const next = jest.fn();

      await kickRewardCtrl.updateReward(req, res, next);

      expectNextCalledWithAppError(next, res, 404, "Reward not found");
    });

    test("title > 50 -> next(AppError) 400 'Title cannot exceed 50 characters'", async () => {
      KickReward.findByPk.mockResolvedValue({ id: 1, kick_reward_id: "abc" });

      const req = {
        params: { id: "1" },
        body: { title: "A".repeat(51) },
      };
      const res = createRes();
      const next = jest.fn();

      await kickRewardCtrl.updateReward(req, res, next);

      expectNextCalledWithAppError(
        next,
        res,
        400,
        "Title cannot exceed 50 characters"
      );
    });

    test("description > 200 -> next(AppError) 400 'Description cannot exceed 200 characters'", async () => {
      KickReward.findByPk.mockResolvedValue({ id: 1, kick_reward_id: "abc" });

      const req = {
        params: { id: "1" },
        body: { description: "A".repeat(201) },
      };
      const res = createRes();
      const next = jest.fn();

      await kickRewardCtrl.updateReward(req, res, next);

      expectNextCalledWithAppError(
        next,
        res,
        400,
        "Description cannot exceed 200 characters"
      );
    });

    test("cost < 1 -> next(AppError) 400 'Cost must be at least 1'", async () => {
      KickReward.findByPk.mockResolvedValue({ id: 1, kick_reward_id: "abc" });

      const req = {
        params: { id: "1" },
        body: { cost: 0 },
      };
      const res = createRes();
      const next = jest.fn();

      await kickRewardCtrl.updateReward(req, res, next);

      expectNextCalledWithAppError(next, res, 400, "Cost must be at least 1");
    });

    test("service error -> next(AppError) 500 'Error updating reward' with details", async () => {
      KickReward.findByPk.mockResolvedValue({ id: 1, kick_reward_id: "abc" });
      KickRewardService.updateRewardInKick.mockRejectedValue(
        new Error("Kick API error")
      );

      const req = { params: { id: "1" }, body: { title: "New" } };
      const res = createRes();
      const next = jest.fn();

      await kickRewardCtrl.updateReward(req, res, next);

      expect(next).toHaveBeenCalledTimes(1);
      const err = next.mock.calls[0][0];
      expect(err).toBeInstanceOf(AppError);
      expect(err.statusCode).toBe(500);
      expect(err.message).toBe("Error updating reward");
      expect(err.details).toBe("Kick API error");
      expect(res.status).not.toHaveBeenCalled();
      expect(res.json).not.toHaveBeenCalled();
    });
  });

  // ---------- deleteReward ----------
  describe("deleteReward", () => {
    test("success -> 200 { success:true, message }", async () => {
      KickReward.findByPk.mockResolvedValue({
        id: 1,
        kick_reward_id: "abc",
        title: "Reward A",
      });
      KickRewardService.deleteRewardInKick.mockResolvedValue(undefined);

      const req = { params: { id: "1" } };
      const res = createRes();
      const next = jest.fn();

      await kickRewardCtrl.deleteReward(req, res, next);

      expect(res.statusCode).toBe(200);
      expect(res.body).toEqual({
        success: true,
        message: "Reward deleted successfully",
      });
      expect(next).not.toHaveBeenCalled();
    });

    test("not found -> next(AppError) 404 'Reward not found'", async () => {
      KickReward.findByPk.mockResolvedValue(null);

      const req = { params: { id: "999" } };
      const res = createRes();
      const next = jest.fn();

      await kickRewardCtrl.deleteReward(req, res, next);

      expectNextCalledWithAppError(next, res, 404, "Reward not found");
    });

    test("service error -> next(AppError) 500 'Error deleting reward' with details", async () => {
      KickReward.findByPk.mockResolvedValue({
        id: 1,
        kick_reward_id: "abc",
        title: "Reward A",
      });
      KickRewardService.deleteRewardInKick.mockRejectedValue(
        new Error("Kick API error")
      );

      const req = { params: { id: "1" } };
      const res = createRes();
      const next = jest.fn();

      await kickRewardCtrl.deleteReward(req, res, next);

      expect(next).toHaveBeenCalledTimes(1);
      const err = next.mock.calls[0][0];
      expect(err).toBeInstanceOf(AppError);
      expect(err.statusCode).toBe(500);
      expect(err.message).toBe("Error deleting reward");
      expect(err.details).toBe("Kick API error");
      expect(res.status).not.toHaveBeenCalled();
      expect(res.json).not.toHaveBeenCalled();
    });
  });

  // ---------- getRewardsStats ----------
  describe("getRewardsStats", () => {
    test("success -> 200 { success:true, stats } with correct shape", async () => {
      const rewards = [
        {
          id: 1,
          title: "Reward A",
          is_enabled: true,
          is_paused: false,
          is_user_input_required: true,
          total_redemptions: 10,
          puntos_a_otorgar: 50,
        },
        {
          id: 2,
          title: "Reward B",
          is_enabled: false,
          is_paused: true,
          is_user_input_required: false,
          total_redemptions: 5,
          puntos_a_otorgar: 30,
        },
      ];
      KickReward.findAll.mockResolvedValue(rewards);

      const req = {};
      const res = createRes();
      const next = jest.fn();

      await kickRewardCtrl.getRewardsStats(req, res, next);

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.stats).toEqual({
        total: 2,
        enabled: 1,
        disabled: 1,
        paused: 1,
        with_user_input: 1,
        total_redemptions: 15,
        total_points_configured: 80,
        most_redeemed: [
          {
            title: "Reward A",
            total_redemptions: 10,
            puntos_a_otorgar: 50,
          },
          {
            title: "Reward B",
            total_redemptions: 5,
            puntos_a_otorgar: 30,
          },
        ],
      });
      expect(next).not.toHaveBeenCalled();
    });

    test("error -> next(AppError) 500 'Error fetching stats'", async () => {
      KickReward.findAll.mockRejectedValue(new Error("DB down"));

      const req = {};
      const res = createRes();
      const next = jest.fn();

      await kickRewardCtrl.getRewardsStats(req, res, next);

      expectNextCalledWithAppError(next, res, 500, "Error fetching stats");
    });
  });

  // ---------- updateRewardPoints ----------
  describe("updateRewardPoints", () => {
    test("success -> 200 { success:true, message, reward }", async () => {
      const reward = {
        id: 1,
        title: "Reward A",
        puntos_a_otorgar: 50,
        update: jest.fn().mockResolvedValue(undefined),
      };
      KickReward.findByPk.mockResolvedValue(reward);

      const req = {
        params: { id: "1" },
        body: { puntos_a_otorgar: 100 },
      };
      const res = createRes();
      const next = jest.fn();

      await kickRewardCtrl.updateRewardPoints(req, res, next);

      expect(res.statusCode).toBe(200);
      expect(res.body).toEqual({
        success: true,
        message: "Points updated successfully",
        reward,
      });
      expect(reward.update).toHaveBeenCalledWith({ puntos_a_otorgar: 100 });
      expect(next).not.toHaveBeenCalled();
    });

    test("success with auto_accept -> updates both fields", async () => {
      const reward = {
        id: 1,
        title: "Reward A",
        puntos_a_otorgar: 50,
        update: jest.fn().mockResolvedValue(undefined),
      };
      KickReward.findByPk.mockResolvedValue(reward);

      const req = {
        params: { id: "1" },
        body: { puntos_a_otorgar: 100, auto_accept: false },
      };
      const res = createRes();
      const next = jest.fn();

      await kickRewardCtrl.updateRewardPoints(req, res, next);

      expect(res.statusCode).toBe(200);
      expect(res.body).toEqual({
        success: true,
        message: "Points updated successfully",
        reward,
      });
      expect(reward.update).toHaveBeenCalledWith({
        puntos_a_otorgar: 100,
        auto_accept: false,
      });
      expect(next).not.toHaveBeenCalled();
    });

    test("missing puntos_a_otorgar -> next(AppError) 400 'Missing field puntos_a_otorgar'", async () => {
      const req = { params: { id: "1" }, body: {} };
      const res = createRes();
      const next = jest.fn();

      await kickRewardCtrl.updateRewardPoints(req, res, next);

      expectNextCalledWithAppError(
        next,
        res,
        400,
        "Missing field puntos_a_otorgar"
      );
    });

    test("not found -> next(AppError) 404 'Reward not found'", async () => {
      KickReward.findByPk.mockResolvedValue(null);

      const req = {
        params: { id: "999" },
        body: { puntos_a_otorgar: 100 },
      };
      const res = createRes();
      const next = jest.fn();

      await kickRewardCtrl.updateRewardPoints(req, res, next);

      expectNextCalledWithAppError(next, res, 404, "Reward not found");
    });

    test("error -> next(AppError) 500 'Error updating points'", async () => {
      KickReward.findByPk.mockRejectedValue(new Error("DB down"));

      const req = {
        params: { id: "1" },
        body: { puntos_a_otorgar: 100 },
      };
      const res = createRes();
      const next = jest.fn();

      await kickRewardCtrl.updateRewardPoints(req, res, next);

      expectNextCalledWithAppError(next, res, 500, "Error updating points");
    });
  });
});
