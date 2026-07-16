import {
  DataTypes,
  Model,
  InferAttributes,
  InferCreationAttributes,
  CreationOptional,
} from "sequelize";
import { sequelize } from "./database";

class KickWebhookEvent extends Model<
  InferAttributes<KickWebhookEvent>,
  InferCreationAttributes<KickWebhookEvent>
> {
  declare id: CreationOptional<number>;
  declare message_id: string;
  declare subscription_id: string | null;
  declare event_type: string;
  declare event_version: string;
  declare message_timestamp: Date;
  declare payload: Record<string, unknown>;
  declare processed: CreationOptional<boolean>;
  declare processed_at: Date | null;
  declare received_at: CreationOptional<Date>;
  declare updated_at: CreationOptional<Date>;
}

KickWebhookEvent.init(
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    message_id: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true,
      comment: "Unique message ID (ULID) - idempotency key",
    },
    subscription_id: {
      type: DataTypes.STRING,
      allowNull: true,
      comment: "Subscription ID associated with the event",
    },
    event_type: {
      type: DataTypes.STRING,
      allowNull: false,
      comment: "Event type (e.g. chat.message.sent)",
    },
    event_version: {
      type: DataTypes.STRING,
      allowNull: false,
      comment: "Event version",
    },
    message_timestamp: {
      type: DataTypes.DATE,
      allowNull: false,
      comment: "Timestamp of when the message was sent",
    },
    payload: {
      type: DataTypes.JSON,
      allowNull: false,
      comment: "Event content",
    },
    processed: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
      comment: "Indicates whether the event has been processed",
    },
    processed_at: {
      type: DataTypes.DATE,
      allowNull: true,
      comment: "Timestamp of when the event was processed",
    },
    received_at: {
      type: DataTypes.DATE,
    },
    updated_at: {
      type: DataTypes.DATE,
    },
  },
  {
    sequelize,
    tableName: "kick_webhook_events",
    timestamps: true,
    createdAt: "received_at",
    updatedAt: "updated_at",
    indexes: [
      {
        fields: ["message_id"],
      },
      {
        fields: ["event_type"],
      },
      {
        fields: ["processed"],
      },
      {
        fields: ["message_timestamp"],
      },
    ],
  }
);

export = KickWebhookEvent;
