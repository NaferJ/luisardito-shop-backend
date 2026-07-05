const { Usuario } = require("../models");
const { Op } = require("sequelize");
const { getRedisClient } = require("../config/redis.config");
const logger = require("./logger");

/**
 * Syncs the username if it has changed in Kick
 *
 * @param {Object} usuario - Sequelize Usuario model instance
 * @param {string} kickUsername - Current Kick username
 * @param {string} kickUserId - User ID on Kick
 * @param {boolean} forceSync - If true, ignores throttling and always syncs
 * @returns {Promise<{updated: boolean, reason: string}>}
 */
async function syncUsernameIfNeeded(
  usuario,
  kickUsername,
  kickUserId,
  forceSync = false
) {
  try {
    // DEBUG: Log al inicio
    logger.debug(
      `[DEBUG SYNC] Starting sync for ${kickUserId}: current '${usuario?.nickname}' vs new '${kickUsername}'`
    );

    // Basic validations
    if (!usuario || !kickUsername || !kickUserId) {
      logger.debug(`[DEBUG SYNC] Return: Invalid parameters`);
      return { updated: false, reason: "Invalid parameters" };
    }

    // If the name has not changed, do nothing
    if (usuario.nickname === kickUsername) {
      logger.debug(`[DEBUG SYNC] Return: Name unchanged`);
      return { updated: false, reason: "Name unchanged" };
    }

    logger.info(
      `[Username Sync] Change detected: "${usuario.nickname}" -> "${kickUsername}" (ID: ${kickUserId})`
    );

    // If not forced, check throttling with Redis
    if (!forceSync) {
      try {
        const redis = getRedisClient();
        const syncKey = `username_sync:${kickUserId}`;
        const lastSync = await redis.get(syncKey);

        if (lastSync) {
          const lastSyncDate = new Date(lastSync);
          const hoursSinceSync =
            (Date.now() - lastSyncDate.getTime()) / (1000 * 60 * 60);

          logger.info(
            `[Username Sync] Last sync ${hoursSinceSync.toFixed(1)}h ago - Throttling active (24h)`
          );
          logger.debug(
            `[DEBUG SYNC] Return: Throttling active (${hoursSinceSync.toFixed(1)}h)`
          );
          return {
            updated: false,
            reason: `Throttling: last sync ${hoursSinceSync.toFixed(1)}h ago`,
          };
        }
      } catch (redisError) {
        logger.warn(
          `[Username Sync] Error in Redis, continuing without throttling:`,
          redisError.message
        );
        logger.debug(`[DEBUG SYNC] Redis error, continuing without throttling`);
      }
    }

    // Check collision: the new name already exists on another user
    const colision = await Usuario.findOne({
      where: {
        nickname: kickUsername,
        id: { [Op.ne]: usuario.id },
      },
    });

    if (colision) {
      logger.warn(
        `[Username Sync] COLLISION: "${kickUsername}" already exists (user ID: ${colision.id})`
      );
      logger.debug(`[DEBUG SYNC] Return: Collision with user ${colision.id}`);
      return {
        updated: false,
        reason: `Collision: name already used by user ID ${colision.id}`,
      };
    }

    // Update the user
    const oldNickname = usuario.nickname;
    try {
      await usuario.update({
        nickname: kickUsername,
        kick_data: {
          ...usuario.kick_data,
          username: kickUsername,
          last_sync: new Date().toISOString(),
        },
      });
    } catch (updateError) {
      logger.debug(`[DEBUG SYNC] Update error: ${updateError.message}`);
      logger.error(`[Username Sync] Error updating user:`, updateError.message);
      return { updated: false, reason: `DB error: ${updateError.message}` };
    }

    logger.info(
      `[Username Sync] User ID ${usuario.id} updated: "${oldNickname}" -> "${kickUsername}"`
    );
    logger.debug(
      `[DEBUG SYNC] Update successful: "${oldNickname}" -> "${kickUsername}"`
    );

    // Save in Redis that we synced (expires in 24 hours)
    if (!forceSync) {
      try {
        const redis = getRedisClient();
        const syncKey = `username_sync:${kickUserId}`;
        await redis.set(syncKey, new Date().toISOString(), "EX", 86400); // 24 hours
        logger.info(
          `[Username Sync] Throttling activated for 24h for user ${kickUserId}`
        );
        logger.debug(`[DEBUG SYNC] Throttling saved in Redis`);
      } catch (redisError) {
        logger.warn(
          `[Username Sync] Error saving throttling in Redis:`,
          redisError.message
        );
        logger.debug(`[DEBUG SYNC] Error saving throttling in Redis`);
        // Do not fail if Redis fails
      }
    }

    return {
      updated: true,
      reason: "Sync successful",
      oldNickname,
      newNickname: kickUsername,
    };
  } catch (error) {
    logger.error(`[Username Sync] Error syncing username:`, error.message);
    logger.debug(`[DEBUG SYNC] General error: ${error.message}`);
    return {
      updated: false,
      reason: `Error: ${error.message}`,
    };
  }
}

