const { DataTypes } = require("sequelize");
const { sequelize } = require("./database");

const LeaderboardSnapshot = sequelize.define(
  "LeaderboardSnapshot",
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    usuario_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      comment: "ID del usuario en el ranking",
    },
    nickname: {
      type: DataTypes.STRING,
      allowNull: false,
      comment: "Nickname del usuario en ese momento",
    },
    puntos: {
      type: DataTypes.INTEGER,
      allowNull: false,
      comment: "Puntos totales del usuario",
    },
    position: {
      type: DataTypes.INTEGER,
      allowNull: false,
      comment: "Posición en el ranking (1 = primero)",
    },
    snapshot_date: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
      comment: "Fecha y hora del snapshot",
      index: true,
    },
    is_vip: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
      comment: "Si el usuario era VIP en ese momento",
    },
    is_subscriber: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
      comment: "Si el usuario era suscriptor en ese momento",
    },
    kick_data: {
      type: DataTypes.JSON,
      allowNull: true,
      comment: "Datos adicionales de Kick (avatar, etc.)",
    },
  },
  {
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
  },
);

module.exports = LeaderboardSnapshot;
