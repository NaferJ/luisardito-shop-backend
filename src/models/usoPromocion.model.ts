import {
  DataTypes,
  Model,
  InferAttributes,
  InferCreationAttributes,
  CreationOptional,
} from "sequelize";
import { sequelize } from "./database";

class UsoPromocion extends Model<
  InferAttributes<UsoPromocion>,
  InferCreationAttributes<UsoPromocion>
> {
  declare id: CreationOptional<number>;
  declare promocion_id: number;
  declare usuario_id: number;
  declare canje_id: number | null;
  declare producto_id: number | null;
  declare codigo_usado: string | null;
  declare precio_original: number;
  declare descuento_aplicado: number;
  declare precio_final: number;
  declare metadata: CreationOptional<Record<string, unknown> | null>;
  declare fecha_uso: CreationOptional<Date>;
}

UsoPromocion.init(
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
    usuario_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: "usuarios",
        key: "id",
      },
      onDelete: "CASCADE",
      onUpdate: "CASCADE",
    },
    canje_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: {
        model: "canjes",
        key: "id",
      },
      onDelete: "SET NULL",
      onUpdate: "CASCADE",
      comment: "Reference to the canje where the discount was applied",
    },
    producto_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: {
        model: "productos",
        key: "id",
      },
      onDelete: "SET NULL",
      onUpdate: "CASCADE",
      comment: "Product to which the discount was applied",
    },
    codigo_usado: {
      type: DataTypes.STRING(50),
      allowNull: true,
      comment: "Coupon code used (if applicable)",
    },
    precio_original: {
      type: DataTypes.INTEGER,
      allowNull: false,
      comment: "Original price in points before the discount",
    },
    descuento_aplicado: {
      type: DataTypes.INTEGER,
      allowNull: false,
      comment: "Amount of points discounted",
    },
    precio_final: {
      type: DataTypes.INTEGER,
      allowNull: false,
      comment: "Final price in points after the discount",
    },
    metadata: {
      type: DataTypes.JSON,
      allowNull: true,
      comment: "Additional information about the usage",
      defaultValue: {},
    },
    fecha_uso: {
      type: DataTypes.DATE,
    },
  },
  {
    sequelize,
    tableName: "uso_promociones",
    timestamps: true,
    createdAt: "fecha_uso",
    updatedAt: false,
    indexes: [
      {
        fields: ["promocion_id"],
      },
      {
        fields: ["usuario_id"],
      },
      {
        fields: ["canje_id"],
      },
      {
        fields: ["fecha_uso"],
      },
    ],
  }
);

export = UsoPromocion;
