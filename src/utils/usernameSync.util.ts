import { Usuario } from "../models";
import { Op } from "sequelize";
import { getRedisClient } from "../config/redis.config";
import logger from "./logger";

interface KickData {
  is_subscriber?: boolean;
  username?: string;
  avatar_url?: string | null;
  last_sync?: string;
  [key: string]: unknown;
}

interface ThrottleInfo {
  throttled: boolean;
  hoursSinceSync: number;
}

interface SyncUsernameResult {
  updated: boolean;
  reason: string;
  oldNickname?: string;
  newNickname?: string;
}

interface SyncProfileResult {
  updated: boolean;
  reason: string;
  usernameChanged?: boolean;
  avatarChanged?: boolean;
  oldNickname?: string | null;
  newNickname?: string | null;
  oldAvatarUrl?: string | null;
  newAvatarUrl?: string | null;
}

interface ProfileUpdateData {
  kick_data: KickData;
  nickname?: string;
}

const THROTTLE_TTL_SECONDS = 86400;

function getThrottleKey(prefix: string, kickUserId: string): string {
  return `${prefix}:${kickUserId}`;
}

async function checkThrottle(
  prefix: string,
  kickUserId: string,
  logPrefix: string,
  debugPrefix: string
): Promise<ThrottleInfo | null> {
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
    const msg =
      redisError instanceof Error ? redisError.message : String(redisError);
    logger.warn(
      `[${logPrefix}] Error in Redis, continuing without throttling:`,
      msg
    );
    logger.debug(`[${debugPrefix}] Redis error, continuing without throttling`);
    return null;
  }
}

async function hasNicknameCollision(
  usuario: Usuario,
  kickUsername: string
): Promise<Usuario | null> {
  return await Usuario.findOne({
    where: {
      nickname: kickUsername,
      id: { [Op.ne]: usuario.id },
    },
  });
}

async function saveThrottle(
  prefix: string,
  kickUserId: string,
  logPrefix: string,
  debugPrefix: string
): Promise<void> {
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
    const msg =
      redisError instanceof Error ? redisError.message : String(redisError);
    logger.warn(`[${logPrefix}] Error saving throttling in Redis:`, msg);
    logger.debug(`[${debugPrefix}] Error saving throttling in Redis`);
  }
}

/**
 * Syncs the username if it has changed in Kick
 *
 * @param usuario - Sequelize Usuario model instance
 * @param kickUsername - Current Kick username
 * @param kickUserId - User ID on Kick
 * @param forceSync - If true, ignores throttling and always syncs
 */
async function syncUsernameIfNeeded(
  usuario: Usuario | null,
  kickUsername: string,
  kickUserId: string,
  forceSync = false
): Promise<SyncUsernameResult> {
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
          ...(usuario.kick_data as KickData),
          username: kickUsername,
          last_sync: new Date().toISOString(),
        },
      });
    } catch (updateError) {
      const msg =
        updateError instanceof Error
          ? updateError.message
          : String(updateError);
      logger.debug(`[DEBUG SYNC] Update error: ${msg}`);
      logger.error(`[Username Sync] Error updating user:`, msg);
      return { updated: false, reason: `DB error: ${msg}` };
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
    const msg = error instanceof Error ? error.message : String(error);
    logger.error(`[Username Sync] Error syncing username:`, msg);
    logger.debug(`[DEBUG SYNC] General error: ${msg}`);
    return {
      updated: false,
      reason: `Error: ${msg}`,
    };
  }
}

function detectProfileChanges(
  usuario: Usuario,
  kickUsername: string,
  kickUserId: string,
  kickProfilePicture: string | null
): {
  usernameChanged: boolean;
  avatarChanged: boolean;
  needsUpdate: boolean;
  newAvatarUrl: string | null;
} {
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
  const currentAvatarUrl = (usuario.kick_data as KickData | null)?.avatar_url;

  if (newAvatarUrl && currentAvatarUrl !== newAvatarUrl) {
    logger.info(`[Profile Sync] Avatar change detected for ${kickUsername}`);
    logger.info(`[Profile Sync] Previous: ${currentAvatarUrl || "no avatar"}`);
    logger.info(`[Profile Sync] New: ${newAvatarUrl}`);
    avatarChanged = true;
    needsUpdate = true;
  }

  return { usernameChanged, avatarChanged, needsUpdate, newAvatarUrl };
}

async function getProfileThrottle(
  forceSync: boolean,
  kickUserId: string
): Promise<ThrottleInfo | null> {
  if (forceSync) {
    return null;
  }
  return await checkThrottle(
    "profile_sync",
    kickUserId,
    "Profile Sync",
    "DEBUG SYNC PROFILE"
  );
}

