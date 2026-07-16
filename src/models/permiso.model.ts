import {
  DataTypes,
  Model,
  InferAttributes,
  InferCreationAttributes,
  CreationOptional,
} from "sequelize";
import { sequelize } from "./database";

class Permiso extends Model<
  InferAttributes<Permiso>,
  InferCreationAttributes<Permiso>
> {
  declare id: CreationOptional<number>;
  declare nombre: string;
  declare descripcion: string | null;
}

Permiso.init(
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
    tableName: "permisos",
    timestamps: false,
  }
);

export = Permiso;
