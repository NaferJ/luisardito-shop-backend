import {
  DataTypes,
  Model,
  InferAttributes,
  InferCreationAttributes,
  CreationOptional,
} from "sequelize";
import { sequelize } from "./database";

class Rol extends Model<InferAttributes<Rol>, InferCreationAttributes<Rol>> {
  declare id: CreationOptional<number>;
  declare nombre: string;
  declare descripcion: string | null;
}

Rol.init(
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    nombre: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true,
    },
    descripcion: {
      type: DataTypes.STRING,
      allowNull: true,
    },
  },
  {
    sequelize,
    tableName: "roles",
    timestamps: false,
  }
);

export = Rol;
