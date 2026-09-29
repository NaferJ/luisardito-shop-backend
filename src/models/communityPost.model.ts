import {
  DataTypes,
  Model,
  InferAttributes,
  InferCreationAttributes,
  CreationOptional,
} from "sequelize";
import { sequelize } from "./database";
import type Usuario from "./usuario.model";
import type {
  CommunityStatus,
  CommunityMediaItem,
} from "../types/community.types";

class CommunityPost extends Model<
  InferAttributes<CommunityPost>,
  InferCreationAttributes<CommunityPost>
> {
  declare id: CreationOptional<number>;
  declare usuario_id: number;
  declare title: string;
  declare body: string;
  declare media: CommunityMediaItem[] | null;
  declare pinned: CreationOptional<boolean>;
  declare status: CreationOptional<CommunityStatus>;
  declare view_count: CreationOptional<number>;
  declare hidden_by: number | null;
  declare hidden_at: Date | null;
  declare hidden_reason: string | null;
  declare creado: CreationOptional<Date>;
  declare actualizado: CreationOptional<Date>;

  // Association mixins (defined in models/index.ts)
  declare author?: Usuario;
}

CommunityPost.init(
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    usuario_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: { model: "usuarios", key: "id" },
    },
    title: {
      type: DataTypes.STRING(200),
      allowNull: false,
    },
    body: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
    media: {
      type: DataTypes.JSON,
      allowNull: true,
    },
    pinned: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },
    status: {
      type: DataTypes.ENUM("visible", "pending_review", "hidden"),
      allowNull: false,
      defaultValue: "visible",
    },
    view_count: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: false,
      defaultValue: 0,
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
    tableName: "community_posts",
    timestamps: true,
    createdAt: "creado",
    updatedAt: "actualizado",
  }
);

export = CommunityPost;
