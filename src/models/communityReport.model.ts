import {
  DataTypes,
  Model,
  InferAttributes,
  InferCreationAttributes,
  CreationOptional,
} from "sequelize";
import { sequelize } from "./database";
import type Usuario from "./usuario.model";
import { communityTimestampOptions } from "./communityColumns";
import type {
  CommunityReportReason,
  CommunityReportStatus,
  CommunityReportTarget,
} from "../types/community.types";

class CommunityReport extends Model<
  InferAttributes<CommunityReport>,
  InferCreationAttributes<CommunityReport>
> {
  declare id: CreationOptional<number>;
  declare reporter_id: number;
  declare target_type: CommunityReportTarget;
  declare target_id: number;
  declare reason: CommunityReportReason;
  declare details: string | null;
  declare status: CreationOptional<CommunityReportStatus>;
  declare resolved_by: number | null;
  declare resolved_at: Date | null;
  declare creado: CreationOptional<Date>;
  declare actualizado: CreationOptional<Date>;

  // Association mixins (defined in models/index.ts)
  declare reporter?: Usuario;
  declare resolver?: Usuario;
}

CommunityReport.init(
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    reporter_id: {
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
    reason: {
      type: DataTypes.ENUM(
        "spam",
        "harassment",
        "hate",
        "sexual",
        "violence",
        "other"
      ),
      allowNull: false,
    },
    details: {
      type: DataTypes.STRING(500),
      allowNull: true,
    },
    status: {
      type: DataTypes.ENUM("open", "resolved", "dismissed"),
      allowNull: false,
      defaultValue: "open",
    },
    resolved_by: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: { model: "usuarios", key: "id" },
    },
    resolved_at: {
      type: DataTypes.DATE,
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
    tableName: "community_reports",
    ...communityTimestampOptions,
    // Indexes are owned by the migration — do not duplicate them here or
    // sequelize.sync() races the migration and fails on duplicate key names.
  }
);

export = CommunityReport;
