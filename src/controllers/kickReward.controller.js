const { KickReward } = require("../models");
const KickRewardService = require("../services/kickReward.service");
const logger = require("../utils/logger");

/**
 * Get all rewards
 * GET /api/admin/kick-rewards
 */
exports.getAllRewards = async (req, res) => {
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
    logger.error("[Kick Rewards Admin] Error fetching rewards:", error.message);
    res.status(500).json({
      success: false,
      error: "Error fetching rewards",
    });
  }
};

/**
 * Get a reward by ID
 * GET /api/admin/kick-rewards/:id
 */
exports.getRewardById = async (req, res) => {
  try {
    const { id } = req.params;

    const reward = await KickReward.findByPk(id);

    if (!reward) {
      return res.status(404).json({
        success: false,
        error: "Reward not found",
      });
    }

    res.json({
      success: true,
      reward,
    });
  } catch (error) {
    logger.error("[Kick Rewards Admin] Error fetching reward:", error.message);
    res.status(500).json({
      success: false,
      error: "Error fetching reward",
    });
  }
};

/**
 * Sync rewards from Kick
 * POST /api/admin/kick-rewards/sync
 */
exports.syncRewards = async (req, res) => {
  try {
    logger.info("[Kick Rewards Admin] Starting sync...");

    const result = await KickRewardService.syncRewardsFromKick();

    res.json({
      success: true,
      message: "Rewards synced successfully",
      ...result,
    });
  } catch (error) {
    logger.error("[Kick Rewards Admin] Error syncing:", error.message);
    res.status(500).json({
      success: false,
      error: "Error syncing rewards",
      details: error.message,
    });
  }
};

/**
 * Create a new reward in Kick
 * POST /api/admin/kick-rewards
 */
exports.createReward = async (req, res) => {
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
      return res.status(400).json({
        success: false,
        error: "Missing required fields: title, cost, puntos_a_otorgar",
      });
    }

    if (cost < 1) {
      return res.status(400).json({
        success: false,
        error: "Cost must be at least 1",
      });
    }

    if (title.length > 50) {
      return res.status(400).json({
        success: false,
        error: "Title cannot exceed 50 characters",
      });
    }

    if (description && description.length > 200) {
      return res.status(400).json({
        success: false,
        error: "Description cannot exceed 200 characters",
      });
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
    logger.error("[Kick Rewards Admin] Error creating reward:", error.message);
    res.status(500).json({
      success: false,
      error: "Error creating reward",
      details: error.message,
    });
  }
};

/**
 * Update reward
 * PATCH /api/admin/kick-rewards/:id
 */
exports.updateReward = async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;

    // Find local reward
    const reward = await KickReward.findByPk(id);

    if (!reward) {
      return res.status(404).json({
        success: false,
        error: "Reward not found",
      });
    }

    // Validations
    if (updateData.title && updateData.title.length > 50) {
      return res.status(400).json({
        success: false,
        error: "Title cannot exceed 50 characters",
      });
    }

    if (updateData.description && updateData.description.length > 200) {
      return res.status(400).json({
        success: false,
        error: "Description cannot exceed 200 characters",
      });
    }

    if (updateData.cost !== undefined && updateData.cost < 1) {
      return res.status(400).json({
        success: false,
        error: "Cost must be at least 1",
      });
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
    logger.error("[Kick Rewards Admin] Error updating reward:", error.message);
    res.status(500).json({
      success: false,
      error: "Error updating reward",
      details: error.message,
    });
  }
};

/**
 * Delete reward
 * DELETE /api/admin/kick-rewards/:id
 */
exports.deleteReward = async (req, res) => {
  try {
    const { id } = req.params;

    // Find local reward
    const reward = await KickReward.findByPk(id);

    if (!reward) {
      return res.status(404).json({
        success: false,
        error: "Reward not found",
      });
    }

    logger.info("[Kick Rewards Admin] Deleting reward:", reward.title);

    // Delete in Kick
    await KickRewardService.deleteRewardInKick(reward.kick_reward_id);

    res.json({
      success: true,
      message: "Reward deleted successfully",
    });
  } catch (error) {
    logger.error("[Kick Rewards Admin] Error deleting reward:", error.message);
    res.status(500).json({
      success: false,
      error: "Error deleting reward",
      details: error.message,
    });
  }
};

/**
 * Get reward statistics
 * GET /api/admin/kick-rewards/stats
 */
exports.getRewardsStats = async (req, res) => {
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
    logger.error("[Kick Rewards Admin] Error fetching stats:", error.message);
    res.status(500).json({
      success: false,
      error: "Error fetching stats",
    });
  }
};

/**
 * Update only points to award (local)
 * PATCH /api/admin/kick-rewards/:id/points
 */
exports.updateRewardPoints = async (req, res) => {
  try {
    const { id } = req.params;
    const { puntos_a_otorgar, auto_accept } = req.body;

    if (puntos_a_otorgar === undefined) {
      return res.status(400).json({
        success: false,
        error: "Missing field puntos_a_otorgar",
      });
    }

    const reward = await KickReward.findByPk(id);

    if (!reward) {
      return res.status(404).json({
        success: false,
        error: "Reward not found",
      });
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
    logger.error("[Kick Rewards Admin] Error updating points:", error.message);
    res.status(500).json({
      success: false,
      error: "Error updating points",
    });
  }
};
