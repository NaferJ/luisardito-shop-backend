import {
  DataTypes,
  Model,
  InferAttributes,
  InferCreationAttributes,
  CreationOptional,
} from "sequelize";
import { sequelize } from "./database";

type KickEventSubscriptionStatus = "active" | "inactive" | "error";

class KickEventSubscription extends Model<
  InferAttributes<KickEventSubscription>,
  InferCreationAttributes<KickEventSubscription>
> {
  declare id: CreationOptional<number>;
  declare subscription_id: string;
  declare app_id: string | null;
  declare broadcaster_user_id: number;
  declare event_type: string;
  declare event_version: CreationOptional<number>;
  declare method: CreationOptional<string>;
  declare status: CreationOptional<KickEventSubscriptionStatus>;
  declare created_at: CreationOptional<Date>;
  declare updated_at: CreationOptional<Date>;
}

KickEventSubscription.init(
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    subscription_id: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true,
      comment: "Subscription ID in Kick (ULID)",
    },
    app_id: {
      type: DataTypes.STRING,
      allowNull: true,
      comment: "Application ID in Kick",
    },
    broadcaster_user_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      comment: "Broadcaster ID (Kick user)",
    },
    event_type: {
      type: DataTypes.STRING,
      allowNull: false,
      comment: "Event type (e.g. chat.message.sent, channel.followed)",
    },
    event_version: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 1,
      comment: "Event version",
    },
    method: {
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: "webhook",
      comment: "Delivery method (webhook)",
    },
    status: {
      type: DataTypes.ENUM("active", "inactive", "error"),
      allowNull: false,
      defaultValue: "active",
      comment: "Subscription status",
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
    tableName: "kick_event_subscriptions",
    timestamps: true,
    createdAt: "created_at",
    updatedAt: "updated_at",
    indexes: [
      {
        fields: ["broadcaster_user_id"],
      },
      {
        fields: ["event_type"],
      },
      {
        fields: ["status"],
      },
    ],
  }
);

export = KickEventSubscription;
