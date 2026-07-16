import {
  DataTypes,
  Model,
  InferAttributes,
  InferCreationAttributes,
  CreationOptional,
} from "sequelize";
import { sequelize } from "./database";

class PromocionProducto extends Model<
  InferAttributes<PromocionProducto>,
  InferCreationAttributes<PromocionProducto>
> {
  declare id: CreationOptional<number>;
  declare promocion_id: number;
  declare producto_id: number;
  declare creado: CreationOptional<Date>;
}

PromocionProducto.init(
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    promocion_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: "promociones",
        key: "id",
      },
      onDelete: "CASCADE",
      onUpdate: "CASCADE",
    },
    producto_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: "productos",
        key: "id",
      },
      onDelete: "CASCADE",
      onUpdate: "CASCADE",
    },
    creado: {
      type: DataTypes.DATE,
    },
  },
  {
    sequelize,
    tableName: "promocion_productos",
    timestamps: true,
    createdAt: "creado",
    updatedAt: false,
    indexes: [
      {
        unique: true,
        fields: ["promocion_id", "producto_id"],
      },
      {
        fields: ["producto_id"],
      },
    ],
  }
);

export = PromocionProducto;
