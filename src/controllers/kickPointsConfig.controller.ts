/* eslint-disable @typescript-eslint/no-explicit-any */
// TEMPORARY eslint override — to be removed in the typing pass

import { KickPointsConfig } from "../models";
import logger from "../utils/logger";
import asyncHandler from "../utils/asyncHandler";
import AppError from "../utils/AppError";

/**
 * Gets all points configuration
 */
const getConfig = asyncHandler(async (req: any, res: any) => {
  try {
    const config: any = await KickPointsConfig.findAll({
      order: [["config_key", "ASC"]],
    });

    logger.debug("[KICK POINTS DEBUG] Configuration found:", {
      total: config.length,
      configs: config.map((c: any) => ({
        key: c.config_key,
        value: c.config_value,
        enabled: c.enabled,
      })),
    });

    // If no configuration, initialize automatically
    if (config.length === 0) {
      logger.warn(
        "[KICK POINTS DEBUG] No configuration found, initializing..."
      );

      const defaultConfigs = [
        {
          config_key: "chat_points_regular",
          config_value: 10,
          description: "Points per chat message (regular users)",
          enabled: true,
        },
        {
          config_key: "chat_points_subscriber",
          config_value: 20,
          description: "Points per chat message (subscribers)",
          enabled: true,
        },
        {
          config_key: "chat_points_vip",
          config_value: 30,
          description: "Points per chat message (VIPs)",
          enabled: true,
        },
        {
          config_key: "follow_points",
          config_value: 50,
          description: "Points for following the channel (first time)",
          enabled: true,
        },
        {
          config_key: "subscription_new_points",
          config_value: 500,
          description: "Points for new subscription",
          enabled: true,
        },
        {
          config_key: "subscription_renewal_points",
          config_value: 300,
          description: "Points for subscription renewal",
          enabled: true,
        },
        {
          config_key: "gift_given_points",
          config_value: 100,
          description: "Points per gifted subscription",
          enabled: true,
        },
        {
          config_key: "gift_received_points",
          config_value: 400,
          description: "Points for receiving a gifted subscription",
          enabled: true,
        },
        {
          config_key: "kicks_gifted_multiplier",
          config_value: 2,
          description: "Points multiplier per gifted kicks",
          enabled: true,
        },
      ];

      const created = [];
      for (const configData of defaultConfigs) {
        const newConfig: any = await KickPointsConfig.create(configData);
        created.push(newConfig);
      }

      logger.info(
        "[KICK POINTS DEBUG] Configuration initialized with",
        created.length,
        "items"
      );

      return res.json({
        config: created,
        total: created.length,
        initialized: true,
        message: "Configuration initialized automatically",
      });
    }

    return res.json({
      config,
      total: config.length,
      initialized: false,
    });
  } catch (error: any) {
    if (error instanceof AppError) throw error;
    logger.error(
      "[KICK POINTS DEBUG] Error fetching configuration:",
      error.message
    );
    throw new AppError("Internal server error", 500);
  }
});

/**
 * Updates a configuration value
 */
const updateConfig = asyncHandler(async (req: any, res: any) => {
  try {
    const { config_key, config_value, enabled } = req.body;

    if (!config_key) {
      throw new AppError("config_key is required", 400);
    }

    const config: any = await KickPointsConfig.findOne({
      where: { config_key },
    });

    if (!config) {
      throw new AppError("Configuration not found", 404);
    }

    const updateData: any = {};
    if (config_value !== undefined) updateData.config_value = config_value;
    if (enabled !== undefined) updateData.enabled = enabled;

    await config.update(updateData);

    return res.json({
      message: "Configuration updated",
      config,
    });
  } catch (error: any) {
    if (error instanceof AppError) throw error;
    logger.error(
      "[Kick Points Config] Error updating configuration:",
      error.message
    );
    throw new AppError("Internal server error", 500);
  }
});

/**
 * Updates multiple configurations at once
 */
const updateMultipleConfigs = asyncHandler(async (req: any, res: any) => {
  try {
    const { configs } = req.body;

    if (!Array.isArray(configs)) {
      throw new AppError("configs must be an array", 400);
    }

    const updated = [];

    for (const configData of configs) {
      const { config_key, config_value, enabled } = configData;

      if (!config_key) continue;

      const config: any = await KickPointsConfig.findOne({
        where: { config_key },
      });

      if (config) {
        const updateData: any = {};
        if (config_value !== undefined) updateData.config_value = config_value;
        if (enabled !== undefined) updateData.enabled = enabled;

        await config.update(updateData);
        updated.push(config);
      }
    }

    return res.json({
      message: `${updated.length} configurations updated`,
      configs: updated,
    });
  } catch (error: any) {
    if (error instanceof AppError) throw error;
    logger.error(
      "[Kick Points Config] Error updating configurations:",
      error.message
    );
    throw new AppError("Internal server error", 500);
  }
});

/**
 * Initializes configuration with default values
 */
const initializeConfig = asyncHandler(async (req: any, res: any) => {
  try {
    const defaultConfigs = [
      {
        config_key: "chat_points_regular",
        config_value: 10,
        description: "Points per chat message (regular users)",
        enabled: true,
      },
      {
        config_key: "chat_points_subscriber",
        config_value: 20,
        description: "Points per chat message (subscribers)",
        enabled: true,
      },
      {
        config_key: "follow_points",
        config_value: 50,
        description: "Points for following the channel (first time)",
        enabled: true,
      },
      {
        config_key: "subscription_new_points",
        config_value: 500,
        description: "Points for new subscription",
        enabled: true,
      },
      {
        config_key: "subscription_renewal_points",
        config_value: 300,
        description: "Points for subscription renewal",
        enabled: true,
      },
      {
        config_key: "gift_given_points",
        config_value: 100,
        description: "Points per gifted subscription",
        enabled: true,
      },
      {
        config_key: "gift_received_points",
        config_value: 400,
        description: "Points for receiving a gifted subscription",
        enabled: true,
      },
      {
        config_key: "kicks_gifted_multiplier",
        config_value: 2,
        description: "Points multiplier per gifted kicks",
        enabled: true,
      },
    ];

    const created = [];

    for (const configData of defaultConfigs) {
      const [config, isCreated] = await KickPointsConfig.findOrCreate({
        where: { config_key: configData.config_key },
        defaults: configData,
      });

      if (isCreated) {
        created.push(config);
      }
    }

    return res.json({
      message: `Configuration initialized (${created.length} new, ${defaultConfigs.length - created.length} existing)`,
      created,
      total: defaultConfigs.length,
    });
  } catch (error: any) {
    if (error instanceof AppError) throw error;
    logger.error(
      "[Kick Points Config] Error initializing configuration:",
      error.message
    );
    throw new AppError("Internal server error", 500);
  }
});

export { getConfig, updateConfig, updateMultipleConfigs, initializeConfig };

export default {
  getConfig,
  updateConfig,
  updateMultipleConfigs,
  initializeConfig,
};
