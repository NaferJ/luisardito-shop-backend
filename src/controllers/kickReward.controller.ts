/* eslint-disable @typescript-eslint/no-explicit-any */
// TEMPORARY eslint override — to be removed in the typing pass

import { KickReward } from "../models";
import * as KickRewardServiceNs from "../services/kickReward.service";
import logger from "../utils/logger";
import asyncHandler from "../utils/asyncHandler";
import AppError from "../utils/AppError";

const KickRewardService: any = KickRewardServiceNs;

/**
 * Get all rewards
 * GET /api/admin/kick-rewards
 */
const getAllRewards = asyncHandler(async (req: any, res: any) => {
  try {
    const rewards: any = await KickReward.findAll({
      order: [["created_at", "DESC"]],
    });

    res.json({
      success: true,
      total: rewards.length,
      rewards,
    });
  } catch (error: any) {
    if (error instanceof AppError) throw error;
    logger.error("[Kick Rewards Admin] Error fetching rewards:", error.message);
    throw new AppError("Error fetching rewards", 500);
  }
});

/**
 * Get a reward by ID
 * GET /api/admin/kick-rewards/:id
 */
const getRewardById = asyncHandler(async (req: any, res: any) => {
  try {
    const { id } = req.params;

    const reward: any = await KickReward.findByPk(id);

    if (!reward) {
      throw new AppError("Reward not found", 404);
    }

    res.json({
      success: true,
      reward,
    });
  } catch (error: any) {
    if (error instanceof AppError) throw error;
    logger.error("[Kick Rewards Admin] Error fetching reward:", error.message);
    throw new AppError("Error fetching reward", 500);
  }
});

/**
 * Sync rewards from Kick
 * POST /api/admin/kick-rewards/sync
 */
const syncRewards = asyncHandler(async (req: any, res: any) => {
  try {
    logger.info("[Kick Rewards Admin] Starting sync...");

    const result = await KickRewardService.syncRewardsFromKick();

    res.json({
      success: true,
      message: "Rewards synced successfully",
      ...result,
    });
  } catch (error: any) {
    if (error instanceof AppError) throw error;
    logger.error("[Kick Rewards Admin] Error syncing:", error.message);
    throw new AppError("Error syncing rewards", 500, error.message);
  }
});

/**
 * Create a new reward in Kick
 * POST /api/admin/kick-rewards
 */
const createReward = asyncHandler(async (req: any, res: any) => {
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
  } catch (error: any) {
    if (error instanceof AppError) throw error;
    logger.error("[Kick Rewards Admin] Error creating reward:", error.message);
    throw new AppError("Error creating reward", 500, error.message);
  }
});

/**
 * Update reward
 * PATCH /api/admin/kick-rewards/:id
 */
const updateReward = asyncHandler(async (req: any, res: any) => {
  try {
    const { id } = req.params;
    const updateData = req.body;

    // Find local reward
    const reward: any = await KickReward.findByPk(id);

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
  } catch (error: any) {
    if (error instanceof AppError) throw error;
    logger.error("[Kick Rewards Admin] Error updating reward:", error.message);
    throw new AppError("Error updating reward", 500, error.message);
  }
});

/**
 * Delete reward
 * DELETE /api/admin/kick-rewards/:id
 */
const deleteReward = asyncHandler(async (req: any, res: any) => {
  try {
    const { id } = req.params;

    // Find local reward
    const reward: any = await KickReward.findByPk(id);

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
  } catch (error: any) {
    if (error instanceof AppError) throw error;
    logger.error("[Kick Rewards Admin] Error deleting reward:", error.message);
    throw new AppError("Error deleting reward", 500, error.message);
  }
});

/**
 * Get reward statistics
 * GET /api/admin/kick-rewards/stats
 */
const getRewardsStats = asyncHandler(async (req: any, res: any) => {
  try {
    const rewards: any = await KickReward.findAll();

    const stats = {
      total: rewards.length,
      enabled: rewards.filter((r: any) => r.is_enabled).length,
      disabled: rewards.filter((r: any) => !r.is_enabled).length,
      paused: rewards.filter((r: any) => r.is_paused).length,
      with_user_input: rewards.filter((r: any) => r.is_user_input_required)
        .length,
      total_redemptions: rewards.reduce(
        (sum: any, r: any) => sum + r.total_redemptions,
        0
      ),
      total_points_configured: rewards.reduce(
        (sum: any, r: any) => sum + r.puntos_a_otorgar,
        0
      ),
      most_redeemed: rewards
        .sort((a: any, b: any) => b.total_redemptions - a.total_redemptions)
        .slice(0, 5)
        .map((r: any) => ({
          title: r.title,
          total_redemptions: r.total_redemptions,
          puntos_a_otorgar: r.puntos_a_otorgar,
        })),
    };

    res.json({
      success: true,
      stats,
    });
  } catch (error: any) {
    if (error instanceof AppError) throw error;
    logger.error("[Kick Rewards Admin] Error fetching stats:", error.message);
    throw new AppError("Error fetching stats", 500);
  }
});

/**
 * Update only points to award (local)
 * PATCH /api/admin/kick-rewards/:id/points
 */
const updateRewardPoints = asyncHandler(async (req: any, res: any) => {
  try {
    const { id } = req.params;
    const { puntos_a_otorgar, auto_accept } = req.body;

    if (puntos_a_otorgar === undefined) {
      throw new AppError("Missing field puntos_a_otorgar", 400);
    }

    const reward: any = await KickReward.findByPk(id);

    if (!reward) {
      throw new AppError("Reward not found", 404);
    }

    const updateData: any = { puntos_a_otorgar };
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
  } catch (error: any) {
    if (error instanceof AppError) throw error;
    logger.error("[Kick Rewards Admin] Error updating points:", error.message);
    throw new AppError("Error updating points", 500);
  }
});

export {
  getAllRewards,
  getRewardById,
  syncRewards,
  createReward,
  updateReward,
  deleteReward,
  getRewardsStats,
  updateRewardPoints,
};

export default {
  getAllRewards,
  getRewardById,
  syncRewards,
  createReward,
  updateReward,
  deleteReward,
  getRewardsStats,
  updateRewardPoints,
};
