import {
  DataTypes,
  Model,
  InferAttributes,
  InferCreationAttributes,
  CreationOptional,
} from "sequelize";
import { sequelize } from "./database";
import Usuario from "./usuario.model";

class UserWatchtime extends Model<
  InferAttributes<UserWatchtime>,
  InferCreationAttributes<UserWatchtime>
> {
  declare id: CreationOptional<number>;
  declare usuario_id: number;
  declare kick_user_id: string | null;
  declare total_watchtime_minutes: CreationOptional<number>;
  declare message_count: CreationOptional<number>;
  declare first_message_date: Date | null;
  declare last_message_at: Date | null;
  declare created_at: CreationOptional<Date>;
  declare updated_at: CreationOptional<Date>;
}

UserWatchtime.init(
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    usuario_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: Usuario,
        key: "id",
      },
      comment: "ID del usuario",
    },
    kick_user_id: {
      type: DataTypes.STRING,
      allowNull: true,
      comment: "ID de usuario en Kick (para auditoría)",
    },
    total_watchtime_minutes: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
      comment: "Total de minutos de watchtime acumulados",
    },
    message_count: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
      comment: "Total de mensajes registrados",
    },
    first_message_date: {
      type: DataTypes.DATE,
      allowNull: true,
      comment: "Fecha del primer mensaje registrado",
    },
    last_message_at: {
      type: DataTypes.DATE,
      allowNull: true,
      comment: "Fecha del último mensaje registrado",
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
    tableName: "user_watchtime",
    timestamps: true,
    createdAt: "created_at",
    updatedAt: "updated_at",
  }
);

// Associations are defined in models/index.ts to avoid duplicate registration
export = UserWatchtime;
