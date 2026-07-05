const { KickReward } = require("../models");
const logger = require("../utils/logger");

/**
 * Simplified service for Kick Rewards
 * Only handles local data for the webhook
 * Rewards are created manually on Kick.com
 */

/**
 * Gets a reward by its kick_reward_id
 * Used by the webhook to process redemptions
 * @param {string} kickRewardId - Reward ID on Kick
 * @returns {Promise<Object|null>}
 */
async function getRewardByKickId(kickRewardId) {
  try {
    const reward = await KickReward.findOne({
      where: { kick_reward_id: kickRewardId },
    });
    return reward;
  } catch (error) {
    logger.error(
      "[Kick Rewards] Error getting reward by kick_id:",
      error.message
    );
    throw error;
  }
}

/**
 * Gets reward statistics
 * @returns {Promise<Object>}
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
    logger.error("[Kick Rewards] Error getting statistics:", error.message);
    throw error;
  }
}

module.exports = {
  getRewardByKickId,
  getRewardStats,
};
