import {
  DataTypes,
  Model,
  InferAttributes,
  InferCreationAttributes,
  CreationOptional,
} from "sequelize";
import { sequelize } from "./database";
import Rol from "./rol.model";
import type UserWatchtime from "./userWatchtime.model";

interface KickData {
  is_subscriber?: boolean;
  [key: string]: unknown;
}

class Usuario extends Model<
  InferAttributes<Usuario>,
  InferCreationAttributes<Usuario>
> {
  declare id: CreationOptional<number>;
  declare user_id_ext: string | null;
  declare nickname: string;
  declare email: string | null;
  declare password_hash: string | null;
  declare puntos: CreationOptional<number>;
  declare max_puntos: CreationOptional<number>;
  declare kick_data: KickData | null;
  declare discord_username: string | null;
  declare botrix_migrated: CreationOptional<boolean>;
  declare botrix_migrated_at: Date | null;
  declare botrix_points_migrated: number | null;
  declare botrix_watchtime_migrated: CreationOptional<boolean>;
  declare botrix_watchtime_migrated_at: Date | null;
  declare botrix_watchtime_minutes_migrated: number | null;
  declare is_vip: CreationOptional<boolean>;
  declare vip_granted_at: Date | null;
  declare vip_expires_at: Date | null;
  declare vip_granted_by_canje_id: number | null;
  declare rol_id: CreationOptional<number>;
  declare creado: CreationOptional<Date>;
  declare actualizado: CreationOptional<Date>;

  // Instance methods
  isVipActive(): boolean {
    if (!this.is_vip) return false;
    if (!this.vip_expires_at) return true; // Permanent VIP
    return new Date() < new Date(this.vip_expires_at);
  }

  canMigrateBotrix(): boolean {
    return !this.botrix_migrated;
  }

  canMigrateWatchtime(): boolean {
    return !this.botrix_watchtime_migrated;
  }

  getUserType(): "vip" | "subscriber" | "regular" {
    if (this.isVipActive()) return "vip";
    if (this.kick_data?.is_subscriber) return "subscriber";
    return "regular";
  }

  // Association mixins (declared by associations in models/index.ts)
  declare rol?: Rol;
  declare watchtime?: UserWatchtime;
}

Usuario.init(
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    user_id_ext: {
      type: DataTypes.STRING,
      allowNull: true,
      unique: true,
    },
    nickname: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true,
    },
    email: {
      type: DataTypes.STRING,
      allowNull: true,
      unique: true,
    },
    password_hash: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    puntos: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
    },
    max_puntos: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
      comment: "Maximum points the user has reached in their history",
    },
    kick_data: {
      type: DataTypes.JSON,
      allowNull: true,
    },
    discord_username: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    botrix_migrated: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },
    botrix_migrated_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    botrix_points_migrated: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    botrix_watchtime_migrated: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
      comment: "Whether the user already migrated their watchtime from Botrix",
    },
    botrix_watchtime_migrated_at: {
      type: DataTypes.DATE,
      allowNull: true,
      comment: "Date when the watchtime migration was performed",
    },
    botrix_watchtime_minutes_migrated: {
      type: DataTypes.INTEGER,
      allowNull: true,
      comment: "Total watchtime minutes migrated from Botrix",
    },
    is_vip: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },
    vip_granted_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    vip_expires_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    vip_granted_by_canje_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    rol_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 1,
      references: {
        model: Rol,
        key: "id",
      },
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
    tableName: "usuarios",
    timestamps: true,
    createdAt: "creado",
    updatedAt: "actualizado",
  }
);

// Associations are defined in models/index.ts to avoid duplicate registration
export = Usuario;
