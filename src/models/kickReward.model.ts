import {
  DataTypes,
  Model,
  InferAttributes,
  InferCreationAttributes,
  CreationOptional,
} from "sequelize";
import { sequelize } from "./database";

class KickReward extends Model<
  InferAttributes<KickReward>,
  InferCreationAttributes<KickReward>
> {
  declare id: CreationOptional<number>;
  declare kick_reward_id: string;
  declare title: string;
  declare description: string | null;
  declare cost: number;
  declare background_color: CreationOptional<string>;
  declare puntos_a_otorgar: CreationOptional<number>;
  declare is_enabled: CreationOptional<boolean>;
  declare is_paused: CreationOptional<boolean>;
  declare is_user_input_required: CreationOptional<boolean>;
  declare should_redemptions_skip_request_queue: CreationOptional<boolean>;
  declare auto_accept: CreationOptional<boolean>;
  declare total_redemptions: CreationOptional<number>;
  declare last_synced_at: Date | null;
  declare created_at: CreationOptional<Date>;
  declare updated_at: CreationOptional<Date>;
}

KickReward.init(
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    kick_reward_id: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true,
      comment: "ID de la recompensa en Kick (ULID)",
    },
    title: {
      type: DataTypes.STRING(50),
      allowNull: false,
      comment: "Título de la recompensa en Kick",
    },
    description: {
      type: DataTypes.STRING(200),
      allowNull: true,
      comment: "Descripción de la recompensa",
    },
    cost: {
      type: DataTypes.INTEGER,
      allowNull: false,
      comment: "Costo en puntos de Kick",
    },
    background_color: {
      type: DataTypes.STRING(7),
      allowNull: true,
      defaultValue: "#00e701",
      comment: "Color de fondo en formato hex",
    },
    puntos_a_otorgar: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
      comment: "Puntos a otorgar en nuestra app cuando se canjee",
    },
    is_enabled: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
      comment: "Si está habilitada en Kick",
    },
    is_paused: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
      comment: "Si está pausada en Kick",
    },
    is_user_input_required: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
      comment: "Si requiere input del usuario",
    },
    should_redemptions_skip_request_queue: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
      comment: "Si los canjeos saltan la cola de solicitudes",
    },
    auto_accept: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
      comment: "Si se acepta automáticamente al canjear",
    },
    total_redemptions: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
      comment: "Total de veces que se ha canjeado",
    },
    last_synced_at: {
      type: DataTypes.DATE,
      allowNull: true,
      comment: "Última vez que se sincronizó con Kick",
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
    tableName: "kick_rewards",
    timestamps: true,
    createdAt: "created_at",
    updatedAt: "updated_at",
  }
);

export = KickReward;
