import {
  DataTypes,
  Model,
  InferAttributes,
  InferCreationAttributes,
  CreationOptional,
} from "sequelize";
import { sequelize } from "./database";

class KickUserTracking extends Model<
  InferAttributes<KickUserTracking>,
  InferCreationAttributes<KickUserTracking>
> {
  declare id: CreationOptional<number>;
  declare kick_user_id: string;
  declare kick_username: string;
  // Follow tracking
  declare has_followed: CreationOptional<boolean>;
  declare first_follow_at: Date | null;
  declare follow_points_awarded: CreationOptional<boolean>;
  // Subscription tracking
  declare is_subscribed: CreationOptional<boolean>;
  declare subscription_expires_at: Date | null;
  declare subscription_duration_months: number | null;
  declare total_subscriptions: CreationOptional<number>;
  declare total_gifts_received: CreationOptional<number>;
  declare total_gifts_given: CreationOptional<number>;
  declare total_kicks_gifted: CreationOptional<number>;
  declare created_at: CreationOptional<Date>;
  declare updated_at: CreationOptional<Date>;
}

KickUserTracking.init(
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
      comment: "Kick user ID",
    },
    kick_username: {
      type: DataTypes.STRING,
      allowNull: false,
      comment: "Kick username",
    },
    // Follow tracking
    has_followed: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
      comment: "Whether they have ever followed the channel",
    },
    first_follow_at: {
      type: DataTypes.DATE,
      allowNull: true,
      comment: "First time they followed the channel",
    },
    follow_points_awarded: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
      comment: "Whether points have already been awarded for following",
    },
    // Subscription tracking
    is_subscribed: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
      comment: "Whether they are currently subscribed",
    },
    subscription_expires_at: {
      type: DataTypes.DATE,
      allowNull: true,
      comment: "When their current subscription expires",
    },
    subscription_duration_months: {
      type: DataTypes.INTEGER,
      allowNull: true,
      comment: "Subscription duration in months",
    },
    total_subscriptions: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
      comment: "Total number of subscriptions (new + renewal)",
    },
    total_gifts_received: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
      comment: "Number of gifted subs received",
    },
    total_gifts_given: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
      comment: "Number of subs they have gifted",
    },
    total_kicks_gifted: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
      comment: "Total number of kicks gifted by the user",
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
    tableName: "kick_user_tracking",
    timestamps: true,
    createdAt: "created_at",
    updatedAt: "updated_at",
    indexes: [
      {
        fields: ["kick_user_id"],
      },
      {
        fields: ["kick_username"],
      },
      {
        fields: ["is_subscribed"],
      },
    ],
  }
);

export = KickUserTracking;
