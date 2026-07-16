import { KickReward } from "../models";
import logger from "../utils/logger";

/**
 * Simplified service for Kick Rewards
 * Only handles local data for the webhook
 * Rewards are created manually on Kick.com
 */

/**
 * Gets a reward by its kick_reward_id
 * Used by the webhook to process redemptions
 * @param kickRewardId - Reward ID on Kick
 * @returns Reward model instance or null
 */
async function getRewardByKickId(kickRewardId: string) {
  try {
    const reward = await KickReward.findOne({
      where: { kick_reward_id: kickRewardId },
    });
    return reward;
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    logger.error("[Kick Rewards] Error getting reward by kick_id:", msg);
    throw error;
  }
}

/**
 * Gets reward statistics
 * @returns Object with reward statistics
 */
async function getRewardStats() {
  try {
    const [totalRewards, enabledRewards, totalRedemptions] = await Promise.all([
      KickReward.count(),
      KickReward.count({ where: { is_enabled: true } }),
      KickReward.sum("total_redemptions") || 0,
    ]);

    return {
      total_rewards: totalRewards,
      enabled_rewards: enabledRewards,
      disabled_rewards: totalRewards - enabledRewards,
      total_redemptions: totalRedemptions,
    };
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    logger.error("[Kick Rewards] Error getting statistics:", msg);
    throw error;
  }
}

export { getRewardByKickId, getRewardStats };
