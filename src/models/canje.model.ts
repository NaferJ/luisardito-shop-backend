import {
  DataTypes,
  Model,
  InferAttributes,
  InferCreationAttributes,
  CreationOptional,
} from "sequelize";
import { sequelize } from "./database";

type CanjeEstado = "pendiente" | "entregado" | "cancelado" | "devuelto";

class Canje extends Model<
  InferAttributes<Canje>,
  InferCreationAttributes<Canje>
> {
  declare id: CreationOptional<number>;
  declare usuario_id: number;
  declare producto_id: number;
  declare precio_al_canje: number | null;
  declare estado: CreationOptional<CanjeEstado>;
  declare fecha: CreationOptional<Date>;
}

Canje.init(
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
    producto_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    precio_al_canje: {
      type: DataTypes.INTEGER,
      allowNull: true,
      comment: "Price in points at the time of the exchange",
    },
    estado: {
      type: DataTypes.ENUM("pendiente", "entregado", "cancelado", "devuelto"),
      defaultValue: "pendiente",
    },
    fecha: {
      type: DataTypes.DATE,
    },
  },
  {
    sequelize,
    tableName: "canjes",
    timestamps: true,
    createdAt: "fecha",
    updatedAt: false,
  }
);

export = Canje;
