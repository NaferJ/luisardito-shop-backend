import {
  DataTypes,
  Model,
  InferAttributes,
  InferCreationAttributes,
  CreationOptional,
} from "sequelize";
import { sequelize } from "./database";
import type Usuario from "./usuario.model";

class DiscordUserLink extends Model<
  InferAttributes<DiscordUserLink>,
  InferCreationAttributes<DiscordUserLink>
> {
  declare id: CreationOptional<number>;
  declare discord_user_id: string;
  declare discord_username: string | null;
  declare discord_discriminator: string | null;
  declare discord_avatar: string | null;
  declare tienda_user_id: number;
  declare kick_user_id: string | null;
  declare access_token: string | null;
  declare refresh_token: string | null;
  declare token_expires_at: Date | null;
  declare linked_at: CreationOptional<Date>;
  declare created_at: CreationOptional<Date>;
  declare updated_at: CreationOptional<Date>;

  // Association mixin (declared by belongsTo in models/index.ts)
  declare usuario?: Usuario;
  declare getUsuario?: () => Promise<Usuario | null>;
}

DiscordUserLink.init(
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    discord_user_id: {
      type: DataTypes.STRING(255),
      allowNull: false,
      unique: true,
      comment: "ID único del usuario en Discord",
    },
    discord_username: {
      type: DataTypes.STRING(255),
      allowNull: true,
      comment: "Username de Discord (puede cambiar)",
    },
    discord_discriminator: {
      type: DataTypes.STRING(10),
      allowNull: true,
      comment: "Discriminator de Discord (ej: #1234)",
    },
    discord_avatar: {
      type: DataTypes.STRING(255),
      allowNull: true,
      comment: "Hash del avatar de Discord",
    },
    tienda_user_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: "usuarios",
        key: "id",
      },
      comment: "ID del usuario en la tienda",
    },
    kick_user_id: {
      type: DataTypes.STRING(255),
      allowNull: true,
      comment: "ID del usuario en Kick (si está vinculado)",
    },
    access_token: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: "Access token de Discord",
    },
    refresh_token: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: "Refresh token de Discord",
    },
    token_expires_at: {
      type: DataTypes.DATE,
      allowNull: true,
      comment: "Fecha de expiración del access token",
    },
    linked_at: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
      comment: "Fecha de vinculación",
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
    tableName: "discord_user_links",
    timestamps: true,
    createdAt: "created_at",
    updatedAt: "updated_at",
    indexes: [
      {
        unique: true,
        fields: ["discord_user_id"],
      },
      {
        fields: ["tienda_user_id"],
      },
      {
        fields: ["kick_user_id"],
      },
    ],
  }
);

// Associations are defined in models/index.ts to avoid duplicate registration
export = DiscordUserLink;
