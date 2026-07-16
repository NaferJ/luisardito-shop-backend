import {
  DataTypes,
  Model,
  InferAttributes,
  InferCreationAttributes,
  CreationOptional,
} from "sequelize";
import { sequelize } from "./database";

class KickChatCooldown extends Model<
  InferAttributes<KickChatCooldown>,
  InferCreationAttributes<KickChatCooldown>
> {
  declare id: CreationOptional<number>;
  declare kick_user_id: string;
  declare kick_username: string;
  declare last_message_at: Date;
  declare cooldown_expires_at: Date;
  declare created_at: CreationOptional<Date>;
  declare updated_at: CreationOptional<Date>;
}

KickChatCooldown.init(
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    kick_user_id: {
      type: DataTypes.STRING,
      allowNull: false,
      comment: "Kick user ID",
    },
    kick_username: {
      type: DataTypes.STRING,
      allowNull: false,
      comment: "Kick username",
    },
    last_message_at: {
      type: DataTypes.DATE,
      allowNull: false,
      comment: "Last time they wrote and received points",
    },
    cooldown_expires_at: {
      type: DataTypes.DATE,
      allowNull: false,
      comment: "When the cooldown expires (5 min later)",
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
    tableName: "kick_chat_cooldowns",
    timestamps: true,
    createdAt: "created_at",
    updatedAt: "updated_at",
    indexes: [
      {
        unique: true,
        fields: ["kick_user_id"],
        name: "idx_kick_user_id",
      },
      {
        fields: ["cooldown_expires_at"],
        name: "idx_cooldown_expires_at",
        comment: "Index for queries cleaning up expired cooldowns",
      } as unknown as { fields: string[]; name: string },
    ],
  }
);

export = KickChatCooldown;