async function checkProfileCollision(
  usuario: Usuario,
  kickUsername: string,
  usernameChanged: boolean
): Promise<Usuario | null> {
  if (!usernameChanged) {
    return null;
  }
  return await hasNicknameCollision(usuario, kickUsername);
}

function buildProfileUpdateData(
  usuario: Usuario,
  kickUsername: string,
  usernameChanged: boolean,
  avatarChanged: boolean,
  newAvatarUrl: string | null
): ProfileUpdateData {
  const kickData: KickData = {
    ...(usuario.kick_data as KickData),
    username: kickUsername,
    last_sync: new Date().toISOString(),
  };

  const updateData: ProfileUpdateData = {
    kick_data: kickData,
  };

  if (usernameChanged) {
    updateData.nickname = kickUsername;
  }

  if (avatarChanged && newAvatarUrl) {
    updateData.kick_data.avatar_url = newAvatarUrl;
  }

  return updateData;
}

async function applyProfileUpdate(
  usuario: Usuario,
  updateData: ProfileUpdateData
): Promise<Error | null> {
  try {
    await usuario.update(updateData);
    return null;
  } catch (updateError) {
    const msg =
      updateError instanceof Error ? updateError.message : String(updateError);
    logger.debug(`[DEBUG SYNC PROFILE] Update error: ${msg}`);
    logger.error(`[Profile Sync] Error updating user:`, msg);
    return updateError instanceof Error ? updateError : new Error(msg);
  }
}

async function syncUserProfileIfNeeded(
  usuario: Usuario | null,
  kickUsername: string,
  kickUserId: string,
  forceSync = false,
  kickProfilePicture: string | null = null
): Promise<SyncProfileResult> {
  try {
    logger.debug(
      `[DEBUG SYNC PROFILE] Starting full sync for ${kickUserId}: current '${usuario?.nickname}' vs new '${kickUsername}'`
    );

    if (!usuario || !kickUsername || !kickUserId) {
      logger.debug(`[DEBUG SYNC PROFILE] Return: Invalid parameters`);
      return {
        updated: false,
        reason: "Invalid parameters",
      };
    }

    const { usernameChanged, avatarChanged, needsUpdate, newAvatarUrl } =
      detectProfileChanges(
        usuario,
        kickUsername,
        kickUserId,
        kickProfilePicture
      );

    if (!needsUpdate) {
      logger.debug(`[DEBUG SYNC PROFILE] Return: Profile unchanged`);
      return {
        updated: false,
        reason: "Profile unchanged",
        usernameChanged: false,
        avatarChanged: false,
      };
    }

    const throttle = await getProfileThrottle(forceSync, kickUserId);
    if (throttle) {
      return {
        updated: false,
        reason: `Throttling: last sync ${throttle.hoursSinceSync.toFixed(1)}h ago`,
        usernameChanged: false,
        avatarChanged: false,
      };
    }

    const colision = await checkProfileCollision(
      usuario,
      kickUsername,
      usernameChanged
    );
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

    const updateData = buildProfileUpdateData(
      usuario,
      kickUsername,
      usernameChanged,
      avatarChanged,
      newAvatarUrl
    );

    const oldNickname = usuario.nickname;
    const oldAvatarUrl = (usuario.kick_data as KickData | null)?.avatar_url;

    const updateError = await applyProfileUpdate(usuario, updateData);
    if (updateError) {
      return {
        updated: false,
        reason: `DB error: ${updateError.message}`,
        usernameChanged: false,
        avatarChanged: false,
      };
    }

    const usernameChangeStr = usernameChanged
      ? `"${oldNickname}" -> "${kickUsername}"`
      : "username unchanged";
    const avatarChangeStr = avatarChanged ? ", avatar updated" : "";
    logger.info(
      `[Profile Sync] User ID ${usuario.id} updated: ${usernameChangeStr}${avatarChangeStr}`
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
      newAvatarUrl: avatarChanged
        ? (updateData.kick_data.avatar_url ?? null)
        : null,
    };
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    logger.error(`[Profile Sync] Error syncing profile:`, msg);
    logger.debug(`[DEBUG SYNC PROFILE] General error: ${msg}`);
    return {
      updated: false,
      reason: `Error: ${msg}`,
      usernameChanged: false,
      avatarChanged: false,
    };
  }
}

export { syncUsernameIfNeeded, syncUserProfileIfNeeded };
