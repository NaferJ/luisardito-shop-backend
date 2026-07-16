import {
  DataTypes,
  Model,
  InferAttributes,
  InferCreationAttributes,
  CreationOptional,
} from "sequelize";
import { sequelize } from "./database";
import logger from "../utils/logger";

interface BotrixConfigData {
  id?: number;
  migration_enabled: boolean;
  vip_points_enabled: boolean;
  vip_chat_points: number;
  vip_follow_points: number;
  vip_sub_points: number;
  watchtime_migration_enabled: boolean;
  created_at?: Date;
  updated_at?: Date;
}

class BotrixMigrationConfig extends Model<
  InferAttributes<BotrixMigrationConfig>,
  InferCreationAttributes<BotrixMigrationConfig>
> {
  declare id: CreationOptional<number>;
  declare migration_enabled: CreationOptional<boolean>;
  declare vip_points_enabled: CreationOptional<boolean>;
  declare vip_chat_points: CreationOptional<number>;
  declare vip_follow_points: CreationOptional<number>;
  declare vip_sub_points: CreationOptional<number>;
  declare watchtime_migration_enabled: CreationOptional<boolean>;
  declare created_at: CreationOptional<Date>;
  declare updated_at: CreationOptional<Date>;

  // Static methods
  static async getConfig(): Promise<BotrixConfigData> {
    try {
      const config = await this.findByPk(1);

      if (!config) {
        // Create default config if it does not exist
        const defaultConfig = await this.create({
          migration_enabled: true,
          vip_points_enabled: false,
          vip_chat_points: 5,
          vip_follow_points: 100,
          vip_sub_points: 300,
          watchtime_migration_enabled: true,
        });
        return defaultConfig.toJSON() as BotrixConfigData;
      }

      return config.toJSON() as BotrixConfigData;
    } catch (error) {
      logger.error("Error getting config:", error);
      // Return default values on error
      return {
        migration_enabled: true,
        vip_points_enabled: false,
        vip_chat_points: 5,
        vip_follow_points: 100,
        vip_sub_points: 300,
        watchtime_migration_enabled: true,
      };
    }
  }

  static async setConfig(
    key: string,
    value: boolean | number
  ): Promise<BotrixMigrationConfig> {
    try {
      let config = await this.findByPk(1);

      if (!config) {
        // Create config if it does not exist
        const updateData: Record<string, boolean | number> = {
          migration_enabled: true,
          vip_points_enabled: false,
          vip_chat_points: 5,
          vip_follow_points: 100,
          vip_sub_points: 300,
          watchtime_migration_enabled: true,
        };
        updateData[key] = value;
        config = await this.create(updateData);
      } else {
        // Update existing config
        await config.update({ [key]: value });
      }

      return config;
    } catch (error) {
      logger.error("Error updating config:", error);
      throw error;
    }
  }
}

BotrixMigrationConfig.init(
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    migration_enabled: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
    },
    vip_points_enabled: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },
    vip_chat_points: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 5,
    },
    vip_follow_points: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 100,
    },
    vip_sub_points: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 300,
    },
    watchtime_migration_enabled: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
      comment: "Enables/disables watchtime migration from Botrix",
    },
    created_at: {
      type: DataTypes.DATE,
    },
    updated_at: {
      type: DataTypes.DATE,
    },
  },
  {
    sequelize,
    tableName: "botrix_migration_config",
    timestamps: true,
    createdAt: "created_at",
    updatedAt: "updated_at",
  }
);

export = BotrixMigrationConfig;
