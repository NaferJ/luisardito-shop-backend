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
  communityEditedColumns,
  communityTimestampOptions,
} from "./communityColumns";
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
  declare edited_at: Date | null;
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
    ...communitySharedColumns,
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
    view_count: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: false,
      defaultValue: 0,
    },
    ...communityModerationColumns,
    ...communityEditedColumns,
  },
  {
    sequelize,
    tableName: "community_posts",
    ...communityTimestampOptions,
  }
);

export = CommunityPost;
