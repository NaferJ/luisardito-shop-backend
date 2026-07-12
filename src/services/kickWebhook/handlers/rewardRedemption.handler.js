const _models = require("../../../models");
const { KickReward, Usuario, HistorialPunto, sequelize } = _models;
const NotificacionService = require("../../notificacion.service");
const { Transaction } = require("sequelize");
const logger = require("../../../utils/logger");

/**
 * Send chat message notifying user they are not registered for reward redemption
 */
async function notifyUnregisteredReward(kickUsername, localReward) {
  try {
    const bot = require("../../kickBot.service");
    const message = `@${kickUsername} your reward "${localReward.title}" could not be processed because you are not registered in the shop. Register at https://shop.luisardito.com/ to receive your points!`;
    await bot.sendMessage(message);
    logger.info(`[Reward Redemption] Message sent to ${kickUsername} in chat`);
  } catch (botError) {
    logger.error(
      `[Reward Redemption] Error sending chat message:`,
      botError.message
    );
  }
}

/**
 * Handle channel reward redemptions
 */
async function handleRewardRedemption(payload, _metadata) {
  try {
    const { id: redemptionId, reward, redeemer, status, user_input } = payload;
    const kickRewardId = reward.id;
    const kickUserId = String(redeemer.user_id);
    const kickUsername = redeemer.username;

    logger.info(
      `[Reward Redemption] ${kickUsername} redeemed "${reward.title}" (${reward.cost} pts) - Status: ${status}`
    );

    // Find reward in our DB
    const localReward = await KickReward.findOne({
      where: { kick_reward_id: kickRewardId },
    });

    if (!localReward) {
      logger.warn(
        `[Reward Redemption] Reward "${reward.title}" (${kickRewardId}) not configured in DB`
      );
      return;
    }

    // ALWAYS find user in our DB (for both cases: pending and accepted)
    let usuario = await Usuario.findOne({
      where: { user_id_ext: kickUserId },
    });

    // If pending and user doesn't exist, send message
    if (status === "pending" && !usuario) {
      logger.warn(
        `[Reward Redemption] User ${kickUsername} not registered in store`
      );

      await notifyUnregisteredReward(kickUsername, localReward);
      return;
    }

    // If pending and user DOES exist, just wait
    if (status === "pending") {
      logger.info(
        `[Reward Redemption] User registered. Redemption pending approval - waiting...`
      );
      return;
    }

    if (status === "rejected") {
      logger.info(
        `[Reward Redemption] Redemption rejected - no points processed`
      );
      return;
    }

    if (status !== "accepted") {
      logger.warn(`[Reward Redemption] Unknown status: ${status}`);
      return;
    }

    // Search again in case user registered after pending
    if (!usuario) {
      usuario = await Usuario.findOne({
        where: { user_id_ext: kickUserId },
      });
    }

    // If user STILL doesn't exist after accepted
    if (!usuario) {
      logger.warn(
        `[Reward Redemption] User ${kickUsername} still not registered. No points awarded.`
      );
      return;
    }

    if (!localReward.is_enabled) {
      logger.info(`[Reward Redemption] Reward "${localReward.title}" disabled`);
      return;
    }

    // Award points
    const puntosAOtorgar = localReward.puntos_a_otorgar;

    if (puntosAOtorgar <= 0) {
      logger.info(
        `[Reward Redemption] Reward "${localReward.title}" awards no points (configured at 0)`
      );
      return;
    }

    const transaction = await sequelize.transaction({
      isolationLevel: Transaction.ISOLATION_LEVELS.READ_COMMITTED,
    });

    try {
      // Increment user points
      await usuario.increment("puntos", {
        by: puntosAOtorgar,
        transaction,
      });

      // Register in history
      await HistorialPunto.create(
        {
          usuario_id: usuario.id,
          puntos: puntosAOtorgar,
          tipo: "ganado",
          concepto: `Canje de recompensa: ${localReward.title}`,
          kick_event_data: {
            event_type: "channel.reward.redemption.updated",
            redemption_id: redemptionId,
            reward_id: kickRewardId,
            reward_title: localReward.title,
            reward_cost: reward.cost,
            user_input: user_input || "",
          },
        },
        { transaction }
      );

      // Create notification for earned points
      await NotificacionService.crearNotificacionPuntosGanados(
        usuario.id,
        {
          cantidad: puntosAOtorgar,
          concepto: `Canje de recompensa: ${localReward.title}`,
          tipo_evento: "channel.reward.redemption.updated",
        },
        transaction
      );

      // Increment redemption counter
      await localReward.increment("total_redemptions", {
        by: 1,
        transaction,
      });

      await transaction.commit();

      await usuario.reload();
      logger.info(
        `[Reward Redemption] ${kickUsername} received ${puntosAOtorgar} points. Total: ${usuario.puntos}`
      );
    } catch (error) {
      if (!transaction.finished) {
        await transaction.rollback();
      }
      throw error;
    }
  } catch (error) {
    logger.error("[Reward Redemption] Error:", error.message);
  }
}

module.exports = { handleRewardRedemption };
