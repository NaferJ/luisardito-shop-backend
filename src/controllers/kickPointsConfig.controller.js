const { KickPointsConfig } = require("../models");
const logger = require("../utils/logger");

/**
 * Gets all points configuration
 */
exports.getConfig = async (req, res) => {
  try {
    const config = await KickPointsConfig.findAll({
      order: [["config_key", "ASC"]],
    });

    logger.debug("[KICK POINTS DEBUG] Configuration found:", {
      total: config.length,
      configs: config.map((c) => ({
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
        const newConfig = await KickPointsConfig.create(configData);
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
  } catch (error) {
    logger.error(
      "[KICK POINTS DEBUG] Error fetching configuration:",
      error.message
    );

    // On error, return a basic structure so the frontend does not break
    return res.status(500).json({
      error: "Internal server error",
      config: [],
      total: 0,
      initialized: false,
    });
  }
};

/**
 * Updates a configuration value
 */
exports.updateConfig = async (req, res) => {
  try {
    const { config_key, config_value, enabled } = req.body;

    if (!config_key) {
      return res.status(400).json({ error: "config_key is required" });
    }

    const config = await KickPointsConfig.findOne({
      where: { config_key },
    });

    if (!config) {
      return res.status(404).json({ error: "Configuration not found" });
    }

    const updateData = {};
    if (config_value !== undefined) updateData.config_value = config_value;
    if (enabled !== undefined) updateData.enabled = enabled;

    await config.update(updateData);

    return res.json({
      message: "Configuration updated",
      config,
    });
  } catch (error) {
    logger.error(
      "[Kick Points Config] Error updating configuration:",
      error.message
    );
    return res.status(500).json({ error: "Internal server error" });
  }
};

/**
 * Updates multiple configurations at once
 */
exports.updateMultipleConfigs = async (req, res) => {
  try {
    const { configs } = req.body;

    if (!Array.isArray(configs)) {
      return res.status(400).json({ error: "configs must be an array" });
    }

    const updated = [];

    for (const configData of configs) {
      const { config_key, config_value, enabled } = configData;

      if (!config_key) continue;

      const config = await KickPointsConfig.findOne({
        where: { config_key },
      });

      if (config) {
        const updateData = {};
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
  } catch (error) {
    logger.error(
      "[Kick Points Config] Error updating configurations:",
      error.message
    );
    return res.status(500).json({ error: "Internal server error" });
  }
};

/**
 * Initializes configuration with default values
 */
exports.initializeConfig = async (req, res) => {
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
  } catch (error) {
    logger.error(
      "[Kick Points Config] Error initializing configuration:",
      error.message
    );
    return res.status(500).json({ error: "Internal server error" });
  }
};
