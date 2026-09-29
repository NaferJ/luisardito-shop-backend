import {
  DataTypes,
  Model,
  InferAttributes,
  InferCreationAttributes,
  CreationOptional,
} from "sequelize";
import { sequelize } from "./database";
import type Usuario from "./usuario.model";
import {
  communitySharedColumns,
  communityModerationColumns,
  communityTimestampOptions,
} from "./communityColumns";
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
    ...communitySharedColumns,
    post_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: { model: "community_posts", key: "id" },
    },
    body: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
    ...communityModerationColumns,
  },
  {
    sequelize,
    tableName: "community_comments",
    ...communityTimestampOptions,
  }
);

export = CommunityComment;
