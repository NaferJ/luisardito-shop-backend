const { Usuario } = require("../models");
const { Op } = require("sequelize");
const { getRedisClient } = require("../config/redis.config");
const logger = require("./logger");

const THROTTLE_TTL_SECONDS = 86400;

function getThrottleKey(prefix, kickUserId) {
  return `${prefix}:${kickUserId}`;
}

async function checkThrottle(prefix, kickUserId, logPrefix, debugPrefix) {
  try {
    const redis = getRedisClient();
    const syncKey = getThrottleKey(prefix, kickUserId);
    const lastSync = await redis.get(syncKey);

    if (!lastSync) {
      return null;
    }

    const lastSyncDate = new Date(lastSync);
    const hoursSinceSync =
      (Date.now() - lastSyncDate.getTime()) / (1000 * 60 * 60);

    logger.info(
      `[${logPrefix}] Last sync ${hoursSinceSync.toFixed(1)}h ago - Throttling active (24h)`
    );
    logger.debug(
      `[${debugPrefix}] Return: Throttling active (${hoursSinceSync.toFixed(1)}h)`
    );

    return { throttled: true, hoursSinceSync };
  } catch (redisError) {
    logger.warn(
      `[${logPrefix}] Error in Redis, continuing without throttling:`,
      redisError.message
    );
    logger.debug(`[${debugPrefix}] Redis error, continuing without throttling`);
    return null;
  }
}

async function hasNicknameCollision(usuario, kickUsername) {
  return await Usuario.findOne({
    where: {
      nickname: kickUsername,
      id: { [Op.ne]: usuario.id },
    },
  });
}

async function saveThrottle(prefix, kickUserId, logPrefix, debugPrefix) {
  try {
    const redis = getRedisClient();
    const syncKey = getThrottleKey(prefix, kickUserId);
    await redis.set(
      syncKey,
      new Date().toISOString(),
      "EX",
      THROTTLE_TTL_SECONDS
    );
    logger.info(
      `[${logPrefix}] Throttling activated for 24h for user ${kickUserId}`
    );
    logger.debug(`[${debugPrefix}] Throttling saved in Redis`);
  } catch (redisError) {
    logger.warn(
      `[${logPrefix}] Error saving throttling in Redis:`,
      redisError.message
    );
    logger.debug(`[${debugPrefix}] Error saving throttling in Redis`);
  }
}

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
    logger.debug(
      `[DEBUG SYNC] Starting sync for ${kickUserId}: current '${usuario?.nickname}' vs new '${kickUsername}'`
    );

    if (!usuario || !kickUsername || !kickUserId) {
      logger.debug(`[DEBUG SYNC] Return: Invalid parameters`);
      return { updated: false, reason: "Invalid parameters" };
    }

    if (usuario.nickname === kickUsername) {
      logger.debug(`[DEBUG SYNC] Return: Name unchanged`);
      return { updated: false, reason: "Name unchanged" };
    }

    logger.info(
      `[Username Sync] Change detected: "${usuario.nickname}" -> "${kickUsername}" (ID: ${kickUserId})`
    );

    if (!forceSync) {
      const throttle = await checkThrottle(
        "username_sync",
        kickUserId,
        "Username Sync",
        "DEBUG SYNC"
      );
      if (throttle) {
        return {
          updated: false,
          reason: `Throttling: last sync ${throttle.hoursSinceSync.toFixed(1)}h ago`,
        };
      }
    }

    const colision = await hasNicknameCollision(usuario, kickUsername);

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

    if (!forceSync) {
      await saveThrottle(
        "username_sync",
        kickUserId,
        "Username Sync",
        "DEBUG SYNC"
      );
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
    logger.debug(
      `[DEBUG SYNC PROFILE] Starting full sync for ${kickUserId}: current '${usuario?.nickname}' vs new '${kickUsername}'`
    );

    if (!usuario || !kickUsername || !kickUserId) {
      logger.debug(`[DEBUG SYNC PROFILE] Return: Invalid parameters`);
      return { updated: false, reason: "Invalid parameters" };
    }

    let usernameChanged = false;
    let avatarChanged = false;
    let needsUpdate = false;

    if (usuario.nickname !== kickUsername) {
      logger.info(
        `[Profile Sync] Username change detected: "${usuario.nickname}" -> "${kickUsername}" (ID: ${kickUserId})`
      );
      usernameChanged = true;
      needsUpdate = true;
    }

    const newAvatarUrl = kickProfilePicture || null;
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

    if (!needsUpdate) {
      logger.debug(`[DEBUG SYNC PROFILE] Return: Profile unchanged`);
      return {
        updated: false,
        reason: "Profile unchanged",
        usernameChanged: false,
        avatarChanged: false,
      };
    }

    if (!forceSync) {
      const throttle = await checkThrottle(
        "profile_sync",
        kickUserId,
        "Profile Sync",
        "DEBUG SYNC PROFILE"
      );
      if (throttle) {
        return {
          updated: false,
          reason: `Throttling: last sync ${throttle.hoursSinceSync.toFixed(1)}h ago`,
          usernameChanged: false,
          avatarChanged: false,
        };
      }
    }

    if (usernameChanged) {
      const colision = await hasNicknameCollision(usuario, kickUsername);

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

    if (!forceSync) {
      await saveThrottle(
        "profile_sync",
        kickUserId,
        "Profile Sync",
        "DEBUG SYNC PROFILE"
      );
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
