import { DataTypes } from "sequelize";
import type { ModelAttributeColumnOptions, ModelOptions } from "sequelize";

// Column definitions shared by the community_* models. Kept here so the
// models do not duplicate the same attribute blocks (Sonar duplication).
// `satisfies` preserves the literal keys so Model.init sees the columns.
export const communitySharedColumns = {
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
  creado: {
    type: DataTypes.DATE,
  },
  actualizado: {
    type: DataTypes.DATE,
  },
} satisfies Record<string, ModelAttributeColumnOptions>;

// Soft-hide moderation columns on posts and comments. No physical deletes.
export const communityModerationColumns = {
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
} satisfies Record<string, ModelAttributeColumnOptions>;

// Set when the author edits their content (posts and comments).
export const communityEditedColumns = {
  edited_at: {
    type: DataTypes.DATE,
    allowNull: true,
  },
} satisfies Record<string, ModelAttributeColumnOptions>;

export const communityTimestampOptions = {
  timestamps: true,
  createdAt: "creado",
  updatedAt: "actualizado",
} satisfies Partial<ModelOptions>;
