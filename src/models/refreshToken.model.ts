import {
  DataTypes,
  Model,
  InferAttributes,
  InferCreationAttributes,
  CreationOptional,
} from "sequelize";
import { sequelize } from "./database";

class RefreshToken extends Model<
  InferAttributes<RefreshToken>,
  InferCreationAttributes<RefreshToken>
> {
  declare id: CreationOptional<number>;
  declare usuario_id: number;
  declare token: string;
  declare expires_at: Date;
  declare is_revoked: CreationOptional<boolean>;
  declare revoked_at: Date | null;
  declare ip_address: string | null;
  declare user_agent: string | null;
  declare replaced_by_token: string | null;
  declare created_at: CreationOptional<Date>;
  declare updated_at: CreationOptional<Date>;
}

RefreshToken.init(
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    usuario_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      comment: "User ID in our database",
    },
    token: {
      type: DataTypes.STRING(500),
      allowNull: false,
      unique: true,
      comment: "Refresh token (UUID or JWT)",
    },
    expires_at: {
      type: DataTypes.DATE,
      allowNull: false,
      comment: "Expiration date of the refresh token",
    },
    is_revoked: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
      comment: "Whether the token was revoked (logout)",
    },
    revoked_at: {
      type: DataTypes.DATE,
      allowNull: true,
      comment: "When the token was revoked",
    },
    ip_address: {
      type: DataTypes.STRING,
      allowNull: true,
      comment: "IP from which it was created",
    },
    user_agent: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: "Browser user agent",
    },
    replaced_by_token: {
      type: DataTypes.STRING(500),
      allowNull: true,
      comment: "Token that replaced this one (for rotation)",
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
    tableName: "refresh_tokens",
    timestamps: true,
    createdAt: "created_at",
    updatedAt: "updated_at",
    indexes: [
      {
        fields: ["token"],
      },
      {
        fields: ["usuario_id"],
      },
      {
        fields: ["expires_at"],
      },
      {
        fields: ["is_revoked"],
      },
    ],
  }
);

export = RefreshToken;
