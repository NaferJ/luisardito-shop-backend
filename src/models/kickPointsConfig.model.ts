import {
  DataTypes,
  Model,
  InferAttributes,
  InferCreationAttributes,
  CreationOptional,
} from "sequelize";
import { sequelize } from "./database";

class KickPointsConfig extends Model<
  InferAttributes<KickPointsConfig>,
  InferCreationAttributes<KickPointsConfig>
> {
  declare id: CreationOptional<number>;
  declare config_key: string;
  declare config_value: CreationOptional<number>;
  declare description: string | null;
  declare enabled: CreationOptional<boolean>;
  declare created_at: CreationOptional<Date>;
  declare updated_at: CreationOptional<Date>;
}

KickPointsConfig.init(
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    config_key: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true,
      comment: "Unique configuration key",
    },
    config_value: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
      comment: "Points value",
    },
    description: {
      type: DataTypes.STRING,
      allowNull: true,
      comment: "Configuration description",
    },
    enabled: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
      comment: "Whether this configuration is enabled",
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
    tableName: "kick_points_config",
    timestamps: true,
    createdAt: "created_at",
    updatedAt: "updated_at",
  }
);

export = KickPointsConfig;
