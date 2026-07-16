import {
  DataTypes,
  Model,
  InferAttributes,
  InferCreationAttributes,
  CreationOptional,
} from "sequelize";
import { sequelize } from "./database";

class KickBroadcasterToken extends Model<
  InferAttributes<KickBroadcasterToken>,
  InferCreationAttributes<KickBroadcasterToken>
> {
  declare id: CreationOptional<number>;
  declare kick_user_id: string;
  declare kick_username: string;
  declare access_token: string;
  declare refresh_token: string | null;
  declare token_expires_at: Date | null;
  declare scopes: Record<string, unknown> | null;
  declare is_active: CreationOptional<boolean>;
  declare auto_subscribed: CreationOptional<boolean>;
  declare last_subscription_attempt: Date | null;
  declare subscription_error: string | null;
  declare created_at: CreationOptional<Date>;
  declare updated_at: CreationOptional<Date>;
}

KickBroadcasterToken.init(
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
      comment: "Broadcaster ID on Kick",
    },
    kick_username: {
      type: DataTypes.STRING,
      allowNull: false,
      comment: "Broadcaster username",
    },
    access_token: {
      type: DataTypes.TEXT,
      allowNull: false,
      comment: "Kick access token (encrypted in production)",
    },
    refresh_token: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: "Refresh token (if available)",
    },
    token_expires_at: {
      type: DataTypes.DATE,
      allowNull: true,
      comment: "When the token expires",
    },
    scopes: {
      type: DataTypes.JSON,
      allowNull: true,
      comment: "Scopes authorized by the broadcaster",
    },
    is_active: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
      comment: "Whether the connection is active",
    },
    auto_subscribed: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
      comment: "Whether it auto-subscribed to events successfully",
    },
    last_subscription_attempt: {
      type: DataTypes.DATE,
      allowNull: true,
      comment: "Last time a subscription was attempted",
    },
    subscription_error: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: "Error from the last subscription (if any)",
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
    tableName: "kick_broadcaster_tokens",
    timestamps: true,
    createdAt: "created_at",
    updatedAt: "updated_at",
    indexes: [
      {
        fields: ["kick_user_id"],
      },
      {
        fields: ["is_active"],
      },
    ],
  }
);

export = KickBroadcasterToken;
