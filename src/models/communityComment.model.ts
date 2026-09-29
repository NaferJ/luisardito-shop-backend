import {
  DataTypes,
  Model,
  InferAttributes,
  InferCreationAttributes,
  CreationOptional,
} from "sequelize";
import { sequelize } from "./database";
import type Usuario from "./usuario.model";
import type { CommunityStatus } from "../types/community.types";

class CommunityComment extends Model<
  InferAttributes<CommunityComment>,
  InferCreationAttributes<CommunityComment>
> {
  declare id: CreationOptional<number>;
  declare post_id: number;
  declare usuario_id: number;
  declare body: string;
  declare status: CreationOptional<CommunityStatus>;
  declare hidden_by: number | null;
  declare hidden_at: Date | null;
  declare hidden_reason: string | null;
  declare creado: CreationOptional<Date>;
  declare actualizado: CreationOptional<Date>;

  // Association mixins (defined in models/index.ts)
  declare author?: Usuario;
}

CommunityComment.init(
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    post_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: { model: "community_posts", key: "id" },
    },
    usuario_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: { model: "usuarios", key: "id" },
    },
    body: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
    status: {
      type: DataTypes.ENUM("visible", "pending_review", "hidden"),
      allowNull: false,
      defaultValue: "visible",
    },
    hidden_by: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: { model: "usuarios", key: "id" },
    },
    hidden_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    hidden_reason: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
    creado: {
      type: DataTypes.DATE,
    },
    actualizado: {
      type: DataTypes.DATE,
    },
  },
  {
    sequelize,
    tableName: "community_comments",
    timestamps: true,
    createdAt: "creado",
    updatedAt: "actualizado",
  }
);

export = CommunityComment;
