import {
  DataTypes,
  Model,
  InferAttributes,
  InferCreationAttributes,
  CreationOptional,
} from "sequelize";
import { sequelize } from "./database";

class KickBotToken extends Model<
  InferAttributes<KickBotToken>,
  InferCreationAttributes<KickBotToken>
> {
  declare id: CreationOptional<number>;
  declare kick_user_id: string;
  declare kick_username: string;
  declare access_token: string;
  declare refresh_token: string | null;
  declare token_expires_at: Date;
  declare is_active: CreationOptional<boolean>;
  declare scopes: string[] | null;
  declare created_at: CreationOptional<Date>;
  declare updated_at: CreationOptional<Date>;
}

KickBotToken.init(
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    kick_user_id: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true,
    },
    kick_username: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    access_token: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
    refresh_token: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    token_expires_at: {
      type: DataTypes.DATE,
      allowNull: false,
    },
    is_active: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
    },
    scopes: {
      type: DataTypes.JSON,
      allowNull: true,
      comment: "Scopes authorized for the bot",
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
    tableName: "kick_bot_tokens",
    timestamps: true,
    createdAt: "created_at",
    updatedAt: "updated_at",
  }
);

export = KickBotToken;
