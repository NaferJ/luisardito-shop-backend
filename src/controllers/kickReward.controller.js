const { KickReward } = require("../models");
const KickRewardService = require("../services/kickReward.service");
const logger = require("../utils/logger");
const asyncHandler = require("../utils/asyncHandler");
const AppError = require("../utils/AppError");

/**
 * Get all rewards
 * GET /api/admin/kick-rewards
 */
exports.getAllRewards = asyncHandler(async (req, res) => {
  try {
    const rewards = await KickReward.findAll({
      order: [["created_at", "DESC"]],
    });

    res.json({
      success: true,
      total: rewards.length,
      rewards,
    });
  } catch (error) {
    if (error instanceof AppError) throw error;
    logger.error("[Kick Rewards Admin] Error fetching rewards:", error.message);
    throw new AppError("Error fetching rewards", 500);
  }
});

/**
 * Get a reward by ID
 * GET /api/admin/kick-rewards/:id
 */
exports.getRewardById = asyncHandler(async (req, res) => {
  try {
    const { id } = req.params;

    const reward = await KickReward.findByPk(id);

    if (!reward) {
      throw new AppError("Reward not found", 404);
    }

    res.json({
      success: true,
      reward,
    });
  } catch (error) {
    if (error instanceof AppError) throw error;
    logger.error("[Kick Rewards Admin] Error fetching reward:", error.message);
    throw new AppError("Error fetching reward", 500);
  }
});

/**
 * Sync rewards from Kick
 * POST /api/admin/kick-rewards/sync
 */
exports.syncRewards = asyncHandler(async (req, res) => {
  try {
    logger.info("[Kick Rewards Admin] Starting sync...");

    const result = await KickRewardService.syncRewardsFromKick();

    res.json({
      success: true,
      message: "Rewards synced successfully",
      ...result,
    });
  } catch (error) {
    if (error instanceof AppError) throw error;
    logger.error("[Kick Rewards Admin] Error syncing:", error.message);
    throw new AppError("Error syncing rewards", 500, error.message);
  }
});

/**
 * Create a new reward in Kick
 * POST /api/admin/kick-rewards
 */
exports.createReward = asyncHandler(async (req, res) => {
  try {
    const {
      title,
      description,
      cost,
      background_color,
      puntos_a_otorgar,
      is_enabled,
      is_user_input_required,
      should_redemptions_skip_request_queue,
      auto_accept,
    } = req.body;

    // Validations
    if (!title || !cost || puntos_a_otorgar === undefined) {
      throw new AppError(
        "Missing required fields: title, cost, puntos_a_otorgar",
        400
      );
    }

    if (cost < 1) {
      throw new AppError("Cost must be at least 1", 400);
    }

    if (title.length > 50) {
      throw new AppError("Title cannot exceed 50 characters", 400);
    }

    if (description && description.length > 200) {
      throw new AppError("Description cannot exceed 200 characters", 400);
    }

    logger.info("[Kick Rewards Admin] Creating reward:", title);

    const result = await KickRewardService.createRewardInKick({
      title,
      description,
      cost,
      background_color,
      puntos_a_otorgar,
      is_enabled,
      is_user_input_required,
      should_redemptions_skip_request_queue,
      auto_accept,
    });

    res.status(201).json({
      success: true,
      message: "Reward created successfully in Kick",
      reward: result.reward,
    });
  } catch (error) {
    if (error instanceof AppError) throw error;
    logger.error("[Kick Rewards Admin] Error creating reward:", error.message);
    throw new AppError("Error creating reward", 500, error.message);
  }
});

/**
 * Update reward
 * PATCH /api/admin/kick-rewards/:id
 */
