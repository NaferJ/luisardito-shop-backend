import {
  DataTypes,
  Model,
  InferAttributes,
  InferCreationAttributes,
  CreationOptional,
} from "sequelize";
import { sequelize } from "./database";
import Rol from "./rol.model";
import Permiso from "./permiso.model";

class RolPermiso extends Model<
  InferAttributes<RolPermiso>,
  InferCreationAttributes<RolPermiso>
> {
  declare id: CreationOptional<number>;
  declare rol_id: number;
  declare permiso_id: number;
}

RolPermiso.init(
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    rol_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: { model: Rol, key: "id" },
    },
    permiso_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: { model: Permiso, key: "id" },
    },
  },
  {
    sequelize,
    tableName: "rol_permisos",
    timestamps: false,
    uniqueKeys: {
      rol_perm_unique: {
        fields: ["rol_id", "permiso_id"],
      },
    },
  } as unknown as Parameters<typeof RolPermiso.init>[1]
);

// Associations are defined in models/index.ts to avoid duplicate registration

export = RolPermiso;
