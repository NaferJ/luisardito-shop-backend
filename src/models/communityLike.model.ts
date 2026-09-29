import {
  DataTypes,
  Model,
  InferAttributes,
  InferCreationAttributes,
  CreationOptional,
} from "sequelize";
import { sequelize } from "./database";
import type { CommunityLikeTarget } from "../types/community.types";

class CommunityLike extends Model<
  InferAttributes<CommunityLike>,
  InferCreationAttributes<CommunityLike>
> {
  declare id: CreationOptional<number>;
  declare usuario_id: number;
  declare target_type: CommunityLikeTarget;
  declare target_id: number;
  declare creado: CreationOptional<Date>;
  declare actualizado: CreationOptional<Date>;
}

CommunityLike.init(
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
    target_type: {
      type: DataTypes.ENUM("post", "comment"),
      allowNull: false,
    },
    target_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
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
    tableName: "community_likes",
    timestamps: true,
    createdAt: "creado",
    updatedAt: "actualizado",
    // Indexes are owned by the migration — do not duplicate them here or
    // sequelize.sync() races the migration and fails on duplicate key names.
  }
);

export = CommunityLike;
