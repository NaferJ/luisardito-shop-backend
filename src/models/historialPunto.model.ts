import {
  DataTypes,
  Model,
  InferAttributes,
  InferCreationAttributes,
  CreationOptional,
} from "sequelize";
import { sequelize } from "./database";

type HistorialPuntoTipo = "ganado" | "gastado" | "ajuste";

class HistorialPunto extends Model<
  InferAttributes<HistorialPunto>,
  InferCreationAttributes<HistorialPunto>
> {
  declare id: CreationOptional<number>;
  declare usuario_id: number;
  declare puntos: number;
  declare cambio: number | null;
  declare tipo: CreationOptional<HistorialPuntoTipo>;
  declare concepto: string;
  declare motivo: string | null;
  declare kick_event_data: Record<string, unknown> | null;
  declare fecha: CreationOptional<Date>;
}

HistorialPunto.init(
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
      comment: "Amount of points (positive or negative)",
    },
    cambio: {
      type: DataTypes.INTEGER,
      allowNull: true,
      comment: "Legacy field - kept for compatibility",
    },
    tipo: {
      type: DataTypes.ENUM("ganado", "gastado", "ajuste"),
      allowNull: false,
      defaultValue: "ganado",
      comment: "Type of points movement",
    },
    concepto: {
      type: DataTypes.STRING,
      allowNull: false,
      comment: "Concept description",
    },
    motivo: {
      type: DataTypes.STRING,
      allowNull: true,
      comment: "Legacy field - kept for compatibility",
    },
    kick_event_data: {
      type: DataTypes.JSON,
      allowNull: true,
      comment: "Associated Kick event data",
    },
    fecha: {
      type: DataTypes.DATE,
    },
  },
  {
    sequelize,
    tableName: "historial_puntos",
    timestamps: true,
    createdAt: "fecha",
    updatedAt: false,
  }
);

export = HistorialPunto;