/**
 * Syncs the full user profile (username and avatar) if it has changed in Kick
 *
 * @param {Object} usuario - Sequelize Usuario model instance
 * @param {string} kickUsername - Current Kick username
 * @param {string} kickUserId - User ID on Kick
 * @param {boolean} forceSync - If true, ignores throttling and always syncs
 * @param {string} [kickProfilePicture] - Profile picture URL from the webhook (optional)
 * @returns {Promise<{updated: boolean, reason: string, usernameChanged: boolean, avatarChanged: boolean}>}
 */
async function syncUserProfileIfNeeded(
  usuario,
  kickUsername,
  kickUserId,
  forceSync = false,
  kickProfilePicture = null
) {
  try {
    // DEBUG: Log al inicio
    logger.debug(
      `[DEBUG SYNC PROFILE] Starting full sync for ${kickUserId}: current '${usuario?.nickname}' vs new '${kickUsername}'`
    );

    // Basic validations
    if (!usuario || !kickUsername || !kickUserId) {
      logger.debug(`[DEBUG SYNC PROFILE] Return: Invalid parameters`);
      return { updated: false, reason: "Invalid parameters" };
    }

    let usernameChanged = false;
    let avatarChanged = false;
    let needsUpdate = false;

    // Check if the name changed
    if (usuario.nickname !== kickUsername) {
      logger.info(
        `[Profile Sync] Username change detected: "${usuario.nickname}" -> "${kickUsername}" (ID: ${kickUserId})`
      );
      usernameChanged = true;
      needsUpdate = true;
    }

    // Check if the avatar changed
    // The Kick webhook ALWAYS includes profile_picture according to the docs
    let newAvatarUrl = kickProfilePicture || null;

    const currentAvatarUrl = usuario.kick_data?.avatar_url;
    if (newAvatarUrl && currentAvatarUrl !== newAvatarUrl) {
      logger.info(`[Profile Sync] Avatar change detected for ${kickUsername}`);
      logger.info(
        `[Profile Sync] Previous: ${currentAvatarUrl || "no avatar"}`
      );
      logger.info(`[Profile Sync] New: ${newAvatarUrl}`);
      avatarChanged = true;
      needsUpdate = true;
    }

    // If no changes, do nothing
    if (!needsUpdate) {
      logger.debug(`[DEBUG SYNC PROFILE] Return: Profile unchanged`);
      return {
        updated: false,
        reason: "Profile unchanged",
        usernameChanged: false,
        avatarChanged: false,
      };
    }

    // If not forced, check throttling with Redis
    if (!forceSync) {
      try {
        const redis = getRedisClient();
        const syncKey = `profile_sync:${kickUserId}`;
        const lastSync = await redis.get(syncKey);

        if (lastSync) {
          const lastSyncDate = new Date(lastSync);
          const hoursSinceSync =
            (Date.now() - lastSyncDate.getTime()) / (1000 * 60 * 60);

          logger.info(
            `[Profile Sync] Last sync ${hoursSinceSync.toFixed(1)}h ago - Throttling active (24h)`
          );
          logger.debug(
            `[DEBUG SYNC PROFILE] Return: Throttling active (${hoursSinceSync.toFixed(1)}h)`
          );
          return {
            updated: false,
            reason: `Throttling: last sync ${hoursSinceSync.toFixed(1)}h ago`,
            usernameChanged: false,
            avatarChanged: false,
          };
        }
      } catch (redisError) {
        logger.warn(
          `[Profile Sync] Error in Redis, continuing without throttling:`,
          redisError.message
        );
        logger.debug(
          `[DEBUG SYNC PROFILE] Redis error, continuing without throttling`
        );
      }
    }

    // Check collision: the new name already exists on another user
    if (usernameChanged) {
      const colision = await Usuario.findOne({
        where: {
          nickname: kickUsername,
          id: { [Op.ne]: usuario.id },
        },
      });

      if (colision) {
        logger.warn(
          `[Profile Sync] COLLISION: "${kickUsername}" already exists (user ID: ${colision.id})`
        );
        logger.debug(
          `[DEBUG SYNC PROFILE] Return: Collision with user ${colision.id}`
        );
        return {
          updated: false,
          reason: `Collision: name already used by user ID ${colision.id}`,
          usernameChanged: false,
          avatarChanged: false,
        };
      }
    }

    // Prepare data for update
    const updateData = {
      kick_data: {
        ...usuario.kick_data,
        username: kickUsername,
        last_sync: new Date().toISOString(),
      },
    };

    if (usernameChanged) {
      updateData.nickname = kickUsername;
    }

    if (avatarChanged && newAvatarUrl) {
      updateData.kick_data.avatar_url = newAvatarUrl;
    }

    // Update the user
    const oldNickname = usuario.nickname;
    const oldAvatarUrl = usuario.kick_data?.avatar_url;

    try {
      await usuario.update(updateData);
    } catch (updateError) {
      logger.debug(`[DEBUG SYNC PROFILE] Update error: ${updateError.message}`);
      logger.error(`[Profile Sync] Error updating user:`, updateError.message);
      return {
        updated: false,
        reason: `DB error: ${updateError.message}`,
        usernameChanged: false,
        avatarChanged: false,
      };
    }

    logger.info(
      `[Profile Sync] User ID ${usuario.id} updated: ${usernameChanged ? `"${oldNickname}" -> "${kickUsername}"` : "username unchanged"}${avatarChanged ? ", avatar updated" : ""}`
    );
    logger.debug(
      `[DEBUG SYNC PROFILE] Update successful: username=${usernameChanged}, avatar=${avatarChanged}`
    );

    // Save in Redis that we synced (expires in 24 hours)
    if (!forceSync) {
      try {
        const redis = getRedisClient();
        const syncKey = `profile_sync:${kickUserId}`;
        await redis.set(syncKey, new Date().toISOString(), "EX", 86400); // 24 hours
        logger.info(
          `[Profile Sync] Throttling activated for 24h for user ${kickUserId}`
        );
        logger.debug(`[DEBUG SYNC PROFILE] Throttling saved in Redis`);
      } catch (redisError) {
        logger.warn(
          `[Profile Sync] Error saving throttling in Redis:`,
          redisError.message
        );
        logger.debug(`[DEBUG SYNC PROFILE] Error saving throttling in Redis`);
        // Do not fail if Redis fails
      }
    }

    return {
      updated: true,
      reason: "Sync successful",
      usernameChanged,
      avatarChanged,
      oldNickname: usernameChanged ? oldNickname : null,
      newNickname: usernameChanged ? kickUsername : null,
      oldAvatarUrl: avatarChanged ? oldAvatarUrl : null,
      newAvatarUrl: avatarChanged ? updateData.kick_data.avatar_url : null,
    };
  } catch (error) {
    logger.error(`[Profile Sync] Error syncing profile:`, error.message);
    logger.debug(`[DEBUG SYNC PROFILE] General error: ${error.message}`);
    return {
      updated: false,
      reason: `Error: ${error.message}`,
      usernameChanged: false,
      avatarChanged: false,
    };
  }
}

module.exports = {
  syncUsernameIfNeeded,
  syncUserProfileIfNeeded,
};