exports.updateReward = asyncHandler(async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;

    // Find local reward
    const reward = await KickReward.findByPk(id);

    if (!reward) {
      throw new AppError("Reward not found", 404);
    }

    // Validations
    if (updateData.title && updateData.title.length > 50) {
      throw new AppError("Title cannot exceed 50 characters", 400);
    }

    if (updateData.description && updateData.description.length > 200) {
      throw new AppError("Description cannot exceed 200 characters", 400);
    }

    if (updateData.cost !== undefined && updateData.cost < 1) {
      throw new AppError("Cost must be at least 1", 400);
    }

    logger.info("[Kick Rewards Admin] Updating reward:", reward.title);

    // Update in Kick
    const result = await KickRewardService.updateRewardInKick(
      reward.kick_reward_id,
      updateData
    );

    res.json({
      success: true,
      message: "Reward updated successfully",
      reward: result.reward,
    });
  } catch (error) {
    if (error instanceof AppError) throw error;
    logger.error("[Kick Rewards Admin] Error updating reward:", error.message);
    throw new AppError("Error updating reward", 500, error.message);
  }
});

/**
 * Delete reward
 * DELETE /api/admin/kick-rewards/:id
 */
exports.deleteReward = asyncHandler(async (req, res) => {
  try {
    const { id } = req.params;

    // Find local reward
    const reward = await KickReward.findByPk(id);

    if (!reward) {
      throw new AppError("Reward not found", 404);
    }

    logger.info("[Kick Rewards Admin] Deleting reward:", reward.title);

    // Delete in Kick
    await KickRewardService.deleteRewardInKick(reward.kick_reward_id);

    res.json({
      success: true,
      message: "Reward deleted successfully",
    });
  } catch (error) {
    if (error instanceof AppError) throw error;
    logger.error("[Kick Rewards Admin] Error deleting reward:", error.message);
    throw new AppError("Error deleting reward", 500, error.message);
  }
});

/**
 * Get reward statistics
 * GET /api/admin/kick-rewards/stats
 */
exports.getRewardsStats = asyncHandler(async (req, res) => {
  try {
    const rewards = await KickReward.findAll();

    const stats = {
      total: rewards.length,
      enabled: rewards.filter((r) => r.is_enabled).length,
      disabled: rewards.filter((r) => !r.is_enabled).length,
      paused: rewards.filter((r) => r.is_paused).length,
      with_user_input: rewards.filter((r) => r.is_user_input_required).length,
      total_redemptions: rewards.reduce(
        (sum, r) => sum + r.total_redemptions,
        0
      ),
      total_points_configured: rewards.reduce(
        (sum, r) => sum + r.puntos_a_otorgar,
        0
      ),
      most_redeemed: rewards
        .sort((a, b) => b.total_redemptions - a.total_redemptions)
        .slice(0, 5)
        .map((r) => ({
          title: r.title,
          total_redemptions: r.total_redemptions,
          puntos_a_otorgar: r.puntos_a_otorgar,
        })),
    };

    res.json({
      success: true,
      stats,
    });
  } catch (error) {
    if (error instanceof AppError) throw error;
    logger.error("[Kick Rewards Admin] Error fetching stats:", error.message);
    throw new AppError("Error fetching stats", 500);
  }
});

/**
 * Update only points to award (local)
 * PATCH /api/admin/kick-rewards/:id/points
 */
exports.updateRewardPoints = asyncHandler(async (req, res) => {
  try {
    const { id } = req.params;
    const { puntos_a_otorgar, auto_accept } = req.body;

    if (puntos_a_otorgar === undefined) {
      throw new AppError("Missing field puntos_a_otorgar", 400);
    }

    const reward = await KickReward.findByPk(id);

    if (!reward) {
      throw new AppError("Reward not found", 404);
    }

    const updateData = { puntos_a_otorgar };
    if (auto_accept !== undefined) {
      updateData.auto_accept = auto_accept;
    }

    await reward.update(updateData);

    logger.info(
      `[Kick Rewards Admin] Points updated for "${reward.title}": ${puntos_a_otorgar}`
    );

    res.json({
      success: true,
      message: "Points updated successfully",
      reward,
    });
  } catch (error) {
    if (error instanceof AppError) throw error;
    logger.error("[Kick Rewards Admin] Error updating points:", error.message);
    throw new AppError("Error updating points", 500);
  }
});
