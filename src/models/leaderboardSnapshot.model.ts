import {
  DataTypes,
  Model,
  InferAttributes,
  InferCreationAttributes,
  CreationOptional,
} from "sequelize";
import { sequelize } from "./database";

class LeaderboardSnapshot extends Model<
  InferAttributes<LeaderboardSnapshot>,
  InferCreationAttributes<LeaderboardSnapshot>
> {
  declare id: CreationOptional<number>;
  declare usuario_id: number;
  declare nickname: string;
  declare puntos: number;
  declare position: number;
  declare snapshot_date: CreationOptional<Date>;
  declare is_vip: CreationOptional<boolean>;
  declare is_subscriber: CreationOptional<boolean>;
  declare kick_data: Record<string, unknown> | null;
  declare creado: CreationOptional<Date>;
}

LeaderboardSnapshot.init(
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    usuario_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      comment: "User ID in the ranking",
    },
    nickname: {
      type: DataTypes.STRING,
      allowNull: false,
      comment: "User nickname at that moment",
    },
    puntos: {
      type: DataTypes.INTEGER,
      allowNull: false,
      comment: "User total points",
    },
    position: {
      type: DataTypes.INTEGER,
      allowNull: false,
      comment: "Ranking position (1 = first)",
    },
    snapshot_date: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
      comment: "Snapshot date and time",
      index: true,
    } as unknown as {
      type: typeof DataTypes.DATE;
      allowNull: false;
      defaultValue: typeof DataTypes.NOW;
      comment: string;
    },
    is_vip: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
      comment: "Whether the user was VIP at that moment",
    },
    is_subscriber: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
      comment: "Whether the user was a subscriber at that moment",
    },
    kick_data: {
      type: DataTypes.JSON,
      allowNull: true,
      comment: "Additional Kick data (avatar, etc.)",
    },
    creado: {
      type: DataTypes.DATE,
    },
  },
  {
    sequelize,
    tableName: "leaderboard_snapshots",
    timestamps: true,
    createdAt: "creado",
    updatedAt: false,
    indexes: [
      {
        fields: ["usuario_id", "snapshot_date"],
      },
      {
        fields: ["snapshot_date"],
      },
      {
        fields: ["position", "snapshot_date"],
      },
    ],
  }
);

export = LeaderboardSnapshot;
