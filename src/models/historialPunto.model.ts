import { DataTypes } from "sequelize";
import { sequelize } from "./database";

const HistorialPunto = sequelize.define(
  "HistorialPunto",
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    usuario_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    puntos: {
      type: DataTypes.INTEGER,
      allowNull: false,
      comment: "Cantidad de puntos (positivo o negativo)",
    },
    cambio: {
      type: DataTypes.INTEGER,
      allowNull: true,
      comment: "Campo legacy - se mantiene por compatibilidad",
    },
    tipo: {
      type: DataTypes.ENUM("ganado", "gastado", "ajuste"),
      allowNull: false,
      defaultValue: "ganado",
      comment: "Tipo de movimiento de puntos",
    },
    concepto: {
      type: DataTypes.STRING,
      allowNull: false,
      comment: "Descripción del concepto",
    },
    motivo: {
      type: DataTypes.STRING,
      allowNull: true,
      comment: "Campo legacy - se mantiene por compatibilidad",
    },
    kick_event_data: {
      type: DataTypes.JSON,
      allowNull: true,
      comment: "Datos del evento de Kick asociado",
    },
  },
  {
    tableName: "historial_puntos",
    timestamps: true,
    createdAt: "fecha",
    updatedAt: false,
  }
);

export = HistorialPunto;
